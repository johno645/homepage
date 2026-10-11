import type { K8sResponse } from './kubernetes-discovery.ts';

export function namespaceAccess(groupsHeader: string | null, rawPolicy: string | undefined, proxyEnabled: boolean): Set<string> | undefined {
  if (!rawPolicy || rawPolicy === '{}') return undefined;
  const policy: unknown = JSON.parse(rawPolicy);
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new Error('Invalid namespace access policy.');
  for (const namespaces of Object.values(policy)) {
    if (!Array.isArray(namespaces) || namespaces.some(n => typeof n !== 'string' || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(n))) throw new Error('Invalid namespace access policy.');
  }
  if (!Object.keys(policy).length) return undefined;
  if (!proxyEnabled) throw new Error('Namespace access policy requires the authentication proxy.');
  const groups = (groupsHeader ?? '').split(',').map(g => g.trim()).filter(Boolean);
  return new Set(groups.flatMap(g => (policy as Record<string, string[]>)[g] ?? []));
}

export function restrictNamespaces(data: K8sResponse, namespaces: Set<string> | undefined): K8sResponse {
  if (!namespaces) return data;
  return {
    ...data,
    // Cluster-wide discovery diagnostics may name namespaces outside the user's scope.
    warnings: data.warnings.length ? ['Some discovery operations failed. Contact the dashboard administrator.'] : [],
    ingresses: data.ingresses.filter(l => namespaces.has(l.namespace)).map(link => {
      if (link.backends.every(b => namespaces.has(b.namespace))) return link;
      const { health: omittedHealth, ...visible } = link;
      void omittedHealth;
      return { ...visible, backends: link.backends.filter(b => namespaces.has(b.namespace)), issues: [...link.issues, 'Backend health is restricted by namespace access policy.'] };
    }),
  };
}
