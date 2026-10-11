import { NextResponse } from 'next/server';
import linksConfig from '../../../links.config.json';
import type { LinksConfig } from '@/types/config';
import { resolveLinksConfig } from '@/lib/config';

export async function GET() {
  const config = resolveLinksConfig(process.env.HOMEPAGE_LINKS, linksConfig as LinksConfig);
  return NextResponse.json(config);
}
