import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLinksConfig, resolveLinksConfig } from '../lib/config.ts';

test('accepts valid links and normalizes Helm items', () => {
  assert.deepEqual(parseLinksConfig({
    name: 'Tools',
    items: [{ title: 'Docs', url: 'https://example.com', description: 'Guides', icon: 'globe' }],
  }), {
    name: 'Tools',
    links: [{ title: 'Docs', url: 'https://example.com', description: 'Guides', icon: 'globe' }],
  });
});

test('rejects malformed link entries and uses the fallback config', () => {
  const fallback = { name: 'Fallback', links: [] };
  assert.equal(parseLinksConfig({ links: [{ title: 'Missing fields' }] }), null);
  assert.deepEqual(resolveLinksConfig('{"links":[null]}', fallback), fallback);
});

test('rejects executable URLs and embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'https://user:secret@example.com']) {
    assert.equal(parseLinksConfig({ links: [{ title: 'Unsafe', url, description: '' }] }), null);
  }
});
