import { test, expect } from '@playwright/test';

test('debug navigation', async ({ page }) => {
  // Listen for console messages
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  // Listen for page errors
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('/');

  // Set desktop viewport
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(1000);

  console.log('Viewport:', await page.viewportSize());

  // Check if isDesktop is true
  const isDesktop = await page.evaluate(() => window.innerWidth >= 1024);
  console.log('Is Desktop (>= 1024)?:', isDesktop);

  // Find button
  const button = page.getByRole('button', { name: 'Map Explorer' });
  console.log('Button visible?:', await button.isVisible());

  // Click it
  await button.click();
  console.log('Clicked button');

  // Wait and check DOM
  await page.waitForTimeout(500);

  // Check if body is hidden
  const bodyHidden = await page.evaluate(() => {
    const body = document.querySelector('body');
    return body?.hasAttribute('hidden');
  });
  console.log('Body has hidden attribute?:', bodyHidden);

  await page.waitForTimeout(1500);

  // Check if sidebar appeared
  const mapButton = page.getByRole('button', { name: /^map$/i }).first();
  console.log('Map button visible after click?:', await mapButton.isVisible().catch(() => false));

  // Check for hero image
  const hero = await page.evaluate(() => {
    const img = document.querySelector('img[alt="Hero"]');
    return img ? 'exists' : 'not found';
  });
  console.log('Hero image:', hero);

  // Check what's actually rendered
  const bodyHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
  console.log('Body HTML (first 500 chars):', bodyHTML);

  await page.screenshot({ path: 'test-results/screenshots/00-debug-nav.png', fullPage: true });
});
