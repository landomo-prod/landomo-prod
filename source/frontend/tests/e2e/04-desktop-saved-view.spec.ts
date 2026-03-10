import { test, expect } from '@playwright/test';
import { navigateToExplorer } from './helpers';

test.describe('Desktop Explorer - Saved View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navigateToExplorer(page);

    // Navigate to saved view
    const savedButton = page.getByRole('button', { name: /saved/i }).first();
    await savedButton.click();
    await page.waitForTimeout(500);
  });

  test('should display saved properties view', async ({ page }) => {
    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/04-saved-view.png', fullPage: true });

    // Check for either saved properties or empty state
    const emptyState = page.getByText(/no saved properties/i);
    const propertyGrid = page.locator('div.cursor-pointer').filter({ hasText: /Kč/ });

    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasProperties = await propertyGrid.count() > 0;

    expect(hasEmptyState || hasProperties).toBeTruthy();
  });

  test('should show empty state when no saved properties', async ({ page }) => {
    // Check for empty state
    const emptyState = page.getByText(/no saved properties/i);

    if (await emptyState.isVisible().catch(() => false)) {
      // Take screenshot of empty state
      await page.screenshot({ path: 'test-results/screenshots/04-saved-empty.png', fullPage: true });

      // Check for CTA button
      const ctaButton = page.getByRole('button', { name: /browse properties/i });
      await expect(ctaButton).toBeVisible({ timeout: 2000 });
    }
  });

  test('should display saved properties if available', async ({ page }) => {
    // Check for properties
    const propertyCards = page.locator('div.cursor-pointer').filter({ hasText: /Kč/ });
    const count = await propertyCards.count();

    if (count > 0) {
      // Take screenshot
      await page.screenshot({ path: 'test-results/screenshots/04-saved-with-properties.png', fullPage: true });

      // Check first property is visible
      await expect(propertyCards.first()).toBeVisible();
    }
  });

  test('should open detail panel from saved properties', async ({ page }) => {
    // Check if properties exist
    const propertyCards = page.locator('div.cursor-pointer').filter({ hasText: /Kč/ });
    const count = await propertyCards.count();

    if (count > 0) {
      // Click first property
      await page.evaluate(() => {
        const cards = document.querySelectorAll<HTMLElement>('div.cursor-pointer');
        for (const card of cards) {
          if (card.offsetParent !== null && card.textContent?.match(/Kč/)) {
            card.click();
            break;
          }
        }
      });
      await page.waitForTimeout(600);

      // Take screenshot
      await page.screenshot({ path: 'test-results/screenshots/04-saved-detail-panel.png', fullPage: true });

      // Verify detail panel
      await expect(page.getByText(/schedule viewing/i)).toBeVisible({ timeout: 2000 });
    }
  });
});
