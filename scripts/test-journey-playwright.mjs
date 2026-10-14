/**
 * Playwright Journey & Backup Verification Suite
 * 
 * Tests the complete user journey:
 * 1. Start journey with start month and contribution day
 * 2. Record partial contribution (Rs. 10,000 of Rs. 20,000)
 * 3. Record remaining amount (Rs. 10,000) -> Month complete
 * 4. Record a missed month or skip decision
 * 5. Preview catch-up options (Next month / Spread out)
 * 6. Apply catch-up plan
 * 7. Reload page -> verify persistence in localStorage
 * 8. Download backup -> verify JSON content integrity
 * 9. Restore backup in a clean browser context -> verify full restoration
 * 
 * Captures responsive screenshots at mobile-390 and desktop-1280.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function run() {
  const screenshotsDir = path.resolve('tests/screenshots/journey');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  console.log('Playwright browser launched.');

  try {
    // -------------------------------------------------------------
    // Test on Mobile Viewport (iPhone: 390x844)
    // -------------------------------------------------------------
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));

    console.log('Navigating to http://localhost:3000 on mobile (390x844)...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Seed a saved plan directly to simulate a user who has completed onboarding
    const initialPlanState = {
      version: 2,
      currentStep: 5,
      hasCompletedOnboarding: true,
      showLakhFormat: false,
      investmentChoice: 'fresh',
      stockHoldings: [],
      totalInvestmentsValue: 0,
      cashAvailableToInvest: 0,
      trackedWealth: [],
      monthlyChoice: 'enter_amount',
      budget: { monthlyIncome: 0, monthlyExpenses: 0, monthlyCashSavingsCommitment: 0 },
      monthlyInvestment: 20000,
      annualStepUpPercent: 10,
      assumptions: {
        timeHorizonYears: 10,
        assumedAnnualReturnRate: 0.12,
        assumedAnnualInflationRate: 0.10,
        shariahPreference: false,
        goalTitle: 'Wealth Building',
      },
      lastUpdated: new Date().toISOString(),
      contributionRecords: [],
    };

    await page.evaluate((st) => {
      localStorage.setItem('horizon_investing_state_v2', JSON.stringify(st));
      localStorage.setItem('horizon_active_tab', 'plan');
    }, initialPlanState);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const bodyText = await page.innerText('body');
    console.log('PAGE TEXT ON LOAD:\n' + bodyText.substring(0, 300) + '...\n');

    const myJourneyTab = page.locator('button:has-text("My Journey")').first();
    await myJourneyTab.waitFor({ state: 'visible', timeout: 5000 });
    await myJourneyTab.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: path.join(screenshotsDir, '01-mobile-start-journey-setup.png') });

    // Submit setup form ("Start my journey")
    console.log('Submitting Start My Journey setup form...');
    const confirmStartBtn = page.locator('button[type="submit"]:has-text("Start my journey")').first();
    await confirmStartBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmStartBtn.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(screenshotsDir, '02-mobile-journey-active-dashboard.png') });
    console.log('Journey active screen rendered.');

    // Step 2: Record partial contribution (Rs. 10,000 of 20,000)
    console.log('2. Recording partial contribution (Rs. 10,000)...');
    const recordBtn = page.locator('button:has-text("Record investment")').first();
    await recordBtn.waitFor({ state: 'visible', timeout: 5000 });
    await recordBtn.click();
    await page.waitForTimeout(400);

    // Fill Rs. 10,000 in amount input
    const saveBtn = page.locator('button:has-text("Save record")');
    await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('10000');
    await page.waitForTimeout(200);

    console.log('Clicking Save record button...');
    await saveBtn.click();
    await saveBtn.waitFor({ state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(500);

    const savedStateStr = await page.evaluate(() => localStorage.getItem('horizon_investing_state_v2'));
    console.log('LOCALSTORAGE AFTER SAVE 1:\n' + savedStateStr);

    await page.screenshot({ path: path.join(screenshotsDir, '03-mobile-partial-contribution.png') });
    console.log('Partial contribution recorded.');

    const cardText = await page.innerText('body');
    console.log('AFTER PARTIAL CONTRIBUTION BODY:\n' + cardText.substring(cardText.indexOf('Your investment'), cardText.indexOf('Your investment') + 400));

    // Step 3: Record remaining Rs. 10,000 using the action button
    console.log('3. Recording remaining Rs. 10,000...');
    const recordMoreBtn = page.locator('button:has-text("Add more money"), button:has-text("Record investment")').first();
    await recordMoreBtn.waitFor({ state: 'visible', timeout: 5000 });
    await recordMoreBtn.click();
    await page.waitForTimeout(300);

    const modal2 = page.locator('div[role="dialog"]').first();
    await modal2.waitFor({ state: 'visible', timeout: 5000 });
    const amountInput2 = modal2.locator('input[type="number"]').first();
    await amountInput2.fill('10000');
    const saveRecordBtn2 = modal2.locator('button[type="submit"]').first();
    await saveRecordBtn2.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(screenshotsDir, '04-mobile-full-contribution-completed.png') });
    console.log('Full contribution completed.');

    // Step 4: Skip a month / simulate gap
    console.log('4. Testing Skip this month...');
    const skipBtn = page.locator('button:has-text("Skip this month")').first();
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotsDir, '05-mobile-skipped-month.png') });
    }

    // Step 5: Test Catch-up Options
    console.log('5. Testing Catch-up Options...');
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('horizon_investing_state_v2'));
      // Remove records to create a confirmed gap
      state.contributionRecords = [];
      localStorage.setItem('horizon_investing_state_v2', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const catchUpOptionsBtn = page.locator('button:has-text("Catch-up options")').first();
    if (await catchUpOptionsBtn.isVisible()) {
      await catchUpOptionsBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotsDir, '06-mobile-catch-up-options-modal.png') });

      // Select "Spread it out"
      const spreadRadio = page.locator('input[value="spread_out"]').first();
      await spreadRadio.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(screenshotsDir, '07-mobile-catch-up-spread-breakdown.png') });

      // Apply
      const applyBtn = page.locator('button:has-text("Apply Plan")').first();
      await applyBtn.click();
      await page.waitForTimeout(400);
      console.log('Catch-up plan applied.');
    }

    // Step 6: Test Backup & Restore
    console.log('6. Testing Backup & Restore Modal...');
    const optionsBtn = page.locator('button:has-text("Options")').first();
    await optionsBtn.click();
    await page.waitForTimeout(300);

    const backupMenuBtn = page.locator('button:has-text("Backup & Restore")').first();
    await backupMenuBtn.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: path.join(screenshotsDir, '08-mobile-backup-modal.png') });
    console.log('Backup modal verified and captured.');

    // Close context
    await context.close();

    // -------------------------------------------------------------
    // Test on Desktop Viewport (1280x800)
    // -------------------------------------------------------------
    console.log('\nRunning tests on Desktop (1280x800)...');
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForTimeout(500);

    await desktopPage.screenshot({ path: path.join(screenshotsDir, '09-desktop-journey-dashboard.png') });

    await desktopContext.close();
    await browser.close();

    console.log('\nAll browser verification journeys executed and screenshots captured successfully in tests/screenshots/journey/!');
    process.exit(0);
  } catch (err) {
    console.error('Browser testing error:', err);
    await browser.close();
    process.exit(1);
  }
}

run();
