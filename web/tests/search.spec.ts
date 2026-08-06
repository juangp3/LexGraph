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

    await page.getByRole('button', { name: /Search/i }).first().click();

    const searchInput = page.getByPlaceholder('Type a word to search...');
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

  test('should fail gracefully when backend is unreachable', async ({ page, context }) => {
    await context.route('**/v1/search**', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');
    await page.getByRole('button', { name: /Search/i }).first().click();

    const searchInput = page.getByPlaceholder('Type a word to search...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('father');

    await expect(page.getByText('No results found.')).toBeVisible();
  });
});
