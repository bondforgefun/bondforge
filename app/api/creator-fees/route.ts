import { NextRequest, NextResponse } from 'next/server'
import { readCreatorFees } from '@/lib/bondforge/creator-fees'

export async function GET(request: NextRequest) {
  const issuer = request.nextUrl.searchParams.get('issuer') || ''
  if (!issuer) {
    return NextResponse.json({ error: 'missing issuer' }, { status: 400 })
  }

  try {
    const payload = await readCreatorFees(issuer)
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'creator fee read failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
