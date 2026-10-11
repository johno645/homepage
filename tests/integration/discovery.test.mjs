import assert from 'node:assert/strict';
import test from 'node:test';
import { KubeConfig } from '@kubernetes/client-node';
import { discover } from '../../lib/kubernetes-discovery.ts';
import { discoveryConfig } from '../../lib/discovery-config.ts';
import { mockCluster } from './mock-cluster.mjs';

test('real SDK discovers scoped routes, TLS fallback versions and workload health', async t => {
  const mock = await mockCluster();
  t.after(() => new Promise(resolve => mock.server.close(resolve)));
  const kubeconfig = new KubeConfig();
  kubeconfig.loadFromFile(mock.kubeconfig);
  const config = discoveryConfig({ HOMEPAGE_NAMESPACES: 'apps,infra', HOMEPAGE_LABEL_SELECTOR: 'dashboard=true', HOMEPAGE_HEALTH_ENABLED: 'true', HOMEPAGE_METRICS_ENABLED: 'true' });
  const result = await discover(config, kubeconfig);
  assert.equal(result.ingresses.length, 3);
  const orders = result.ingresses.find(l => l.kind === 'Ingress');
  assert.equal(orders.health.state, 'healthy');
  assert.equal(orders.health.rollouts[0].kind, 'Deployment');
  assert.equal(orders.health.cpuMillicores, 120);
  assert.ok(result.ingresses.find(l => l.kind === 'TLSRoute').tags.includes('TLS passthrough'));
  assert.ok(mock.requests.some(r => r.pathname.includes('/v1alpha2/namespaces/apps/tlsroutes')));
  assert.ok(mock.requests.filter(r => r.pathname.endsWith('/ingresses')).every(r => r.pathname.includes('/namespaces/') && r.searchParams.get('labelSelector') === 'dashboard=true'));
});

test('partial RBAC errors retain available routes and disabled discovery makes no requests', async t => {
  const mock = await mockCluster();
  t.after(() => new Promise(resolve => mock.server.close(resolve)));
  const kubeconfig = new KubeConfig();
  kubeconfig.loadFromFile(mock.kubeconfig);
  mock.failures.set('Ingress', 403);
  const result = await discover(discoveryConfig({}), kubeconfig);
  assert.equal(result.ingresses.length, 2);
  assert.ok(result.warnings.some(w => w.includes('Ingress')));
  const requestCount = mock.requests.length;
  assert.equal((await discover(discoveryConfig({ HOMEPAGE_K8S_ENABLED: 'false' }), kubeconfig)).enabled, false);
  assert.equal(mock.requests.length, requestCount);
});
