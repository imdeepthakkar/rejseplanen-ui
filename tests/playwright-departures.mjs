import { chromium, devices } from 'playwright';
import path from 'path';

async function run() {
  console.log('--- Launching Android Pixel 7 Emulation ---');
  const browser = await chromium.launch({ headless: true });
  const pixel7 = devices['Pixel 7'];
  const context = await browser.newContext({
    ...pixel7,
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5174/ ...');
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(1000);

  // Switch to Live Departures if needed
  const liveTab = page.locator('.tab-item', { hasText: 'Live Departures' });
  if (await liveTab.isVisible()) {
    await liveTab.click();
    await page.waitForTimeout(500);
  }

  // Type "Nørreport" into the station input
  console.log('Searching for Nørreport departures...');
  const input = page.locator('input[placeholder*="Station"]');
  await input.fill('Nørreport');

  const firstSuggestion = page.locator('.suggestion-item:not(.loading)').first();
  await firstSuggestion.waitFor({ state: 'visible', timeout: 6000 });
  const suggestionText = await firstSuggestion.innerText();
  console.log('Selecting suggestion:', suggestionText);
  await firstSuggestion.click();
  await page.waitForTimeout(500);

  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  console.log('Waiting for departures to load...');
  try {
    await page.waitForSelector('.departure-card', { timeout: 15000 });
  } catch (err) {
    await page.screenshot({ path: path.resolve('debug_timeout.png') });
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('PAGE TEXT ON TIMEOUT:', bodyText);
    throw err;
  }
  await page.waitForTimeout(1000);

  // 1. Verify Mode Filter Bar
  console.log('\n--- VERIFYING MODE FILTER BAR ---');
  const filterChips = await page.locator('.mode-filter-chip').all();
  console.log(`Found ${filterChips.length} filter chips.`);
  if (filterChips.length !== 6) {
    throw new Error(`Expected 6 filter chips, found ${filterChips.length}`);
  }

  const chipLabels = [];
  for (const chip of filterChips) {
    const label = await chip.locator('.mode-filter-label').innerText();
    chipLabels.push(label);
  }
  console.log('Filter chips present:', chipLabels.join(' | '));

  // 2. Test filtering by Bus
  console.log('\n--- Testing Bus Filter ---');
  const busChip = page.locator('.mode-filter-chip', { hasText: 'Bus' });
  await busChip.click();
  await page.waitForTimeout(600);
  const busCards = await page.locator('.departure-card').count();
  console.log(`Bus filter active: showing ${busCards} cards.`);

  // 3. Test filtering by S-Tog
  console.log('\n--- Testing S-Tog Filter ---');
  const stogChip = page.locator('.mode-filter-chip', { hasText: 'S-Tog' });
  await stogChip.click();
  await page.waitForTimeout(600);
  const stogCards = await page.locator('.departure-card').count();
  console.log(`S-Tog filter active: showing ${stogCards} cards.`);
  await page.screenshot({ path: path.resolve('departures_android_stog_filtered.png'), fullPage: false });

  // 4. Test filtering by All
  console.log('\n--- Testing All Filter ---');
  const allChip = page.locator('.mode-filter-chip', { hasText: 'All' });
  await allChip.click();
  await page.waitForTimeout(600);
  const allCards = await page.locator('.departure-card').count();
  console.log(`All filter active: showing ${allCards} cards.`);

  // 5. Verify Direction text and NO TRUNCATION
  console.log('\n--- VERIFYING ZERO TRUNCATION & ARROW ---');
  const analysis = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.departure-card'));
    return cards.map((card, index) => {
      const countdown = card.querySelector('.countdown-badge')?.innerText?.trim();
      const clockTime = card.querySelector('.dep-clock-time')?.innerText?.trim();
      const badge = card.querySelector('.dep-line-badge')?.innerText?.trim();
      const track = card.querySelector('.dep-track')?.innerText?.trim() || '';
      const directionEl = card.querySelector('.dep-direction');
      const arrowEl = card.querySelector('.dep-arrow')?.innerText?.trim();
      const directionText = directionEl?.innerText?.trim() || '';
      
      const containsTowards = directionText.toLowerCase().includes('towards');
      const hasArrow = arrowEl === '→';
      const isTruncated = directionEl ? (directionEl.scrollWidth > directionEl.clientWidth) : false;

      return {
        index,
        countdown,
        clockTime,
        badge,
        track,
        directionText,
        containsTowards,
        hasArrow,
        isTruncated,
        clientWidth: directionEl?.clientWidth,
        scrollWidth: directionEl?.scrollWidth
      };
    });
  });

  const truncatedCount = analysis.filter(d => d.isTruncated).length;
  const containsTowardsCount = analysis.filter(d => d.containsTowards).length;

  console.log(`Total departures checked: ${analysis.length}`);
  console.log(`Departures with truncation: ${truncatedCount} (Must be 0!)`);
  console.log(`Departures with "towards": ${containsTowardsCount} (Must be 0!)`);

  console.log('\nSample Departures:');
  analysis.slice(0, 8).forEach(d => {
    console.log(`[${d.countdown} | ${d.clockTime}] [${d.badge}] ${d.directionText} | ${d.track} | Truncated: ${d.isTruncated}`);
  });

  // Capture screenshot of the verified UI
  const screenshotPath = path.resolve('departures_android_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('\nSaved verification screenshot to:', screenshotPath);

  await browser.close();

  if (truncatedCount > 0) {
    throw new Error(`Failure: ${truncatedCount} departures still truncated!`);
  }
  if (containsTowardsCount > 0) {
    throw new Error(`Failure: "towards" still found in departures!`);
  }

  console.log('\n=== ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! ===');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
