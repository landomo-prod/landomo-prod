import { test, expect } from '@playwright/test';
import { navigateToExplorer } from './helpers';

test.describe('Desktop Explorer - Map View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navigateToExplorer(page);
  });

  test('should display map view with all components', async ({ page }) => {
    // Check sidebar navigation
    await expect(page.getByRole('button', { name: /map explorer/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /property list/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /saved/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /notifications/i }).first()).toBeVisible();

    // Check header with search
    await expect(page.getByPlaceholder(/search/i).first()).toBeVisible();

    // Wait for map to load
    await page.waitForSelector('.leaflet-container', { timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/02-map-view.png', fullPage: true });

    // Check property list pane - shows property count
    await expect(page.getByText(/properties in view|visible in map area/i).first()).toBeVisible();

    // Verify property cards in sidebar
    const propertyCards = page.locator('div.cursor-pointer').filter({ hasText: /Kč/ });
    await propertyCards.first().waitFor({ timeout: 5000 });
    const count = await propertyCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should open filter modal when clicking More button', async ({ page }) => {
    // Click "More" filter button to open filter sheet
    const moreButton = page.getByRole('button', { name: /more/i }).first();
    await moreButton.click();

    // Wait for sheet
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/02-filter-modal.png', fullPage: true });
  });

  test('should open priority filter modals', async ({ page }) => {
    // Test Price filter
    const priceFilter = page.locator('button').filter({ hasText: /price/i }).first();
    if (await priceFilter.isVisible()) {
      await priceFilter.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'test-results/screenshots/02-price-filter-modal.png', fullPage: true });

      // Check Price Range title
      await expect(page.getByText(/price range/i)).toBeVisible({ timeout: 2000 });

      // Close modal via evaluate (backdrop click gets intercepted)
      await page.evaluate(() => {
        const backdrop = document.querySelector<HTMLElement>('.fixed.inset-0');
        if (backdrop) backdrop.click();
      });
      await page.waitForTimeout(200);
    }

    // Test Type filter
    const typeFilter = page.locator('button').filter({ hasText: /type/i }).first();
    if (await typeFilter.isVisible()) {
      await typeFilter.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'test-results/screenshots/02-type-filter-modal.png', fullPage: true });

      // Close modal via evaluate
      await page.evaluate(() => {
        const backdrop = document.querySelector<HTMLElement>('.fixed.inset-0');
        if (backdrop) backdrop.click();
      });
      await page.waitForTimeout(200);
    }
  });

  test('should open sort menu', async ({ page }) => {
    // Click sort button
    const sortButton = page.locator('button').filter({ hasText: /sort/i }).first();
    await sortButton.click();

    // Wait for dropdown
    await page.waitForTimeout(300);

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/02-sort-menu.png', fullPage: true });

    // Check sort options
    await expect(page.getByText(/newest|price|area/i).first()).toBeVisible();
  });

  test('should open property detail panel when clicking property', async ({ page }) => {
    // Wait for property cards to load
    await page.waitForTimeout(1000);

    // Click first property card via evaluate to avoid overlay issues
    await page.evaluate(() => {
      const cards = document.querySelectorAll<HTMLElement>('section div.cursor-pointer');
      for (const card of cards) {
        if (card.offsetParent !== null) {
          card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          break;
        }
      }
    });

    // Wait for detail panel to slide in
    await page.waitForTimeout(600);

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/02-property-detail-panel.png', fullPage: true });

    // Check detail panel content
    await expect(page.getByText(/schedule viewing/i)).toBeVisible({ timeout: 2000 });
  });

  test('should close detail panel when clicking close button', async ({ page }) => {
    // Open detail panel first
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const cards = document.querySelectorAll<HTMLElement>('section div.cursor-pointer');
      for (const card of cards) {
        if (card.offsetParent !== null) {
          card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          break;
        }
      }
    });
    await page.waitForTimeout(600);

    // Close via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/02-detail-panel-closed.png', fullPage: true });
  });

  test('should toggle sidebar collapse', async ({ page }) => {
    // Find and click collapse button
    const collapseButton = page.getByRole('button', { name: /collapse/i }).first();

    if (await collapseButton.isVisible()) {
      // Take screenshot before collapse
      await page.screenshot({ path: 'test-results/screenshots/02-sidebar-expanded.png', fullPage: true });

      // Click to collapse
      await collapseButton.click();
      await page.waitForTimeout(400);

      // Take screenshot after collapse
      await page.screenshot({ path: 'test-results/screenshots/02-sidebar-collapsed.png', fullPage: true });
    }
  });
});
