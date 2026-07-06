import { NextRequest, NextResponse } from 'next/server';
import { getPublicApiUrl } from '@/lib/public-api-url';
import { buildEmbedSnippet } from '@/lib/embed-snippet';

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');
  const publicApiUrl = getPublicApiUrl();
  return NextResponse.json({
    publicApiUrl,
    embedSnippet: siteId ? buildEmbedSnippet(siteId, publicApiUrl) : undefined,
  });
}
