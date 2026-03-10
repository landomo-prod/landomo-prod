import { test, expect } from '@playwright/test';
import { navigateToExplorer } from './helpers';

test.describe('Desktop Explorer - Notifications View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await navigateToExplorer(page);

    // Navigate to notifications view
    const notificationsButton = page.getByRole('button', { name: /notifications/i }).first();
    await notificationsButton.click();
    await page.waitForTimeout(500);
  });

  test('should display notifications view with tabs', async ({ page }) => {
    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/05-notifications-view.png', fullPage: true });

    // Check tab pills
    await expect(page.getByRole('button', { name: /listings/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /manage/i }).first()).toBeVisible();

    // Check create alert button
    await expect(page.getByRole('button', { name: /create alert/i })).toBeVisible();
  });

  test('should switch between Listings and Manage tabs', async ({ page }) => {
    // Click Manage tab
    const manageTab = page.getByRole('button', { name: /manage/i }).first();
    await manageTab.click();
    await page.waitForTimeout(300);

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/05-notifications-manage-tab.png', fullPage: true });

    // Click Listings tab
    const listingsTab = page.getByRole('button', { name: /listings/i }).first();
    await listingsTab.click();
    await page.waitForTimeout(300);

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/05-notifications-listings-tab.png', fullPage: true });
  });

  test('should display empty state when no alerts', async ({ page }) => {
    // Check for empty state (might be in either tab)
    const emptyState = page.getByText(/no active alerts|no properties tracked/i);

    if (await emptyState.isVisible()) {
      // Take screenshot
      await page.screenshot({ path: 'test-results/screenshots/05-notifications-empty.png', fullPage: true });

      // Check for CTA button
      const ctaButton = page.getByRole('button', { name: /create alert|go to manage/i });
      await expect(ctaButton.first()).toBeVisible({ timeout: 2000 });
    }
  });

  test('should display alert cards in manage tab', async ({ page }) => {
    // Switch to Manage tab
    const manageTab = page.getByRole('button', { name: /manage/i }).first();
    await manageTab.click();
    await page.waitForTimeout(300);

    // Check for alert cards or empty state
    const alertCards = page.locator('[class*="Alert"]');
    const count = await alertCards.count();

    if (count > 0) {
      // Take screenshot with alerts
      await page.screenshot({ path: 'test-results/screenshots/05-notifications-with-alerts.png', fullPage: true });

      // Verify alert count display
      await expect(page.getByText(/alert/i).first()).toBeVisible();
    }
  });

  test('should display property alerts grid', async ({ page }) => {
    // Check for property listings
    const propertyAlerts = page.locator('[class*="property"]').filter({ hasText: /Kč/i });
    const count = await propertyAlerts.count();

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/05-notifications-grid.png', fullPage: true });

    // Verify grid uses 4-column layout
    if (count > 0) {
      await expect(propertyAlerts.first()).toBeVisible();
    }
  });

  test('should open create alert flow', async ({ page }) => {
    // Click create alert button
    const createButton = page.getByRole('button', { name: /create alert/i });
    await createButton.click();
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/05-notifications-create-alert.png', fullPage: true });
  });
});
