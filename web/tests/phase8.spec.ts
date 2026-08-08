import { expect, test, type Page } from '@playwright/test';

async function openWorkspaceFromSearch(page: Page, query = 'father') {
  await page.goto('/');

  const searchInput = page.getByPlaceholder('Search words, languages, roots, or meanings...');
  await expect(searchInput).toBeVisible({ timeout: 5_000 });
  await searchInput.fill(query);

  const result = page.locator('[cmdk-item]').filter({ hasText: new RegExp(`^${query}`, 'i') }).first();
  await expect(result).toBeVisible({ timeout: 10_000 });
  await result.click();

  await page.waitForURL(/\/workspace\?word=.+&wordId=.+/);
  await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();
}

test.describe('Phase 8 workspace UI', () => {
  test('shows the workspace chrome required for layered graph exploration', async ({ page }) => {
    await openWorkspaceFromSearch(page, 'father');

    const graphWorkspace = page.getByRole('region', { name: 'Graph workspace' });
    const inspector = page.getByRole('region', { name: 'Inspector panel' });

    await expect(graphWorkspace).toBeVisible();
    await expect(graphWorkspace.getByRole('heading', { name: 'Interactive Graph' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fit View', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PNG', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Expand Descendants', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse/Expand Branch', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Expand All', exact: true })).toBeVisible();

    await expect(page.getByRole('checkbox', { name: 'Filter by Ancestors' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Filter by Descendants' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Filter by Borrowings' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Filter by Cognates' })).toBeChecked();

    await expect(inspector).toBeVisible();
    await expect(inspector.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(inspector.getByRole('heading', { name: 'Meaning', exact: true })).toBeVisible();
    await expect(inspector.getByRole('heading', { name: 'Timeline', exact: true })).toBeVisible();
    await expect(inspector.getByRole('heading', { name: 'Relationships', exact: true })).toBeVisible();
    await expect(inspector.getByRole('heading', { name: 'References', exact: true })).toBeVisible();
    await expect(inspector.getByRole('button', { name: 'Copy Link' })).toBeVisible();
    await expect(inspector.getByRole('button', { name: 'Center Graph' })).toBeVisible();

    await expect(page.getByText('Workspace ready')).toBeVisible();
  });

  test('toggles cognate exploration and surfaces layered relationship metadata', async ({ page }) => {
    await openWorkspaceFromSearch(page, 'father');

    const cognatesFilter = page.getByRole('checkbox', { name: 'Filter by Cognates' });
    await expect(cognatesFilter).toBeChecked();

    await cognatesFilter.uncheck();
    await expect(cognatesFilter).not.toBeChecked();
    await cognatesFilter.check();
    await expect(cognatesFilter).toBeChecked();

    const cognatePill = page.getByRole('button', { name: 'cognates', exact: true });
    await expect(cognatePill).toBeVisible();
    await expect(cognatePill).toHaveClass(/bg-primary/);

    await cognatePill.click();
    await expect(cognatePill).not.toHaveClass(/bg-primary/);

    await cognatePill.click();
    await expect(cognatePill).toHaveClass(/bg-primary/);

    await expect(page.getByText('Workspace ready')).toBeVisible();
  });
});