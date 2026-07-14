import { test, expect } from '@playwright/test';

test.describe('Search and Workspace Navigation', () => {
  test('should allow searching for a word and navigating to the workspace', async ({ page }) => {
    await page.goto('/');

    // Open search command
    await page.keyboard.press('Control+k');
    
    // Wait for the search input to be visible
    const searchInput = page.getByPlaceholder('Type a word to search...');
    await expect(searchInput).toBeVisible();

    // Type 'father' and wait for the result to appear
    await searchInput.fill('father');
    const fatherItem = page.locator('[cmdk-item]').filter({ hasText: /^father/i }).first();
    await expect(fatherItem).toBeVisible();
    await fatherItem.click();

    // Verify navigation to the correct workspace
    await page.waitForURL('/workspace?word=father');
    await expect(page).toHaveURL('/workspace?word=father');
    await expect(page.getByRole('heading', { name: 'father' })).toBeVisible();
  });

  test('should allow searching for a second word from the workspace page', async ({ page }) => {
    // First, navigate to a workspace page
    await page.goto('/workspace?word=father');

    // Open search command from the workspace
    await page.keyboard.press('Control+k');

    // Wait for the search input to be visible
    const searchInput = page.getByPlaceholder('Type a word to search...');
    await expect(searchInput).toBeVisible();

    // Type 'mother' and wait for the result to appear
    await searchInput.fill('mother');
    const motherItem = page.locator('[cmdk-item]').filter({ hasText: /^mother/i }).first();
    await expect(motherItem).toBeVisible();
    await motherItem.click();

    // Verify navigation to the new workspace
    await page.waitForURL('/workspace?word=mother');
    await expect(page).toHaveURL('/workspace?word=mother');
    await expect(page.getByRole('heading', { name: 'mother' })).toBeVisible();
  });
});
