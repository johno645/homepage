import { NextResponse, type NextRequest } from 'next/server';
import { discoveryConfig } from '@/lib/discovery-config';
import { discover, type K8sResponse } from '@/lib/kubernetes-discovery';

import { namespaceAccess, restrictNamespaces } from '@/lib/namespace-access';

export const dynamic = 'force-dynamic';
let cache: { expires: number; data: K8sResponse } | undefined;
let pending: Promise<K8sResponse> | undefined;

export async function GET(request: NextRequest) {
  let namespaces: Set<string> | undefined;
  try {
    namespaces = namespaceAccess(request.headers.get('x-forwarded-groups'), process.env.HOMEPAGE_GROUP_NAMESPACES, process.env.HOMEPAGE_AUTH_PROXY === 'true');
  } catch {
    return NextResponse.json({ error: 'Dashboard access policy is not configured correctly.' }, { status: 503 });
  }
  if (namespaces && !namespaces.size) return NextResponse.json({ error: 'Your account has no permitted dashboard namespaces.' }, { status: 403 });
  try {
    if (cache && cache.expires > Date.now()) return NextResponse.json(restrictNamespaces(cache.data, namespaces), { headers: { 'Cache-Control': 'private, no-store' } });
    if (!pending) pending = discover();
    const data = await pending;
    cache = { data, expires: Date.now() + discoveryConfig().cacheSeconds * 1000 };
    return NextResponse.json(restrictNamespaces(data, namespaces), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Kubernetes discovery failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to connect to the Kubernetes API.' }, { status: 503 });
  } finally { pending = undefined; }
}
