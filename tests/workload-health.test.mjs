import assert from 'node:assert/strict';
import test from 'node:test';
import { attachHealth } from '../lib/workload-health.ts';
import { extractIngressLinks } from '../lib/kubernetes-routes.ts';

function links() { return extractIngressLinks([{ metadata: { name: 'web', namespace: 'apps' }, spec: { rules: [{ host: 'web.example.com', http: { paths: [{ backend: { service: { name: 'web', port: { number: 80 } } } }] } }] } }]); }
const service = { metadata: { name: 'web', namespace: 'apps' }, spec: { selector: { app: 'web' } } };
const pod = { metadata: { name: 'web-123', namespace: 'apps', labels: { app: 'web' }, ownerReferences: [{ kind: 'ReplicaSet', name: 'web' }] }, spec: { containers: [{ image: 'web:v1' }] }, status: { phase: 'Running', conditions: [{ type: 'Ready', status: 'True' }], containerStatuses: [{ restartCount: 2 }] } };
const slice = { metadata: { namespace: 'apps', labels: { 'kubernetes.io/service-name': 'web' } }, endpoints: [{ conditions: { ready: true }, targetRef: { kind: 'Pod', name: 'web-123' } }] };

test('joins namespace scoped Services, EndpointSlices and pods with metrics', () => {
  const result = links();
  const otherNamespacePod = structuredClone(pod);
  otherNamespacePod.metadata.namespace = 'other';
  attachHealth(result, [service], [pod, otherNamespacePod], [slice], [], [{ metadata: { name: 'web-123', namespace: 'apps' }, containers: [{ usage: { cpu: '125000000n', memory: '128Mi' } }] }]);
  assert.equal(result[0].health.state, 'healthy');
  assert.equal(result[0].health.total, 1);
  assert.equal(result[0].health.restarts, 2);
  assert.equal(result[0].health.cpuMillicores, 125);
  assert.equal(result[0].health.memoryMiB, 128);
});

test('missing backend and crashloop events are visible', () => {
  const missing = links();
  attachHealth(missing, [], [], [], []);
  assert.notEqual(missing[0].health.state, 'healthy');
  const result = links();
  const crashing = structuredClone(pod);
  crashing.status.conditions[0].status = 'False';
  crashing.status.containerStatuses[0].state = { waiting: { reason: 'CrashLoopBackOff' } };
  attachHealth(result, [service], [crashing], [slice], [{ metadata: { namespace: 'apps' }, involvedObject: { kind: 'Pod', name: 'web-123' }, type: 'Warning', reason: 'BackOff', message: 'restarting container' }]);
  assert.equal(result[0].health.state, 'warning');
  assert.ok(result[0].health.warnings.some(w => w.includes('CrashLoopBackOff')));
  assert.ok(result[0].health.warnings.some(w => w.includes('restarting container')));
});
