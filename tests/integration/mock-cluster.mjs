import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function mockCluster(port = 0) {
  const fixture = JSON.parse(await readFile(new URL('../fixtures/cluster.json', import.meta.url), 'utf8'));
  const resources = {
    'networking.k8s.io/v1': { Ingress: 'ingresses' },
    'gateway.networking.k8s.io/v1': { Gateway: 'gateways', HTTPRoute: 'httproutes', BackendTLSPolicy: 'backendtlspolicies' },
    'gateway.networking.k8s.io/v1alpha2': { TLSRoute: 'tlsroutes' },
    v1: { Service: 'services', Pod: 'pods', Event: 'events' },
    'apps/v1': { Deployment: 'deployments', ReplicaSet: 'replicasets', StatefulSet: 'statefulsets', DaemonSet: 'daemonsets' },
    'discovery.k8s.io/v1': { EndpointSlice: 'endpointslices' },
    'metrics.k8s.io/v1beta1': { PodMetrics: 'pods' },
  };
  const requests = [];
  const failures = new Map();
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    requests.push(url);
    res.setHeader('Content-Type', 'application/json');
    for (const [version, kinds] of Object.entries(resources)) {
      const prefix = version === 'v1' ? '/api/v1' : `/apis/${version}`;
      if (url.pathname === prefix) return res.end(JSON.stringify({ kind: 'APIResourceList', apiVersion: 'v1', groupVersion: version, resources: Object.entries(kinds).map(([kind, name]) => ({ name, kind, namespaced: true, verbs: ['get', 'list'] })) }));
      for (const [kind, plural] of Object.entries(kinds)) {
        if (!url.pathname.startsWith(`${prefix}/`) || !url.pathname.endsWith(`/${plural}`)) continue;
        if (failures.has(kind)) { res.statusCode = failures.get(kind); return res.end(JSON.stringify({ kind: 'Status', apiVersion: 'v1', status: 'Failure', reason: 'Forbidden', code: res.statusCode })); }
        const namespace = url.pathname.match(/\/namespaces\/([^/]+)\//)?.[1];
        const selector = url.searchParams.get('labelSelector');
        const items = fixture[kind].filter(item => (!namespace || item.metadata.namespace === namespace) && (!selector || selector.split(',').every(pair => { const [key, value] = pair.split('='); return item.metadata.labels?.[key] === value; })));
        return res.end(JSON.stringify({ kind: `${kind}List`, apiVersion: version, metadata: {}, items }));
      }
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ kind: 'Status', apiVersion: 'v1', code: 404, reason: 'NotFound' }));
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  const directory = await mkdtemp(join(tmpdir(), 'homepage-mock-'));
  const kubeconfig = join(directory, 'config');
  await writeFile(kubeconfig, JSON.stringify({ apiVersion: 'v1', kind: 'Config', clusters: [{ name: 'mock', cluster: { 'insecure-skip-tls-verify': true, server: `http://127.0.0.1:${server.address().port}` } }], contexts: [{ name: 'mock', context: { cluster: 'mock', user: 'mock' } }], users: [{ name: 'mock', user: {} }], 'current-context': 'mock' }));
  return { server, kubeconfig, requests, failures };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mock = await mockCluster(Number(process.env.MOCK_PORT || 3101));
  console.log(`Mock Kubernetes API ready. KUBECONFIG=${mock.kubeconfig}`);
}
