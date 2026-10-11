import { NextResponse } from 'next/server';
export function GET() {
  // Cluster outages should not remove the dashboard's diagnostics from service.
  return NextResponse.json({ status: 'ready' });
}
