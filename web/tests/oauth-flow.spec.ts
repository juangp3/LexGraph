import { test, expect } from '@playwright/test';

// This test simulates a complete OAuth flow by intercepting the external provider
// redirect and navigating back to the application's callback URL with a mock code.
// Requires running the app with OAUTH_MOCK=true so the server will accept the test code.

test('complete OAuth flow (GitHub) sets session cookie and loads /v1/me', async ({ page, baseURL }) => {
  // Ensure test mode is enabled in the server environment (OAUTH_MOCK=true)
  await page.goto('/auth');

  // Click the GitHub OAuth button (it's an anchor)
  const ghLink = page.locator('a:has-text("Continue with GitHub")');
  await expect(ghLink).toHaveCount(1);

  // Intercept the navigation to the external provider and capture the state param
  let capturedState = undefined as string | undefined;
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('https://github.com/login/oauth/authorize')) {
      try {
        const u = new URL(url);
        capturedState = u.searchParams.get('state') ?? undefined;
      } catch (e) {
        // ignore
      }
    }
  });

  // Click the link which would normally redirect to GitHub
  await ghLink.click();

  // Wait briefly for request listener to capture state
  await page.waitForTimeout(100);

  expect(capturedState).toBeTruthy();

  // Now simulate provider redirect back to our callback with the mock code
  const callbackUrl = `/v1/auth/oauth/github/callback?code=TEST_OAUTH_CODE&state=${encodeURIComponent(capturedState!)}&mock=1`;

  // Navigate to callback which should set the HttpOnly session cookie and redirect to frontend callback
  await page.goto(callbackUrl);

  // The server redirects to /auth/oauth-callback with next param; wait for that page
  await page.waitForURL('**/auth/oauth-callback**', { timeout: 3000 });

  // The oauth-callback page should call /v1/me and then redirect to next; wait a bit and then fetch /v1/me
  const meResp = await page.request.get('/v1/me');
  expect(meResp.status()).toBe(200);
  const meJson = await meResp.json();
  expect(meJson.email).toBeTruthy();
});
