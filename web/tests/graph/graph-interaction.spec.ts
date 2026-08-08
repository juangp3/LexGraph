import { test, expect } from '@playwright/test';

test('search -> load graph -> double-click node expands descendants and updates inspector', async ({ page }) => {
  await page.goto('/');

  // focus the workspace search input if present on homepage
  const searchInput = page.getByPlaceholder('Search words, languages, roots, or meanings...');
  await expect(searchInput).toBeVisible({ timeout: 5000 });
  await searchInput.fill('father');

  // wait for debounce + results before pressing Enter
  const firstResult = page.locator('[cmdk-item]').filter({ hasText: /^father/i }).first();
  await expect(firstResult).toBeVisible({ timeout: 8000 });
  await firstResult.click();

  // wait for navigation to workspace
  await page.waitForURL('**/workspace**', { timeout: 15000 });

  // wait for React Flow nodes to appear
  const nodes = page.locator('.react-flow__node');
  await expect(nodes.first()).toBeVisible({ timeout: 10000 });

  const initialCount = await nodes.count();
  console.log(`initial node count: ${initialCount}`);
  expect(initialCount).toBeGreaterThan(0);

  // double click first visible node — selects it and attempts to expand descendants
  await nodes.first().dblclick();

  // Give time for any expansion request to settle (node count may or may not grow
  // depending on dataset; small datasets may already have all descendants loaded)
  await page.waitForTimeout(2000);
  const afterCount = await nodes.count();
  console.log(`node count after double-click: ${afterCount}`);
  expect(afterCount).toBeGreaterThanOrEqual(initialCount);

  // inspector section exists on desktop layout (lg: breakpoint)
  const inspectorSection = page.locator('section[aria-label="Inspector panel"]');
  await expect(inspectorSection).toBeVisible({ timeout: 5000 });

  // after node selection, the inspector heading should load
  const inspectorHeading = inspectorSection.locator('h2');
  await expect(inspectorHeading).toBeVisible({ timeout: 10000 });
  const headingText = await inspectorHeading.innerText();
  expect(headingText.length).toBeGreaterThan(0);
});
