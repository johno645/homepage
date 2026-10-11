import assert from 'node:assert/strict';
import test from 'node:test';
import { extractHttpRouteLinks, extractIngressLinks } from '../lib/kubernetes-routes.ts';

test('matches Ingress TLS hosts individually and normalizes paths', () => {
  const links = extractIngressLinks([{
    metadata: { name: 'web', namespace: 'apps' },
    spec: {
      tls: [{ hosts: ['secure.example.com'] }],
      rules: [
        { host: 'secure.example.com', http: { paths: [{ path: 'docs' }] } },
        { host: 'plain.example.com' },
      ],
    },
  }]);

  assert.deepEqual(links.map(({ url }) => url), [
    'https://secure.example.com/docs',
    'http://plain.example.com',
  ]);
});

test('matches wildcard Ingress TLS hosts', () => {
  const links = extractIngressLinks([{
    spec: {
      tls: [{ hosts: ['*.example.com'] }],
      rules: [{ host: 'app.example.com' }],
    },
  }]);

  assert.equal(links[0].url, 'https://app.example.com');
});

test('uses the protocol of the referenced Gateway listener', () => {
  const route = {
    metadata: { name: 'web', namespace: 'apps' },
    spec: {
      parentRefs: [{ name: 'edge', namespace: 'infra', sectionName: 'web-http' }],
      hostnames: ['app.example.com'],
      rules: [{ matches: [{ path: { type: 'PathPrefix', value: '/docs' } }] }],
    },
  };
  const gateways = [{
    metadata: { name: 'edge', namespace: 'infra' },
    spec: { listeners: [{ name: 'web-http', protocol: 'HTTP' }] },
  }];

  assert.equal(extractHttpRouteLinks([route], gateways)[0].url, 'http://app.example.com/docs');
});

test('keeps both schemes when a route attaches to HTTP and HTTPS listeners', () => {
  const route = {
    spec: {
      parentRefs: [{ name: 'edge', namespace: 'infra' }],
      hostnames: ['app.example.com'],
    },
  };
  const gateways = [{
    metadata: { name: 'edge', namespace: 'infra' },
    spec: { listeners: [
      { name: 'http', protocol: 'HTTP' },
      { name: 'https', protocol: 'HTTPS' },
    ] },
  }];

  assert.deepEqual(
    extractHttpRouteLinks([route], gateways).map(({ url }) => url).sort(),
    ['http://app.example.com', 'https://app.example.com'],
  );
});

test('separates passthrough from TLS termination and HTTPS upstreams', () => {
  const base = { metadata: { name: 'api', annotations: {
    'nginx.ingress.kubernetes.io/ssl-passthrough': 'true',
    'nginx.ingress.kubernetes.io/backend-protocol': 'HTTPS',
  } }, spec: { rules: [{ host: 'api.example.com' }] } };
  const passthrough = extractIngressLinks([base])[0];
  assert.ok(passthrough.tags.includes('TLS passthrough'));
  assert.ok(!passthrough.tags.includes('TLS termination'));
  assert.ok(!passthrough.tags.includes('TLS re-encryption'));
  base.metadata.annotations['nginx.ingress.kubernetes.io/ssl-passthrough'] = 'false';
  base.spec.tls = [{ hosts: ['api.example.com'] }];
  const termination = extractIngressLinks([base])[0];
  assert.ok(termination.tags.includes('TLS termination'));
  assert.ok(termination.tags.includes('HTTPS backend'));
  assert.ok(termination.tags.includes('TLS re-encryption'));
});

test('does not invent a backend protocol or navigate wildcard and regex routes', () => {
  const result = extractIngressLinks([{
    metadata: { annotations: { 'nginx.ingress.kubernetes.io/use-regex': 'true' } },
    spec: { rules: [{ host: '*.example.com', http: { paths: [{ path: '/api/(.*)' }] } }] },
  }])[0];
  assert.ok(result.tags.includes('Backend TLS unknown'));
  assert.equal(result.linkable, false);
  assert.ok(!result.url.includes('(.*)'));
});

test('metadata annotations support tools and hide resources', () => {
  const resource = { metadata: { annotations: {
    'homepage.dev/title': 'Orders', 'homepage.dev/team': 'Commerce',
    'homepage.dev/tags': 'internal, critical',
    'homepage.dev/repository': 'https://github.com/example/orders',
    'homepage.dev/runbook': 'javascript:alert(1)',
  } }, spec: { rules: [{ host: 'orders.example.com' }] } };
  const result = extractIngressLinks([resource])[0];
  assert.equal(result.title, 'Orders');
  assert.equal(result.team, 'Commerce');
  assert.ok(result.tags.includes('critical'));
  assert.ok(result.tools.repository);
  assert.equal(result.tools.runbook, undefined);
  resource.metadata.annotations['homepage.dev/hidden'] = 'true';
  assert.equal(extractIngressLinks([resource]).length, 0);
});

const gateway = { metadata: { name: 'edge', namespace: 'infra' }, spec: { listeners: [{ name: 'https', protocol: 'HTTPS', port: 8443, hostname: '*.example.com', tls: { mode: 'Terminate' } }] } };
const attachedRoute = { metadata: { name: 'orders', namespace: 'apps' }, spec: { parentRefs: [{ name: 'edge', namespace: 'infra', sectionName: 'https' }], hostnames: ['orders.example.com'], rules: [{ backendRefs: [{ name: 'orders', port: 443 }] }] } };

test('matches listener hostname and port and exposes policy intent', () => {
  const policies = [{ metadata: { namespace: 'apps' }, spec: { targetRefs: [{ kind: 'Service', name: 'orders' }] } }];
  const result = extractHttpRouteLinks([attachedRoute], [gateway], policies)[0];
  assert.equal(result.url, 'https://orders.example.com:8443');
  assert.ok(result.tags.includes('TLS termination'));
  assert.ok(result.tags.includes('HTTPS backend configured'));
});

test('inherits listener hostnames when a route has no explicit hostname', () => {
  const route = structuredClone(attachedRoute);
  delete route.spec.hostnames;
  const g = structuredClone(gateway);
  g.spec.listeners[0].hostname = 'orders.example.com';
  assert.equal(extractHttpRouteLinks([route], [g])[0].url, 'https://orders.example.com:8443');
});

test('unavailable and mismatching listeners do not produce clickable invented endpoints', () => {
  const unresolved = extractHttpRouteLinks([attachedRoute], [])[0];
  assert.equal(unresolved.url, '');
  assert.equal(unresolved.linkable, false);
  const route = structuredClone(attachedRoute);
  route.spec.hostnames = ['elsewhere.invalid'];
  assert.equal(extractHttpRouteLinks([route], [gateway])[0].linkable, false);
});

test('rejected routes show controller diagnostics', () => {
  const route = structuredClone(attachedRoute);
  route.status = { parents: [{ parentRef: route.spec.parentRefs[0], conditions: [{ type: 'Accepted', status: 'False', reason: 'NotAllowedByListeners', message: 'namespace denied' }] }] };
  const result = extractHttpRouteLinks([route], [gateway])[0];
  assert.ok(result.issues.some(i => i.includes('namespace denied')));
  assert.ok(result.tags.includes('Needs attention'));
});

test('TLSRoute passthrough is not advertised as an HTTP app', () => {
  const g = structuredClone(gateway);
  g.spec.listeners[0].protocol = 'TLS';
  g.spec.listeners[0].tls.mode = 'Passthrough';
  const result = extractHttpRouteLinks([attachedRoute], [g], [], 'TLSRoute')[0];
  assert.ok(result.tags.includes('TLS passthrough'));
  assert.equal(result.url, '');
  assert.equal(result.endpoint, 'tls://orders.example.com:8443');
  assert.equal(result.linkable, false);
  assert.ok(!result.tags.includes('TLS termination'));
});

test('Gateway wildcard hostname matches suffixes while Ingress certificate wildcard is one label', () => {
  const route = structuredClone(attachedRoute);
  route.spec.hostnames = ['orders.dev.example.com'];
  assert.equal(extractHttpRouteLinks([route], [gateway])[0].url, 'https://orders.dev.example.com:8443');
  const ingress = extractIngressLinks([{ spec: { tls: [{ hosts: ['*.example.com'] }], rules: [{ host: 'orders.dev.example.com' }] } }])[0];
  assert.equal(ingress.url, 'http://orders.dev.example.com');
});
