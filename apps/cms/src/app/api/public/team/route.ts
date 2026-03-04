import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function GET() {
  try {
    const members = await prisma.teamMember.findMany({
      orderBy: [{ type: 'asc' }, { order: 'asc' }],
    })

    return NextResponse.json(members, { headers: corsHeaders })
  } catch (error) {
    console.error('Public team GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: corsHeaders,
  })
}
