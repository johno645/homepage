import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('article')).toHaveCount(3);
});

test('shows transport evidence, workload health and keyboard-accessible details', async ({ page }) => {
  const orders = page.locator('article').filter({ hasText: 'Orders API' });
  await expect(orders.getByText('TLS termination', { exact: true })).toBeVisible();
  await expect(orders.getByText('HTTPS backend', { exact: true })).toBeVisible();
  await expect(orders.getByText('healthy · 1/1 pods ready')).toBeVisible();
  const database = page.locator('article').filter({ hasText: 'database' });
  await expect(database.getByText('TLS passthrough', { exact: true })).toBeVisible();
  await expect(database.getByRole('link', { name: 'Open database' })).toHaveCount(0);
  await orders.getByRole('button', { name: 'Orders API', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('CPU: 120m · Memory: 128.0 MiB')).toBeVisible();
  await expect(dialog.getByText('Deployment/orders: 1/1 replicas ready · 1 updated')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'repository' })).toHaveAttribute('href', 'https://github.com/example/orders');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('searches tags with the slash shortcut and filters attention', async ({ page }) => {
  await page.keyboard.press('/');
  const search = page.getByRole('textbox', { name: 'Search apps, hosts, namespaces and tags' });
  await expect(search).toBeFocused();
  await search.fill('critical');
  await expect(page.locator('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('checkbox', { name: 'Needs attention' }).check();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('article').getByRole('button', { name: 'database', exact: true })).toBeVisible();
});

test('persists favorites and layout across reloads', async ({ page }) => {
  await page.getByRole('button', { name: 'Favorite Orders API', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Favorites', exact: true }).check();
  await expect(page.locator('article')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Layout' }).selectOption('table');
  await expect(page.getByRole('table')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Favorite Orders API', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('retains successful data when refreshing fails', async ({ page }) => {
  await page.route('**/api/k8s/ingresses', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture cluster unavailable' }) }));
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Developer dashboard' }).getByRole('alert')).toContainText('Showing the last successful snapshot');
  await expect(page.locator('article')).toHaveCount(3);
});

test('theme and responsive cards fit the viewport', async ({ page }, testInfo) => {
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('dark');
  await expect(page.locator('html')).toHaveClass('dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dashboard-dark.png'), fullPage: true });
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('light');
  await expect(page.locator('html')).not.toHaveClass('dark');
  await page.screenshot({ path: testInfo.outputPath('dashboard-light.png'), fullPage: true });
});
