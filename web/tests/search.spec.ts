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
    const fatherLink = page.getByRole('link', { name: 'father' });
    await expect(fatherLink).toBeVisible();
    await fatherLink.click();

    // Verify navigation to the correct workspace
    await page.waitForURL('/workspace?wordId=father');
    await expect(page).toHaveURL('/workspace?wordId=father');
    await expect(page.getByRole('heading', { name: 'father' })).toBeVisible();
  });

  test('should allow searching for a second word from the workspace page', async ({ page }) => {
    // First, navigate to a workspace page
    await page.goto('/workspace?wordId=father');

    // Open search command from the workspace
    await page.keyboard.press('Control+k');

    // Wait for the search input to be visible
    const searchInput = page.getByPlaceholder('Type a word to search...');
    await expect(searchInput).toBeVisible();

    // Type 'mother' and wait for the result to appear
    await searchInput.fill('mother');
    const motherLink = page.getByRole('link', { name: 'mother' });
    await expect(motherLink).toBeVisible();
    await motherLink.click();

    // Verify navigation to the new workspace
    await page.waitForURL('/workspace?wordId=mother');
    await expect(page).toHaveURL('/workspace?wordId=mother');
    await expect(page.getByRole('heading', { name: 'mother' })).toBeVisible();
  });
});
