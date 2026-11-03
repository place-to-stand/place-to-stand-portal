import { NextRequest, NextResponse } from 'next/server'
import { listBranches } from '@/lib/github/client'
import { authorizeRoute } from '@/lib/auth/guard'

/**
 * GET /api/github/repos/[owner]/[repo]/branches
 * List branches for a GitHub repository
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<'/api/github/repos/[owner]/[repo]/branches'>
) {
  const { user, denied } = await authorizeRoute('projects.manage')
  if (denied) return denied
  const { owner, repo } = await params

  try {
    const branches = await listBranches(user.id, owner, repo)

    return NextResponse.json({
      branches: branches.map(b => ({
        name: b.name,
        protected: b.protected,
      })),
    })
  } catch (error) {
    console.error('Failed to list branches:', error)
    return NextResponse.json(
      { error: 'Failed to list branches' },
      { status: 500 }
    )
  }
}
