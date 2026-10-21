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

  // Part 1: Search Nørreport
  console.log('\n--- Part 1: Searching for Nørreport departures ---');
  const input = page.locator('input[placeholder*="Station"]');
  await input.fill('Nørreport');

  const firstSuggestion = page.locator('.suggestion-item:not(.loading)').first();
  await firstSuggestion.waitFor({ state: 'visible', timeout: 6000 });
  await firstSuggestion.click();
  await page.waitForTimeout(500);

  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  console.log('Waiting for departures to load at Nørreport...');
  await page.waitForSelector('.departure-card', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Verify Dynamic Mode Filters at Nørreport
  const norreportChips = await page.locator('.mode-filter-chip').all();
  const norreportLabels = [];
  for (const chip of norreportChips) {
    const label = await chip.locator('.mode-filter-label').innerText();
    norreportLabels.push(label);
  }
  console.log(`Nørreport filter chips (${norreportChips.length}):`, norreportLabels.join(' | '));
  // LetBane does not exist at Nørreport, so LetBane should NOT be present
  if (norreportLabels.includes('LetBane')) {
    throw new Error('LetBane should not be present at Nørreport St.');
  }

  // Verify Approach 1 Card Structure on Nørreport
  console.log('\n--- VERIFYING APPROACH 1 CARD STRUCTURE (NØRREPORT) ---');
  const cardAnalysis = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.departure-card'));
    return cards.map((card, index) => {
      const leftCol = card.querySelector('.dep-card-left');
      const rightCol = card.querySelector('.dep-card-right');
      const countdown = card.querySelector('.countdown-badge')?.innerText?.trim();
      const clockTime = card.querySelector('.dep-clock-time')?.innerText?.trim();
      const badge = card.querySelector('.dep-line-badge')?.innerText?.trim();
      const track = card.querySelector('.dep-track')?.innerText?.trim() || '';
      const directionEl = card.querySelector('.dep-dest-name') || card.querySelector('.dep-direction');
      const arrowEl = card.querySelector('.dep-arrow')?.innerText?.trim();
      const directionText = directionEl?.innerText?.trim() || '';

      const isLeftValid = Boolean(leftCol && badge && directionText);
      const isRightValid = Boolean(rightCol && countdown && clockTime);
      const hasArrow = arrowEl === '→';
      const isTruncated = directionEl ? (directionEl.scrollWidth > directionEl.clientWidth) : false;

      return {
        index,
        badge,
        directionText,
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

  // Part 2: Search Herlev St to verify dynamic filters
  console.log('\n--- Part 2: Searching for Herlev St departures ---');
  await input.click();
  await input.fill('');
  await input.pressSequentially('Herlev St', { delay: 60 });
  const herlevSug = page.locator('.suggestion-item:not(.loading)').first();
  await herlevSug.waitFor({ state: 'visible', timeout: 8000 });
  console.log('Selected Herlev suggestion:', await herlevSug.innerText());
  await herlevSug.click();
  await page.waitForTimeout(400);

  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('departureBoard') && resp.status() === 200, { timeout: 15000 }),
    submitBtn.click()
  ]);
  console.log('Received Herlev departureBoard response, status:', response.status());
  await page.waitForTimeout(1000);

  const herlevChips = await page.locator('.mode-filter-chip').all();
  const herlevLabels = [];
  for (const chip of herlevChips) {
    const label = await chip.locator('.mode-filter-label').innerText();
    herlevLabels.push(label);
  }
  console.log(`Herlev St filter chips (${herlevChips.length}):`, herlevLabels.join(' | '));

  // Herlev St has no Metro and no RE
  if (herlevLabels.includes('Metro') || herlevLabels.includes('RE')) {
    throw new Error(`Herlev St should NOT have Metro or RE filters! Got: ${herlevLabels.join(', ')}`);
  }
  if (!herlevLabels.includes('All') || !herlevLabels.includes('S-Tog') || !herlevLabels.includes('Bus')) {
    throw new Error(`Herlev St must have All, S-Tog, and Bus! Got: ${herlevLabels.join(', ')}`);
  }
  console.log('SUCCESS: Herlev St dynamic filters verified (Metro and RE omitted; All, S-Tog, Bus present)!');

  await page.screenshot({ path: path.resolve('departures_herlev_dynamic.png') });
  console.log('Saved departures_herlev_dynamic.png');

  console.log('\n=== ALL PLAYWRIGHT CHECKS PASSED ===');
  await browser.close();
}

run().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
