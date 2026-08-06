import { test, expect } from '@playwright/test';

test('search -> load graph -> double-click node expands descendants and updates inspector', async ({ page }) => {
  await page.goto('/');

  // focus the workspace search input if present on homepage
  const searchInput = page.locator('input#workspace-search-input');
  await expect(searchInput).toBeVisible({ timeout: 5000 });
  await searchInput.fill('father');
  await searchInput.press('Enter');

  // wait for navigation to workspace
  await page.waitForURL('**/workspace**', { timeout: 10000 });

  // wait for React Flow nodes to appear
  const nodes = page.locator('.react-flow__node');
  await expect(nodes.first()).toBeVisible({ timeout: 10000 });

  const initialCount = await nodes.count();
  test.info().log(`initial node count: ${initialCount}`);

  // double click first visible node to expand descendants
  await nodes.first().dblclick();

  // wait for node count to increase (descendants loaded)
  await page.waitForFunction((sel, before) => document.querySelectorAll(sel).length > before, '.react-flow__node', initialCount, { timeout: 10000 });

  const afterCount = await nodes.count();
  expect(afterCount).toBeGreaterThan(initialCount);

  // inspector should show selected word heading
  const inspectorHeading = page.locator('section[aria-label="Inspector panel"] h2');
  await expect(inspectorHeading).toBeVisible({ timeout: 5000 });
  const headingText = await inspectorHeading.innerText();
  expect(headingText.length).toBeGreaterThan(0);
});
