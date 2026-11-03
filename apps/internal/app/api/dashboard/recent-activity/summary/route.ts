import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateText } from 'ai'
import type { Json } from '@/lib/types/json'
import { fetchActivityLogsSince } from '@/lib/activity/queries'
import {
  loadActivityOverviewCache,
  upsertActivityOverviewCache,
} from '@/lib/activity/overview-cache'
import { getCurrentUser } from '@/lib/auth/session'
import { assertAdmin } from '@/lib/auth/permissions'
import {
  VALID_TIMEFRAMES,
  ONE_HOUR_MS,
  ACTIVITY_SUMMARY_MODEL,
  ACTIVITY_SUMMARY_REASONING,
  HIGHLIGHT_CHARACTER_LIMIT,
  ValidTimeframe,
  TIMEFRAME_LOG_LIMITS,
  ActivityMetrics,
} from '@/lib/activity/summary/config'
import { computeMetrics } from '@/lib/activity/summary/metrics'
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildNoActivityHighlight,
  buildFallbackHighlight,
  enforceHighlightCharacterLimit,
} from '@/lib/activity/summary/prompt'
import { buildActivityContext } from '@/lib/activity/summary/context'

type CacheStatus = 'hit' | 'miss'

type CacheHeaders = {
  status: CacheStatus
  cachedAt: string
  expiresAt: string
}

type ActivityOverviewResponse = {
  metrics: ActivityMetrics
  highlight: string
}

const requestSchema = z.object({
  timeframeDays: z.number().int(),
  forceRefresh: z.boolean().optional(),
})

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Defense-in-depth: the internal portal is admin-only, and the briefing is
  // built from UNSCOPED activity logs (fetchActivityLogsSince) plus global
  // lead/task metrics — internal operations data.
  assertAdmin(user)

  let timeframeDays: number
  let forceRefresh = false

  try {
    const payload = await request.json()
    const parsed = requestSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request payload.' },
        { status: 400 }
      )
    }

    timeframeDays = parsed.data.timeframeDays
    forceRefresh = parsed.data.forceRefresh ?? false
  } catch (error) {
    console.error('Invalid request body for recent activity summary', error)
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    )
  }

  if (!VALID_TIMEFRAMES.includes(timeframeDays as ValidTimeframe)) {
    return NextResponse.json(
      { error: 'Unsupported timeframe requested.' },
      { status: 400 }
    )
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const since = new Date(now.getTime() - timeframeDays * 24 * 60 * 60 * 1000)

  try {
    const cache = await loadActivityOverviewCache({
      userId: user.id,
      timeframeDays,
    })

    if (
      !forceRefresh &&
      cache &&
      new Date(cache.expires_at).getTime() > now.getTime()
    ) {
      // Only the model-written highlight is worth caching. The metric cards
      // are four count queries, and serving them from the hour-old row made
      // "tasks blocked" lag behind the board until the cache expired.
      const cachedResponse = parseCachedResponse(cache.summary)
      const metrics = await computeMetrics(since)
      return jsonResponse(
        { metrics, highlight: cachedResponse.highlight },
        {
          status: 'hit',
          cachedAt: cache.cached_at,
          expiresAt: cache.expires_at,
        }
      )
    }

    const logs = await fetchActivityLogsSince(user, {
      since: since.toISOString(),
      limit: TIMEFRAME_LOG_LIMITS[timeframeDays as ValidTimeframe],
    })

    const expiresAtIso = new Date(now.getTime() + ONE_HOUR_MS).toISOString()

    const [metrics, context] = await Promise.all([
      computeMetrics(since),
      buildActivityContext(logs),
    ])

    if (!logs.length) {
      const response: ActivityOverviewResponse = {
        metrics,
        highlight: buildNoActivityHighlight(timeframeDays as ValidTimeframe),
      }

      await upsertActivityOverviewCache({
        userId: user.id,
        timeframeDays,
        summary: response as unknown as Json,
        cachedAt: nowIso,
        expiresAt: expiresAtIso,
      })

      return jsonResponse(response, {
        status: 'miss',
        cachedAt: nowIso,
        expiresAt: expiresAtIso,
      })
    }

    let highlight = ''
    try {
      const result = await generateText({
        model: ACTIVITY_SUMMARY_MODEL,
        reasoning: ACTIVITY_SUMMARY_REASONING,
        system: buildSystemPrompt(timeframeDays as ValidTimeframe),
        prompt: buildUserPrompt({
          timeframeDays: timeframeDays as ValidTimeframe,
          logs,
          now,
          context,
          metrics,
        }),
      })
      highlight = result.text.trim()
    } catch (aiError) {
      console.error('Failed to generate activity highlight', aiError)
    }

    if (!highlight) {
      highlight = buildFallbackHighlight(logs, timeframeDays, metrics)
    }

    highlight = enforceHighlightCharacterLimit(
      highlight,
      HIGHLIGHT_CHARACTER_LIMIT
    )

    const response: ActivityOverviewResponse = {
      metrics,
      highlight,
    }

    try {
      await upsertActivityOverviewCache({
        userId: user.id,
        timeframeDays,
        summary: response as unknown as Json,
        cachedAt: new Date().toISOString(),
        expiresAt: expiresAtIso,
      })
    } catch (cacheError) {
      console.error('Failed to cache activity overview summary', cacheError)
    }

    return jsonResponse(response, {
      status: 'miss',
      cachedAt: nowIso,
      expiresAt: expiresAtIso,
    })
  } catch (error) {
    console.error('Invalid request body for recent activity summary', error)
    console.error('Failed to resolve recent activity overview', error)
    return NextResponse.json(
      { error: 'Unable to summarize recent activity.' },
      { status: 500 }
    )
  }
}
function jsonResponse(
  data: ActivityOverviewResponse,
  headers: CacheHeaders
): Response {
  return NextResponse.json(data, {
    headers: buildCacheHeaders(headers),
  })
}

function buildCacheHeaders({
  status,
  cachedAt,
  expiresAt,
}: CacheHeaders): HeadersInit {
  return {
    'cache-control': 'no-store',
    'x-activity-overview-cache': status,
    'x-activity-overview-cached-at': cachedAt,
    'x-activity-overview-expires-at': expiresAt,
    'x-activity-overview-model': ACTIVITY_SUMMARY_MODEL,
  }
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function parseCachedResponse(summary: Json): ActivityOverviewResponse {
  // Rows written before the column became jsonb hold a JSON string; newer
  // rows hold the object directly.
  const parsed: unknown =
    typeof summary === 'string' ? safeParse(summary) : summary
  if (
    parsed &&
    typeof parsed === 'object' &&
    'metrics' in parsed &&
    'highlight' in parsed
  ) {
    return parsed as ActivityOverviewResponse
  }
  return {
    metrics: { newLeads: 0, activeProjects: 0, blockedTasks: 0 },
    highlight: 'No recent activity to report.',
  }
}
