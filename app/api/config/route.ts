import { NextResponse } from 'next/server';
import linksConfig from '../../../links.config.json';

export async function GET() {
  // Check for Helm/K8s config from environment variable
  if (process.env.HOMEPAGE_LINKS) {
    try {
      const helmConfig = JSON.parse(process.env.HOMEPAGE_LINKS);
      return NextResponse.json(helmConfig);
    } catch (e) {
      console.error('Failed to parse HOMEPAGE_LINKS:', e);
    }
  }
  
  // Fall back to static config
  return NextResponse.json(linksConfig);
}

