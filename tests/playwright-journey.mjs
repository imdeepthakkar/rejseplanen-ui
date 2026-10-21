import { chromium, devices } from 'playwright';
import path from 'path';

async function run() {
  console.log('--- Testing Journey Planner on Mobile ---');
  const browser = await chromium.launch({ headless: true });
  const pixel7 = devices['Pixel 7'];
  const context = await browser.newContext({
    ...pixel7,
  });
  const page = await context.newPage();

  await page.goto('http://10.0.0.37:5174/');
  await page.waitForTimeout(1000);

  // Click Journey Planner tab
  const journeyTab = page.locator('.tab-item', { hasText: 'Journey' });
  if (await journeyTab.isVisible()) {
    await journeyTab.click();
    await page.waitForTimeout(500);
  }

  // Type From
  const fromInput = page.locator('input[placeholder*="From"]');
  await fromInput.fill('København H');
  const firstFromSug = page.locator('.suggestion-item:not(.loading)').first();
  await firstFromSug.waitFor({ state: 'visible', timeout: 5000 });
  await firstFromSug.click();
  await page.waitForTimeout(400);

  // Type To
  const toInput = page.locator('input[placeholder*="To"]');
  await toInput.fill('Aarhus H');
  const firstToSug = page.locator('.suggestion-item:not(.loading)').first();
  await firstToSug.waitFor({ state: 'visible', timeout: 5000 });
  await firstToSug.click();
  await page.waitForTimeout(400);

  // Submit
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  // Wait for journey results
  console.log('Waiting for journey results...');
  await page.waitForSelector('li', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Expand the first journey
  const firstCard = page.locator('li').first();
  await firstCard.click();
  await page.waitForTimeout(800);

  const screenshotPath = path.resolve('journey_android_verified.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved screenshot to: ${screenshotPath}`);

  const pageText = await page.evaluate(() => document.body.innerText);
  const timeToTravelMatch = pageText.match(/Time to Travel:\s*([^\n]+)/);
  if (timeToTravelMatch) {
    console.log('FOUND Time to Travel:', timeToTravelMatch[0]);
  } else {
    console.log('Time to Travel pattern not matched in page text');
  }

  await browser.close();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
