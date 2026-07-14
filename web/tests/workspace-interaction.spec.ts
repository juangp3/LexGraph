import { test, expect } from '@playwright/test';

test.describe('Workspace Inspector Interaction', () => {
  test('selecting nodes updates inspector without navigation', async ({ page }) => {
    await page.goto('/workspace');

    await page.getByRole('button', { name: 'mother' }).click();
    await expect(page.getByRole('heading', { name: 'mother' })).toBeVisible();
    await expect(page).toHaveURL(/\/workspace$/);

    await page.getByRole('button', { name: 'father' }).click();
    await expect(page.getByRole('heading', { name: 'father' })).toBeVisible();
    await expect(page).toHaveURL(/\/workspace$/);
  });
});
