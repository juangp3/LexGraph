import { test, expect, type Page } from '@playwright/test';

function hasNextApiRequest(urls: string[]): boolean {
  return urls.some((url) => {
    try {
      return new URL(url).pathname.startsWith('/api/');
    } catch {
      return false;
    }
  });
}

async function openWorkspaceFromSearch(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Search/i }).first().click();

  const searchInput = page.getByPlaceholder('Type a word to search...');
  await expect(searchInput).toBeVisible();

  await searchInput.fill('father');
  const fatherItem = page.locator('[cmdk-item]').filter({ hasText: /^father/i }).first();
  await expect(fatherItem).toBeVisible();
  await fatherItem.click();

  await page.waitForURL(/\/workspace\?word=father&wordId=.+/);
  await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();
}

test.describe('Graph Traversal Features', () => {
  test('should use live backend for traversal and inspector flows', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      requests.push(request.url());
    });

    const ancestorsResponsePromise = page.waitForResponse((response) => {
      try {
        return new URL(response.url()).pathname.includes('/v1/graph/ancestors/');
      } catch {
        return false;
      }
    });

    await openWorkspaceFromSearch(page);

    const ancestorsResponse = await ancestorsResponsePromise;
    expect(ancestorsResponse.status()).toBe(200);

    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeVisible();

    await nodes.first().click();
    await expect(page.getByLabel('Inspector panel')).toBeVisible();

    const descendantsResponsePromise = page.waitForResponse((response) => {
      try {
        return new URL(response.url()).pathname.includes('/v1/graph/descendants/');
      } catch {
        return false;
      }
    });

    await page.getByRole('button', { name: 'Expand Descendants' }).click();
    const descendantsResponse = await descendantsResponsePromise;
    expect(descendantsResponse.status()).toBe(200);

    const requestedWordDetails = requests.some((url) => {
      try {
        return new URL(url).pathname.includes('/v1/words/');
      } catch {
        return false;
      }
    });

    expect(requestedWordDetails).toBe(true);
    expect(hasNextApiRequest(requests)).toBe(false);
  });
});
