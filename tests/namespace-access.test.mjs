import assert from 'node:assert/strict';
import test from 'node:test';
import { namespaceAccess, restrictNamespaces } from '../lib/namespace-access.ts';
import { extractIngressLinks } from '../lib/kubernetes-routes.ts';

test('namespace access is denied without mapped groups or a trusted proxy deployment', () => {
  assert.throws(() => namespaceAccess('devs', '{"devs":["apps"]}', false));
  assert.equal(namespaceAccess(null, '{"devs":["apps"]}', true).size, 0);
  assert.deepEqual([...namespaceAccess('devs, ops', '{"devs":["apps"],"ops":["infra"]}', true)], ['apps', 'infra']);
  assert.throws(() => namespaceAccess('devs', '{"devs":"apps"}', true));
});

test('user filtering preserves shared snapshot and hides cross-scope health', () => {
  const links = extractIngressLinks(['apps', 'private'].map(namespace => ({ metadata: { name: 'web', namespace }, spec: { rules: [{ host: `${namespace}.example.com` }] } })));
  links[0].backends = [{ kind: 'Service', name: 'secret-backend', namespace: 'private' }];
  links[0].health = { state: 'healthy', images: ['private-image'] };
  const data = { ingresses: links, warnings: ['Unable to read pods in private'] };
  const filtered = restrictNamespaces(data, new Set(['apps']));
  assert.equal(filtered.ingresses.length, 1);
  assert.equal(filtered.ingresses[0].health, undefined);
  assert.equal(filtered.ingresses[0].backends.length, 0);
  assert.ok(!filtered.warnings.join('').includes('private'));
  assert.equal(data.ingresses.length, 2);
  assert.ok(data.ingresses[0].health);
});
