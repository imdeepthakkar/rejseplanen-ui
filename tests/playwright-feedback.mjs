import { chromium, devices } from 'playwright';

async function run() {
  console.log('--- Launching Android Pixel 7 Emulation for Feedback Modal ---');
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

  // 1. Verify Feedback trigger button exists in titlebar
  const feedbackBtn = page.locator('.mac-feedback-btn');
  await feedbackBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Feedback button text:', await feedbackBtn.innerText());

  // 2. Click Feedback button to open modal
  console.log('Clicking Feedback button...');
  await feedbackBtn.click();
  await page.waitForTimeout(400);

  // 3. Verify modal sheet is visible
  const modalSheet = page.locator('.feedback-sheet');
  await modalSheet.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Modal opened successfully!');

  // 4. Test category switching
  const bugBtn = page.locator('.feedback-type-btn', { hasText: 'Bug Report' });
  const enhBtn = page.locator('.feedback-type-btn', { hasText: 'Enhancement' });
  const sugBtn = page.locator('.feedback-type-btn', { hasText: 'Suggestion' });

  await enhBtn.click();
  await page.waitForTimeout(200);
  console.log('Selected category: Enhancement');

  // 5. Fill out form
  const summaryInput = page.locator('#feedback-summary');
  await summaryInput.fill('Add quick route pinning to home screen');

  const descTextarea = page.locator('#feedback-description');
  await descTextarea.fill('It would be wonderful to pin frequent bus routes right below favorite stations.');

  const emailInput = page.locator('#feedback-email');
  await emailInput.fill('commuter@example.com');

  // 6. Test diagnostics accordion
  const diagHeader = page.locator('.feedback-diagnostics-header');
  await diagHeader.click();
  await page.waitForTimeout(300);

  const diagContent = page.locator('.feedback-diagnostics-content');
  if (await diagContent.isVisible()) {
    console.log('System Diagnostics successfully expanded:', (await diagContent.innerText()).replace(/\n/g, ' | '));
  } else {
    throw new Error('Diagnostics accordion failed to expand');
  }

  // 7. Verify submit button label
  const submitBtn = page.locator('.feedback-submit-btn');
  const submitText = (await submitBtn.innerText()).trim();
  console.log('Submit button text:', submitText);

  if (submitText.toLowerCase().includes('to github')) {
    throw new Error(`FAILURE: Submit button still includes "to GitHub": "${submitText}"`);
  }
  if (!submitText.includes('Submit Feedback')) {
    throw new Error(`FAILURE: Expected "Submit Feedback", got "${submitText}"`);
  }
  console.log('SUCCESS: Submit button text verified as "Submit Feedback"');

  // 8. Capture verified screenshot of the live modal
  const screenshotPath = 'C:/Users/deept/.gemini/antigravity-ide/brain/bc2bcd46-083b-45b9-8394-6c007efd95af/feedback_feature_live_verified.png';
  await page.screenshot({ path: screenshotPath });
  console.log(`Live verified screenshot saved to: ${screenshotPath}`);

  // 9. Test modal close
  const closeBtn = page.locator('.feedback-close-btn');
  await closeBtn.click();
  await page.waitForTimeout(400);

  const isModalStillVisible = await modalSheet.isVisible();
  console.log('Modal visible after close click:', isModalStillVisible);
  if (isModalStillVisible) {
    throw new Error('Modal failed to close upon clicking close button');
  }
  console.log('SUCCESS: Modal closed cleanly!');

  await browser.close();
}

run().catch(err => {
  console.error('Playwright feedback test failed:', err);
  process.exit(1);
});
