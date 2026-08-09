import { test, expect } from '@playwright/test';

test('auth page has OAuth redirect links', async ({ page, baseURL }) => {
  await page.goto('/auth');

  const githubLink = await page.locator('a[href*="/v1/auth/oauth/github"]');
  await expect(githubLink).toHaveCount(1);

  const googleLink = await page.locator('a[href*="/v1/auth/oauth/google"]');
  await expect(googleLink).toHaveCount(1);

  // links should preserve next param when present
  await page.goto('/auth?next=/workspace/settings');
  const ghHref = await page.getAttribute('a[href*="/v1/auth/oauth/github"]', 'href');
  expect(ghHref).toContain('/v1/auth/oauth/github');
});