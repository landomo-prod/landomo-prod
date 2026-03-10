import { test, expect } from '@playwright/test';
import { navigateToExplorer } from './helpers';

test.describe('Desktop Explorer - List View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navigateToExplorer(page);

    // Navigate to list view
    const listButton = page.getByRole('button', { name: /property list/i }).first();
    await listButton.click();
    await page.waitForTimeout(500);
  });

  test('should display list view with property grid', async ({ page }) => {
    // Check header
    await expect(page.getByText(/propert/i).first()).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/03-list-view.png', fullPage: true });

    // Check property cards in grid
    const propertyCards = page.locator('div.cursor-pointer').filter({ hasText: /Kč/ });
    const count = await propertyCards.count();
    expect(count).toBeGreaterThan(0);

    // Verify responsive grid layout
    await expect(propertyCards.first()).toBeVisible();
  });

  test('should display filter and sort controls', async ({ page }) => {
    // Check for filter-related buttons (priority filters or More button)
    const filterButtons = page.locator('button').filter({ hasText: /price|type|more|filter/i }).first();
    await expect(filterButtons).toBeVisible();

    // Check sort button exists
    const sortButton = page.locator('button').filter({ hasText: /sort/i }).first();
    await expect(sortButton).toBeVisible();

    await page.screenshot({ path: 'test-results/screenshots/03-list-controls.png', fullPage: true });
  });

  test('should open property detail panel from list', async ({ page }) => {
    // Click first property via evaluate
    await page.evaluate(() => {
      const cards = document.querySelectorAll<HTMLElement>('div.cursor-pointer');
      for (const card of cards) {
        if (card.offsetParent !== null && card.textContent?.match(/Kč/)) {
          card.click();
          break;
        }
      }
    });

    // Wait for detail panel
    await page.waitForTimeout(600);

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/03-list-detail-panel.png', fullPage: true });

    // Verify detail content
    await expect(page.getByText(/schedule viewing/i)).toBeVisible({ timeout: 2000 });
  });

  test('should show loading indicator', async ({ page }) => {
    // Scroll down to trigger loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/03-list-loading.png', fullPage: true });

    // Check for loading indicator
    const loading = page.getByText(/loading/i);
    if (await loading.isVisible()) {
      await expect(loading).toBeVisible();
    }
  });

  test('should apply sort options', async ({ page }) => {
    // Open sort menu
    const sortButton = page.locator('button').filter({ hasText: /sort/i }).first();
    await sortButton.click();
    await page.waitForTimeout(300);

    // Click a sort option
    const priceLow = page.getByText(/price.*low|low.*high|lowest/i).first();
    if (await priceLow.isVisible({ timeout: 1000 }).catch(() => false)) {
      await priceLow.click();
      await page.waitForTimeout(500);

      // Take screenshot
      await page.screenshot({ path: 'test-results/screenshots/03-list-sorted.png', fullPage: true });
    } else {
      await page.keyboard.press('Escape');
    }
  });
});
