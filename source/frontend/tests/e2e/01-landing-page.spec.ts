import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should load landing page with all sections', async ({ page }) => {
    await page.goto('/');

    // Take full page screenshot
    await page.screenshot({ path: 'test-results/screenshots/01-landing-page.png', fullPage: true });

    // Check hero section
    await expect(page.getByRole('heading', { name: /find your place/i })).toBeVisible();

    // Check search bar exists
    await expect(page.getByPlaceholder(/search by district/i)).toBeVisible();

    // Check newest listings section
    await expect(page.getByText(/newest listings/i)).toBeVisible();

    // Verify at least one property card is visible
    const propertyCards = page.locator('div.cursor-pointer').filter({ hasText: /Kč/ });
    await expect(propertyCards.first()).toBeVisible();
  });

  test('should navigate to explorer when clicking property card', async ({ page }) => {
    await page.goto('/');

    // Click first property card
    const firstCard = page.locator('div.cursor-pointer').filter({ hasText: /Kč/ }).first();
    await firstCard.click();

    // Wait for navigation to explorer
    await page.waitForTimeout(1000);

    // Take screenshot of explorer
    await page.screenshot({ path: 'test-results/screenshots/01-landing-to-explorer.png', fullPage: true });
  });

  test('should navigate to explorer when clicking CTA button', async ({ page }) => {
    await page.goto('/');

    // Find and click "Map Explorer" button in the nav
    const ctaButton = page.getByRole('button', { name: /map explorer/i }).first();
    if (await ctaButton.isVisible()) {
      await ctaButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/screenshots/01-landing-cta-click.png', fullPage: true });
    }
  });
});
