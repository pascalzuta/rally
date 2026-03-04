import { NextResponse } from 'next/server'
import { getSessionFromCookies, isFullyAuthenticated } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getSessionFromCookies()
  if (!isFullyAuthenticated(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [
      teamMembers,
      newsPosts,
      newsPublished,
      newsDraft,
      mediaFiles,
      linkedInPosts,
      contentPages,
    ] = await Promise.all([
      prisma.teamMember.count(),
      prisma.newsPost.count(),
      prisma.newsPost.count({ where: { status: 'published' } }),
      prisma.newsPost.count({ where: { status: 'draft' } }),
      prisma.mediaAsset.count(),
      prisma.linkedInPost.count(),
      prisma.contentArea.findMany({
        select: { page: true },
        distinct: ['page'],
      }),
    ])

    return NextResponse.json({
      teamMembers,
      newsPosts,
      newsPublished,
      newsDraft,
      mediaFiles,
      linkedInPosts,
      contentPages: contentPages.length,
    })
  } catch (error) {
    console.error('Stats GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
