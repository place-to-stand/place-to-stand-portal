import 'server-only'

import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import {
  serializeSubmission,
  serializeSubmissionDetail,
} from '@/lib/cli/serializers/submission'
import {
  fetchFormSubmissionById,
  fetchFormSubmissions,
} from '@/lib/data/form-submissions'
import {
  FORM_SUBMISSION_KIND_VALUES,
  FORM_SUBMISSION_STATUS_VALUES,
} from '@/lib/form-submissions/constants'

import { clip, listLimit, searchText } from '../output'
import { defineTool } from '../tool'

/**
 * The website form inbox (contact, audit and subscribe submissions), read
 * only. Acknowledging, archiving and promoting to a lead stay in the portal.
 */
export function registerSubmissionTools(server: McpServer) {
  defineTool(server, {
    name: 'list_submissions',
    title: 'List form submissions',
    description:
      'List website form submissions (contact form, Opportunity Audit, mailing-list sign-ups), newest activity first, with who sent them and where they came from. unread lists only those nobody has acknowledged yet. Messages are previews; get_submission returns the whole submission. Leads are made from a submission by hand in the portal.',
    effect: 'read',
    input: {
      kind: z.enum(FORM_SUBMISSION_KIND_VALUES).optional(),
      status: z.enum(FORM_SUBMISSION_STATUS_VALUES).optional(),
      unread: z
        .boolean()
        .default(false)
        .describe('Only submissions nobody has acknowledged.'),
      archived: z
        .boolean()
        .default(false)
        .describe('List archived submissions instead.'),
      search: searchText
        .describe('Match on name, email or company.')
        .optional(),
      limit: listLimit,
    },
    run: async (
      { kind, status, unread, archived, search, limit },
      { user }
    ) => {
      const result = await fetchFormSubmissions(user, {
        page: 1,
        pageSize: limit,
        kind,
        status,
        unacknowledgedOnly: unread || undefined,
        archived,
        search,
      })

      return {
        items: result.items.map(row => {
          const submission = serializeSubmission(row)
          return {
            ...submission,
            message: clip(submission.message, 'get_submission'),
          }
        }),
        hasMore: result.totalCount > result.items.length,
        totalCount: result.totalCount,
      }
    },
  })

  defineTool(server, {
    name: 'get_submission',
    title: 'Get form submission',
    description:
      'One website form submission in full: the message, and for an audit the answers and the result the visitor was shown.',
    effect: 'read',
    input: {
      submissionId: z.uuid().describe('Submission UUID.'),
    },
    run: async ({ submissionId }, { user }) => ({
      submission: serializeSubmissionDetail(
        await fetchFormSubmissionById(user, submissionId, true)
      ),
    }),
  })
}
