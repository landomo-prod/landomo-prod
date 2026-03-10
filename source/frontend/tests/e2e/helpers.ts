import { Page, expect } from '@playwright/test';

/**
 * Navigate from landing page to the Map Explorer
 * Clicks the "Map Explorer" button and waits for the sidebar navigation to be visible
 */
export async function navigateToExplorer(page: Page) {
  // Ensure viewport is desktop size (>= 1024px for isDesktop to be true)
  await page.setViewportSize({ width: 1280, height: 720 });

  // Check if we're already in the explorer (sidebar exists)
  const sidebarExists = await page.locator('aside').isVisible().catch(() => false);

  if (sidebarExists) {
    // Already in explorer, no need to navigate
    await page.waitForTimeout(300);
    return;
  }

  // Click Map Explorer button
  const mapExplorerButton = page.getByRole('button', { name: /map explorer/i });
  await expect(mapExplorerButton).toBeVisible({ timeout: 3000 });
  await mapExplorerButton.click();

  // Wait for React hydration and component mount - be more specific
  await page.waitForSelector('aside', { state: 'visible', timeout: 5000 });

  // Wait for Leaflet to initialize - check for actual map container
  await page.waitForSelector('.leaflet-container', { state: 'attached', timeout: 5000 });

  // Give Leaflet time to render tiles
  await page.waitForTimeout(1000);

  // Verify sidebar buttons exist
  await expect(page.getByRole('button', { name: /map/i }).first()).toBeVisible();
}
