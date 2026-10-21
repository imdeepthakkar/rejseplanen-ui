import { chromium, devices } from 'playwright';
import path from 'path';

async function run() {
  console.log('--- Launching Android Pixel 7 Emulation ---');
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

  // Switch to Live Departures if needed
  const liveTab = page.locator('.tab-item', { hasText: 'Live Departures' });
  if (await liveTab.isVisible()) {
    await liveTab.click();
    await page.waitForTimeout(500);
  }

  // Search Nørreport St departures
  console.log('\n--- Searching for Nørreport departures ---');
  const input = page.locator('input[placeholder*="Station"]');
  await input.click();
  await input.fill('');
  await input.pressSequentially('Nørreport', { delay: 50 });

  const firstSuggestion = page.locator('.suggestion-item:not(.loading)').first();
  await firstSuggestion.waitFor({ state: 'visible', timeout: 8000 });
  await firstSuggestion.click();
  await page.waitForTimeout(400);

  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  console.log('Waiting for departures to load at Nørreport...');
  await page.waitForSelector('.departure-card', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 1. Verify Mode Filter Bar has all 6 filters present
  console.log('\n--- VERIFYING ALL 6 FILTER CHIPS ARE PRESENT ---');
  const filterChips = await page.locator('.mode-filter-chip').all();
  console.log(`Found ${filterChips.length} filter chips.`);
  if (filterChips.length !== 6) {
    throw new Error(`Expected all 6 filter chips, found ${filterChips.length}`);
  }

  const expectedModes = ['All', 'Bus', 'S-Tog', 'Metro', 'RE', 'LetBane'];
  const chipLabels = [];
  for (const chip of filterChips) {
    const label = await chip.locator('.mode-filter-label').innerText();
    chipLabels.push(label);
  }
  console.log('Filter chips present:', chipLabels.join(' | '));
  for (const exp of expectedModes) {
    if (!chipLabels.includes(exp)) {
      throw new Error(`Expected filter chip "${exp}" to be present, but got: ${chipLabels.join(', ')}`);
    }
  }

  // Test S-Tog filter
  console.log('\n--- Testing S-Tog Filter ---');
  const stogChip = page.locator('.mode-filter-chip', { hasText: 'S-Tog' });
  await stogChip.click();
  await page.waitForTimeout(500);
  const stogCards = await page.locator('.departure-card').count();
  console.log(`S-Tog filter active: showing ${stogCards} cards.`);

  // Return to All filter
  console.log('\n--- Testing All Filter ---');
  const allChip = page.locator('.mode-filter-chip', { hasText: 'All' });
  await allChip.click();
  await page.waitForTimeout(500);

  // Verify Approach 1 Card Structure & Alignment
  console.log('\n--- VERIFYING APPROACH 1 CARD STRUCTURE & ALIGNMENT ---');
  const cardAnalysis = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.departure-card'));
    return cards.map((card, index) => {
      const leftCol = card.querySelector('.dep-card-left');
      const rightCol = card.querySelector('.dep-card-right');
      const countdown = card.querySelector('.countdown-badge')?.innerText?.trim();
      const clockTime = card.querySelector('.dep-clock-time')?.innerText?.trim();
      const badge = card.querySelector('.dep-line-badge')?.innerText?.trim();
      const track = card.querySelector('.dep-track')?.innerText?.trim() || '';
      const directionEl = card.querySelector('.dep-dest-name');
      const arrowEl = card.querySelector('.dep-arrow')?.innerText?.trim();
      const directionText = directionEl?.innerText?.trim() || '';
      const statusLine = card.querySelector('.dep-status-line')?.innerText?.trim() || '';
      const destTextGroup = card.querySelector('.dep-dest-text-group');

      const isLeftValid = Boolean(leftCol && badge && directionText && destTextGroup);
      const isRightValid = Boolean(rightCol && countdown && clockTime);
      const hasArrow = arrowEl === '→';
      const isTruncated = directionEl ? (directionEl.scrollWidth > directionEl.clientWidth) : false;

      return {
        index,
        badge,
        directionText,
        statusLine,
        countdown,
        clockTime,
        track,
        hasArrow,
        isTruncated,
        isLeftValid,
        isRightValid
      };
    });
  });

  console.log(`Verified ${cardAnalysis.length} cards.`);
  const invalidCards = cardAnalysis.filter(c => !c.isLeftValid || !c.isRightValid);
  if (invalidCards.length > 0) {
    throw new Error(`Found ${invalidCards.length} cards missing Approach 1 left/right structure`);
  }
  const truncatedCards = cardAnalysis.filter(c => c.isTruncated);
  if (truncatedCards.length > 0) {
    throw new Error(`Found ${truncatedCards.length} truncated cards`);
  }
  console.log('Sample Approach 1 card:', cardAnalysis[0]);

  await page.screenshot({ path: path.resolve('departures_android_verified.png') });
  console.log('Saved departures_android_verified.png');

  console.log('\n=== ALL PLAYWRIGHT CHECKS PASSED SUCCESSFULLY ===');
  await browser.close();
}

run().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
