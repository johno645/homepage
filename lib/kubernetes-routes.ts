export interface BackendRef {
  name: string;
  namespace: string;
  port?: string | number;
  kind: string;
}

export interface WorkloadHealth {
  state: 'healthy' | 'warning' | 'unknown';
  ready: number;
  total: number;
  restarts: number;
  workloads: string[];
  rollouts: { name: string; kind: string; ready: number; desired: number; updated: number }[];
  images: string[];
  warnings: string[];
  cpuMillicores?: number;
  memoryMiB?: number;
}

export interface IngressLink {
  id: string;
  title: string;
  url: string;
  endpoint: string;
  linkable: boolean;
  description: string;
  namespace: string;
  name: string;
  kind: string;
  tags: string[];
  evidence: string[];
  issues: string[];
  icon?: string;
  team?: string;
  environment?: string;
  tools: Record<string, string>;
  backends: BackendRef[];
  health?: WorkloadHealth;
}

export type Resource = Record<string, unknown>;
export function record(value: unknown): Resource {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Resource : {};
}
export function array(value: unknown): Resource[] {
  return Array.isArray(value) ? value.map(record) : [];
}
export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value ? value : fallback;
}
export function metadata(value: unknown) {
  const meta = record(record(value).metadata);
  return { name: str(meta.name, 'unknown'), namespace: str(meta.namespace, 'default'), annotations: record(meta.annotations) };
}
export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = new URL(value);
    if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) return value;
  } catch { /* An invalid URL is not a dashboard link. */ }
  return undefined;
}
function hostMatches(pattern: string, host: string): boolean {
  if (pattern === host) return true;
  if (!pattern.startsWith('*.') || host.startsWith('*.')) return false;
  return host.endsWith(pattern.slice(1)) && host.split('.').length === pattern.split('.').length;
}
function gatewayHostMatches(pattern: string, host: string): boolean {
  return pattern === host || pattern.startsWith('*.') && host.endsWith(pattern.slice(1));
}
function intersectHost(a: string, b: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  if (gatewayHostMatches(a, b)) return b;
  if (gatewayHostMatches(b, a)) return a;
  if (a.startsWith('*.') && b.startsWith('*.')) {
    if (a.endsWith(b.slice(1))) return a;
    if (b.endsWith(a.slice(1))) return b;
  }
  return undefined;
}
function backend(value: unknown, namespace: string): BackendRef {
  const ref = record(value);
  return { name: str(ref.name), namespace: str(ref.namespace, namespace), kind: str(ref.kind, 'Service'), ...(typeof ref.port === 'number' || typeof ref.port === 'string' ? { port: ref.port } : {}) };
}
function makeLink(resource: Resource, kind: string, url: string, path: string, tags: string[], backends: BackendRef[], evidence: string[] = [], issues: string[] = [], linkable = true): IngressLink | undefined {
  const { name, namespace, annotations: a } = metadata(resource);
  if (a['homepage.dev/hidden'] === 'true') return undefined;
  const tools: Record<string, string> = {};
  for (const tool of ['repository', 'runbook', 'ci', 'gitops', 'metrics', 'logs', 'traces']) {
    const value = safeUrl(a[`homepage.dev/${tool}`]);
    if (value) tools[tool] = value;
  }
  const override = safeUrl(a['homepage.dev/url']);
  const candidate = override ?? (kind === 'TLSRoute' ? '' : safeUrl(url) ?? '');
  return {
    id: `${kind}:${namespace}:${name}:${url}:${path}:${backends.map(b => `${b.namespace}/${b.name}:${b.port ?? ''}`).join(',')}`,
    title: str(a['homepage.dev/title'], name),
    description: str(a['homepage.dev/description'], `${kind}: ${name}${path ? ` · ${path}` : ''}`),
    url: candidate,
    endpoint: override ?? (kind === 'TLSRoute' ? url.replace(/^https?:\/\//, 'tls://') : candidate),
    linkable: !!candidate && (!!override || linkable),
    name, namespace, kind, backends,
    tags: [...new Set([kind, ...tags, ...str(a['homepage.dev/tags']).split(',').map(t => t.trim()).filter(Boolean)])],
    evidence, issues,
    icon: str(a['homepage.dev/icon'], 'k8s'),
    team: str(a['homepage.dev/team']) || undefined,
    environment: str(a['homepage.dev/environment']) || undefined,
    tools,
  };
}

export function extractIngressLinks(ingresses: unknown[]): IngressLink[] {
  const links: IngressLink[] = [];
  for (const value of ingresses) {
    const ingress = record(value);
    const spec = record(ingress.spec);
    const { namespace, annotations: a } = metadata(ingress);
    const tlsHosts = array(spec.tls).flatMap(t => Array.isArray(t.hosts) ? t.hosts.filter((h): h is string => typeof h === 'string') : []);
    const passthrough = a['nginx.ingress.kubernetes.io/ssl-passthrough'] === 'true';
    const protocol = str(a['nginx.ingress.kubernetes.io/backend-protocol'], str(a['alb.ingress.kubernetes.io/backend-protocol'])).toUpperCase();
    for (const rule of array(spec.rules)) {
      const host = str(rule.host);
      if (!host) continue;
      const tls = passthrough || tlsHosts.some(h => hostMatches(h, host));
      const paths = array(record(rule.http).paths);
      for (const p of paths.length ? paths : [{}]) {
        const raw = str(p.path);
        const regex = a['nginx.ingress.kubernetes.io/use-regex'] === 'true';
        const path = regex ? '' : raw && !raw.startsWith('/') ? `/${raw}` : raw;
        const service = record(record(p.backend).service);
        const servicePort = record(service.port);
        const refs = service.name ? [backend({ ...service, port: servicePort.number ?? servicePort.name }, namespace)] : [];
        const tags = [tls ? 'HTTPS frontend' : 'HTTP frontend', passthrough ? 'TLS passthrough' : tls ? 'TLS termination' : 'No frontend TLS'];
        const evidence = ['Frontend TLS: Ingress spec.tls host matching'];
        if (passthrough) evidence.push('Passthrough requested: nginx.ingress.kubernetes.io/ssl-passthrough (controller support required)');
        if (protocol) {
          tags.push(`${protocol} backend`);
          evidence.push(`Backend protocol annotation: ${protocol}`);
          if (tls && !passthrough && ['HTTPS', 'GRPCS'].includes(protocol)) tags.push('TLS re-encryption');
        } else tags.push(passthrough ? 'Encrypted backend stream' : 'Backend TLS unknown');
        if (spec.ingressClassName) tags.push(`Class: ${spec.ingressClassName}`);
        if (regex) tags.push('Regex path');
        const issues = host.includes('*') ? ['Wildcard hostname requires a concrete host.'] : [];
        if (regex) issues.push(`Regex path is not a navigable URL: ${raw}`);
        const link = makeLink(ingress, 'Ingress', `${tls ? 'https' : 'http'}://${host}${path}`, raw, tags, refs, evidence, issues, !host.includes('*') && !regex);
        if (link) links.push(link);
      }
    }
  }
  return links;
}

export function extractHttpRouteLinks(routes: unknown[], gateways: unknown[], policies: unknown[] = [], kind = 'HTTPRoute'): IngressLink[] {
  const links: IngressLink[] = [];
  for (const value of routes) {
    const route = record(value);
    const spec = record(route.spec);
    const { namespace } = metadata(route);
    const hosts = Array.isArray(spec.hostnames) ? spec.hostnames.filter((h): h is string => typeof h === 'string') : [];
    const parents = array(spec.parentRefs);
    const rules = array(spec.rules);
    for (const parent of parents.length ? parents : [{}]) {
      if (parent.kind && parent.kind !== 'Gateway' || parent.group && parent.group !== 'gateway.networking.k8s.io') continue;
      const parentNs = str(parent.namespace, namespace);
      const gateway = gateways.map(record).find(g => metadata(g).name === parent.name && metadata(g).namespace === parentNs);
      const listeners = array(record(gateway?.spec).listeners).filter(l =>
        (!parent.sectionName || l.name === parent.sectionName) && (!parent.port || l.port === parent.port)
        && (kind === 'TLSRoute' ? l.protocol === 'TLS' : l.protocol === 'HTTP' || l.protocol === 'HTTPS'));
      const status = array(record(route.status).parents).find(p => {
        const ref = record(p.parentRef);
        return ref.name === parent.name && str(ref.namespace, namespace) === parentNs && ref.sectionName === parent.sectionName;
      });
      const conditions = array(status?.conditions);
      const issues = conditions.filter(c => ['Accepted', 'ResolvedRefs'].includes(str(c.type)) && c.status !== 'True').map(c => `${c.type}: ${str(c.reason)} ${str(c.message)}`);
      if (!conditions.length) issues.push('Route acceptance has not been reported.');
      if (!listeners.length) issues.push('Gateway listener unavailable or incompatible; endpoint scheme is unknown.');
      for (const listener of listeners.length ? listeners : [{}]) {
        const listenerHost = str(listener.hostname);
        const effectiveHosts = [...new Set((hosts.length ? hosts : [listenerHost]).map(h => intersectHost(h, listenerHost)).filter((h): h is string => !!h))];
        if (!effectiveHosts.length) effectiveHosts.push('');
        const scheme = listener.protocol === 'HTTP' ? 'http' : listener.protocol ? 'https' : '';
        const port = typeof listener.port === 'number' && listener.port !== (scheme === 'http' ? 80 : 443) ? `:${listener.port}` : '';
        const passthrough = record(listener.tls).mode === 'Passthrough';
        for (const rule of rules.length ? rules : [{}]) {
          const refs = array(rule.backendRefs).map(b => backend(b, namespace));
          const encrypted = refs.filter(b => policies.some(p => {
            const policy = record(p);
            return metadata(policy).namespace === b.namespace && array(record(policy.spec).targetRefs).some(t => t.name === b.name && str(t.kind, 'Service') === b.kind && (!t.group || t.group === '') && (!t.sectionName || t.sectionName === b.port));
          }));
          const matches = array(rule.matches);
          for (const match of matches.length ? matches : [{}]) {
            const pathSpec = record(match.path);
            const regex = pathSpec.type === 'RegularExpression';
            const raw = str(pathSpec.value);
            const path = regex ? '' : raw && !raw.startsWith('/') ? `/${raw}` : raw;
            const filters = array(rule.filters);
            const redirect = filters.some(f => f.type === 'RequestRedirect');
            const tags = [listener.protocol === 'TLS' ? 'TLS frontend' : scheme ? `${scheme.toUpperCase()} frontend` : 'Frontend TLS unknown'];
            if (passthrough) tags.push('TLS passthrough', 'Encrypted backend stream');
            else if (scheme === 'https') tags.push('TLS termination');
            if (!passthrough) {
              tags.push(encrypted.length ? encrypted.length === refs.length ? kind === 'TLSRoute' ? 'TLS backend configured' : 'HTTPS backend configured' : 'Mixed backend TLS' : 'Backend TLS unknown');
              if (scheme === 'https' && encrypted.length) tags.push('TLS re-encryption configured');
            }
            if (redirect) tags.push('Redirect');
            if (regex) tags.push('Regex path');
            if (match.method) tags.push(`Method: ${match.method}`);
            if (array(match.headers).length) tags.push('Header match');
            if (array(match.queryParams).length) tags.push('Query match');
            if (conditions.some(c => c.type === 'Accepted' && c.status === 'True')) tags.push('Accepted');
            if (issues.length) tags.push('Needs attention');
            const evidence = [`Gateway: ${parentNs}/${str(parent.name, 'unknown')} · Listener: ${str(listener.name, 'unknown')}`];
            if (listener.protocol) evidence.push(`Listener protocol: ${listener.protocol}; TLS mode: ${str(record(listener.tls).mode, scheme === 'https' ? 'Terminate' : 'none')}`);
            if (encrypted.length) evidence.push('BackendTLSPolicy targets backend Service; configured intent, not an observed handshake.');
            for (const host of effectiveHosts) {
              const localIssues = [...issues];
              if (!host) localIssues.push('No concrete hostname can be derived.');
              if (host.includes('*')) localIssues.push('Wildcard hostname requires a concrete host.');
              if (regex) localIssues.push(`Regex path is not a navigable URL: ${raw}`);
              if (kind === 'TLSRoute') localIssues.push('TLSRoute may carry a non-HTTP protocol; set homepage.dev/url for a browser link.');
              const link = makeLink(route, kind, scheme && host ? `${scheme}://${host}${port}${path}` : '', raw, tags, refs, evidence, localIssues, !!scheme && !!host && !host.includes('*') && !regex && kind !== 'TLSRoute' && !conditions.some(c => c.type === 'Accepted' && c.status === 'False') && (!match.method || match.method === 'GET') && !array(match.headers).length && !array(match.queryParams).length);
              if (link) links.push(link);
            }
          }
        }
      }
    }
  }
  return [...new Map(links.map(l => [l.id, l])).values()];
}
