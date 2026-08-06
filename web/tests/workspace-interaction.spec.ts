import { test, expect } from '@playwright/test';

test.describe('Workspace Inspector Interaction', () => {
  test('workspace shows graph guidance when no root word is selected', async ({ page }) => {
    await page.goto('/workspace');

    await expect(page.getByText('Search a word to begin')).toBeVisible();
    await expect(page.getByText('Select a node to inspect metadata.')).toBeVisible();
    await expect(page).toHaveURL(/\/workspace$/);
  });
});
