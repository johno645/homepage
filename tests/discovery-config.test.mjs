import assert from 'node:assert/strict';
import test from 'node:test';
import { discoveryConfig } from '../lib/discovery-config.ts';

test('discovery switches, scopes and timing limits are enforced', () => {
  const config = discoveryConfig({ HOMEPAGE_K8S_ENABLED: 'false', HOMEPAGE_NAMESPACES: 'apps, infra,apps', HOMEPAGE_REFRESH_SECONDS: '1', HOMEPAGE_CACHE_SECONDS: '-1', HOMEPAGE_HEALTH_ENABLED: 'true' });
  assert.equal(config.enabled, false);
  assert.deepEqual(config.namespaces, ['apps', 'infra']);
  assert.equal(config.refreshSeconds, 10);
  assert.equal(config.cacheSeconds, 0);
  assert.equal(config.healthEnabled, true);
});
