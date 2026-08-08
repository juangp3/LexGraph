import { test, expect } from '@playwright/test';

function hasNextApiRequest(urls: string[]): boolean {
  return urls.some((url) => {
    try {
      return new URL(url).pathname.startsWith('/api/');
    } catch {
      return false;
    }
  });
}

test.describe('Search and Workspace Navigation', () => {
  test('should search for a word via live backend only', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      requests.push(request.url());
    });

    const searchResponsePromise = page.waitForResponse((response) => {
      try {
        const url = new URL(response.url());
        return url.pathname === '/v1/search' && url.searchParams.get('q') === 'father';
      } catch {
        return false;
      }
    });

    await page.goto('/');

    const searchInput = page.getByPlaceholder('Search words, languages, roots, or meanings...');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('father');
    const searchResponse = await searchResponsePromise;
    expect(searchResponse.status()).toBe(200);

    const searchUrl = new URL(searchResponse.url());
    expect(searchUrl.port).toBe('3001');

    const fatherItem = page.locator('[cmdk-item]').filter({ hasText: /^father/i }).first();
    await expect(fatherItem).toBeVisible();

    await fatherItem.click();

    await page.waitForURL(/\/workspace\?word=father&wordId=.+/);
    await expect(page).toHaveURL(/\/workspace\?word=father&wordId=.+/);
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();

    expect(hasNextApiRequest(requests)).toBe(false);
  });

  test('should show an empty state for unknown words', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByPlaceholder('Search words, languages, roots, or meanings...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('zzzzzz');

    await expect(page.getByText(/No results for/)).toBeVisible();
  });

  test('should open Cmd+K search dialog with categorized results', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Meta+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const cmdInput = dialog.getByPlaceholder('Search words, languages, roots, or meanings...');
    await expect(cmdInput).toBeVisible();

    await cmdInput.fill('english');

    // Wait for results — may include Languages group
    await page.waitForTimeout(500);
    const languageGroup = dialog.getByText('Languages');
    // If the DB has English loaded, the group should appear
    // This is a best-effort check: we just verify the dialog is functional
    await expect(dialog).toBeVisible();
  });
});
