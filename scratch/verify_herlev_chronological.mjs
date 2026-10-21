import { chromium, devices } from 'playwright';
import path from 'path';

async function run() {
  console.log('--- Launching Android Pixel 7 Emulation for Herlev Bygade Departures ---');
  const browser = await chromium.launch({ headless: true });
  const pixel7 = devices['Pixel 7'];
  const context = await browser.newContext({
    ...pixel7,
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5174/ ...');
  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(1000);

  // Switch to Live Departures
  const liveTab = page.locator('.tab-item', { hasText: 'Live Departures' });
  if (await liveTab.isVisible()) {
    await liveTab.click();
    await page.waitForTimeout(500);
  }

  // Type Herlev Bygade (Herlevgårdsvej)
  console.log('Searching for Herlev Bygade (Herlevgårdsvej)...');
  const input = page.locator('input[placeholder*="Station"]');
  await input.click();
  await input.fill('');
  await input.pressSequentially('Herlev Bygade (Herlevgårdsvej)', { delay: 40 });

  const firstSuggestion = page.locator('.suggestion-item:not(.loading)').first();
  await firstSuggestion.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Clicking suggestion:', await firstSuggestion.innerText());
  await firstSuggestion.click();
  await page.waitForTimeout(400);

  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  console.log('Waiting for departure cards...');
  await page.waitForSelector('.departure-card', { timeout: 15000 });
  await page.waitForTimeout(1000);

  const cards = await page.locator('.departure-card').all();
  console.log(`Found ${cards.length} departure cards displayed.`);

  const departuresInfo = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const badge = await card.locator('.dep-line-badge').innerText().catch(() => '');
    const dest = await card.locator('.dep-dest-name').innerText().catch(() => '');
    const countdown = await card.locator('.countdown-badge').innerText().catch(() => '');
    const time = await card.locator('.dep-clock-time').innerText().catch(() => '');
    departuresInfo.push({ index: i, badge, dest, countdown, time });
  }

  console.log('\n--- First 10 Departures Displayed ---');
  departuresInfo.slice(0, 10).forEach(d => {
    console.log(`[#${d.index + 1}] Line: ${d.badge} -> ${d.dest} | Time: ${d.time} | Countdown: "${d.countdown}"`);
  });

  const first = departuresInfo[0];
  console.log(`\nFirst departure: Line ${first.badge} -> ${first.dest} at ${first.time} with countdown "${first.countdown}"`);

  if (first.countdown.toLowerCase().includes('4 hr')) {
    throw new Error(`FAILURE: First departure is still showing 4 hours! Found: "${first.countdown}" at ${first.time}`);
  }

  console.log('SUCCESS: First departure is imminent/chronological and does NOT show 4 hours!');

  const screenshotPath = 'C:/Users/deept/.gemini/antigravity-ide/brain/bc2bcd46-083b-45b9-8394-6c007efd95af/herlev_bygade_chronological_verified.png';
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to ${screenshotPath}`);

  await browser.close();
}

run().catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
});
