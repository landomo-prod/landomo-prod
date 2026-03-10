import { test, expect } from '@playwright/test';
import { navigateToExplorer } from './helpers';

test.describe('Responsive Design & Interactions', () => {
  test('should handle different viewport sizes', async ({ page }) => {
    await page.goto('/');
    await navigateToExplorer(page);

    // Desktop large (2xl)
    await page.setViewportSize({ width: 1536, height: 864 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/06-viewport-2xl.png', fullPage: true });

    // Desktop (xl)
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/06-viewport-xl.png', fullPage: true });

    // Desktop (lg)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/06-viewport-lg.png', fullPage: true });

    // Tablet (md)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/screenshots/06-viewport-md.png', fullPage: true });
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await navigateToExplorer(page);

    // Navigate to list view
    const listButton = page.getByRole('button', { name: /property list/i }).first();
    await listButton.click();
    await page.waitForTimeout(500);

    // Open sort menu (filter/sort buttons exist in header)
    const sortButton = page.locator('button').filter({ hasText: /sort/i }).first();
    if (await sortButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sortButton.click();
      await page.waitForTimeout(300);

      // Close with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/06-keyboard-nav.png', fullPage: true });
  });

  test('should handle property card interactions', async ({ page }) => {
    await page.goto('/');
    await navigateToExplorer(page);

    // Wait for cards to render
    await page.waitForTimeout(1000);

    // Find property card via evaluate and click heart button
    await page.evaluate(() => {
      const cards = document.querySelectorAll<HTMLElement>('[class*="cursor-pointer"]');
      for (const card of cards) {
        const btn = card.querySelector<HTMLElement>('button');
        if (btn && btn.offsetParent !== null) {
          // Hover simulation
          card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          break;
        }
      }
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/screenshots/06-card-hover.png', fullPage: true });

    // Click like button
    await page.evaluate(() => {
      const cards = document.querySelectorAll<HTMLElement>('[class*="cursor-pointer"]');
      for (const card of cards) {
        const btn = card.querySelector<HTMLElement>('button');
        if (btn && btn.offsetParent !== null) {
          btn.click();
          break;
        }
      }
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/screenshots/06-card-liked.png', fullPage: true });
  });

  test('should handle detail panel interactions', async ({ page }) => {
    await page.goto('/');
    await navigateToExplorer(page);

    // Open detail panel via evaluate
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

    // Test action buttons
    const scheduleButton = page.getByText(/schedule viewing/i).first();
    if (await scheduleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.screenshot({ path: 'test-results/screenshots/06-detail-panel.png', fullPage: true });
    }
  });

  test('should handle search functionality', async ({ page }) => {
    await page.goto('/');
    await navigateToExplorer(page);

    // Find search input
    const searchInput = page.getByPlaceholder(/search/i).first();

    // Type in search
    await searchInput.fill('Praha 2');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/screenshots/06-search-filled.png', fullPage: true });

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'test-results/screenshots/06-search-cleared.png', fullPage: true });
  });

  test('should handle all modal interactions', async ({ page }) => {
    await page.goto('/');
    await navigateToExplorer(page);

    // Navigate to list view
    const listButton = page.getByRole('button', { name: /property list/i }).first();
    await listButton.click();
    await page.waitForTimeout(500);

    // Test sort modal
    const sortButton = page.locator('button').filter({ hasText: /sort/i }).first();
    if (await sortButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sortButton.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'test-results/screenshots/06-sort-modal-open.png', fullPage: true });

      // Close sort modal via backdrop
      await page.locator('.fixed.inset-0').first().click();
      await page.waitForTimeout(200);
    }

    // Test price filter modal
    const priceFilter = page.locator('button').filter({ hasText: /price/i }).first();
    if (await priceFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      await priceFilter.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'test-results/screenshots/06-price-modal-open.png', fullPage: true });

      // Close via backdrop
      await page.locator('.fixed.inset-0').first().click();
      await page.waitForTimeout(200);
    }

    await page.screenshot({ path: 'test-results/screenshots/06-modal-backdrop-close.png', fullPage: true });
  });
});
