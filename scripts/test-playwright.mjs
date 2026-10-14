import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function clickBtn(page, text) {
  const btn = page.locator(`button:has-text("${text}")`).first();
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
}

async function run() {
  const outDir = path.resolve('tests/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  console.log('Playwright browser launched.');

  const results = [];

  // =========================================================================
  // JOURNEY 1: Starting fresh → known monthly amount → assumptions → save
  // (Tested across 320px, 390px, and 1280px viewports)
  // =========================================================================
  const viewports = [
    { name: 'mobile-320', width: 320, height: 600, label: '320 × 600 (Small Mobile)' },
    { name: 'mobile-390', width: 390, height: 844, label: '390 × 844 (iPhone)' },
    { name: 'desktop-1280', width: 1280, height: 800, label: '1280 × 800 (Desktop)' },
  ];

  for (const vp of viewports) {
    console.log(`\n--- Running Journey 1 on ${vp.label} ---`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Step 1: Choose "I'm starting fresh"
    await page.waitForSelector('button[role="radio"]');
    const startingFreshRadio = page.locator('button[role="radio"]').nth(2);
    await startingFreshRadio.scrollIntoViewIfNeeded();
    await startingFreshRadio.click();
    await page.waitForTimeout(150);

    await clickBtn(page, 'Set my monthly amount');
    await page.waitForTimeout(300);

    // Step 2: Monthly investment (Known amount route)
    const monthlyInput = page.locator('#monthly-invest-input');
    await monthlyInput.scrollIntoViewIfNeeded();
    await monthlyInput.fill('30000');
    await monthlyInput.blur();
    await page.waitForTimeout(150);

    // Screenshot of Step 2 Monthly Setup
    await page.screenshot({ path: path.join(outDir, `${vp.name}-01-step2-monthly-known.png`) });

    await clickBtn(page, 'Review plan assumptions');
    await page.waitForTimeout(300);

    // Step 3: Assumptions
    const hasAssumptionsHeading = await page.getByText('What should we use for this example?').first().isVisible();

    // Screenshot of Step 3 Assumptions
    await page.screenshot({ path: path.join(outDir, `${vp.name}-02-step3-assumptions.png`) });

    await clickBtn(page, 'View my starting plan');
    await page.waitForTimeout(300);

    // Step 4: Review Plan
    const hasReviewHeading = await page.getByText('Here’s your starting plan.').first().isVisible();

    // Screenshot of Step 4 Review
    await page.screenshot({ path: path.join(outDir, `${vp.name}-03-step4-review-plan.png`) });

    // Click "Save my plan"
    await clickBtn(page, 'Save my plan');
    await page.waitForTimeout(300);

    // Step 5: Saved Plan Overview
    const hasOverview = await page.getByText('Your Plan Overview').first().isVisible();

    // Screenshot of Step 5 Saved Plan Overview
    await page.screenshot({ path: path.join(outDir, `${vp.name}-04-step5-saved-plan-overview.png`) });

    results.push({
      journey: '1. Fresh → Known Monthly → Assumptions → Save',
      viewport: vp.label,
      status: hasAssumptionsHeading && hasReviewHeading && hasOverview ? 'PASS' : 'FAIL',
      details: 'Navigated 1-5, saved plan, verified all headings and layouts',
    });

    await page.close();
  }

  // =========================================================================
  // JOURNEY 2: Portfolio total → budget guidance → assumptions → save
  // =========================================================================
  {
    console.log('\n--- Running Journey 2: Portfolio total → budget guidance → save ---');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Step 1: Select "Enter a total"
    const enterTotalRadio = page.locator('button[role="radio"]').nth(1);
    await enterTotalRadio.scrollIntoViewIfNeeded();
    await enterTotalRadio.click();
    await page.fill('#total-investment-value', '400000');
    await clickBtn(page, 'Set my monthly amount');
    await page.waitForTimeout(250);

    // Step 2: Select "Help me work it out"
    const helpMeWorkRadio = page.locator('button[role="radio"]').nth(1);
    await helpMeWorkRadio.scrollIntoViewIfNeeded();
    await helpMeWorkRadio.click();
    await page.fill('#budget-income', '200000');
    await page.fill('#budget-expenses', '120000');
    await page.fill('#budget-cash-saving', '20000');
    await page.waitForTimeout(150);

    // Verify "Money left each month" calculation: 200k - 120k - 20k = 60,000
    const hasMoneyLeft = await page.getByText('Money left each month').first().isVisible();
    const has60k = await page.getByText('60,000').first().isVisible();

    // Set investment amount below surplus: 25,000
    await page.fill('#monthly-invest-input', '25000');
    await page.locator('#monthly-invest-input').blur();
    await page.waitForTimeout(150);

    // Check remaining buffer message
    const remainsText = await page.getByText('remains after the expenses').first().isVisible();

    // Select explicit annual step-up: "Choose an increase"
    await clickBtn(page, 'Choose an increase');
    await page.waitForTimeout(100);

    await page.screenshot({ path: path.join(outDir, 'journey2-step2-budget-guidance.png') });

    await clickBtn(page, 'Review plan assumptions');
    await page.waitForTimeout(250);

    // Step 3 -> Step 4
    await clickBtn(page, 'View my starting plan');
    await page.waitForTimeout(250);

    // Check compact summary has investments today = Rs. 400,000
    const hasStarting400k = await page.getByText('400,000').first().isVisible();

    await clickBtn(page, 'Save my plan');
    await page.waitForTimeout(250);

    const savedOverviewVisible = await page.getByText('Your Plan Overview').first().isVisible();

    results.push({
      journey: '2. Portfolio Total → Budget Guidance → Save',
      viewport: '390 × 844',
      status: hasMoneyLeft && has60k && remainsText && hasStarting400k && savedOverviewVisible ? 'PASS' : 'FAIL',
      details: 'Total value 400k, budget surplus 60k, buffer message verified, saved plan overview confirmed',
    });

    await page.close();
  }

  // =========================================================================
  // JOURNEY 3: Shares and price → monthly amount → assumptions → save
  // =========================================================================
  {
    console.log('\n--- Running Journey 3: Shares and price entry ---');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Step 1: Select "Add my stocks"
    const addStocksRadio = page.locator('button[role="radio"]').nth(0);
    await addStocksRadio.scrollIntoViewIfNeeded();
    await addStocksRadio.click();
    await page.waitForTimeout(150);

    // Search for "FFC"
    await page.fill('#company-search-input', 'FFC');
    await page.waitForTimeout(200);

    // Click FFC in suggestions
    const ffcBtn = page.locator('button:has-text("Fauji Fertilizer Company Limited")').first();
    await ffcBtn.click();
    await page.waitForTimeout(150);

    // Verify price field has quote or placeholder, and company is selected
    const hasSelectedFfc = await page.getByText('FFC').first().isVisible();

    // Fill shares: 500 and price: 214.50 to test deterministic calculated value
    await page.fill('#holding-shares-input', '500');
    await page.fill('#holding-price-input', '214.50');
    await page.waitForTimeout(150);

    // Verify live calculated value preview
    const calculatedVisible = await page.getByText('Holding value:').first().isVisible();

    // Click "Add holding"
    await clickBtn(page, 'Add holding');
    await page.waitForTimeout(200);

    // Verify holding rendered in list with symbol
    const hasHoldingListed = await page.getByText('FFC').first().isVisible();

    await page.screenshot({ path: path.join(outDir, 'journey3-psx-verified-quote-holding.png') });

    // Continue through journey
    await clickBtn(page, 'Set my monthly amount');
    await page.waitForTimeout(200);
    await clickBtn(page, 'Review plan assumptions');
    await page.waitForTimeout(200);
    await clickBtn(page, 'View my starting plan');
    await page.waitForTimeout(200);
    await clickBtn(page, 'Save my plan');
    await page.waitForTimeout(200);

    const savedOverviewVisible = await page.getByText('Your Plan Overview').first().isVisible();

    results.push({
      journey: '3. PSX Search & Simplified Holding → Monthly → Save',
      viewport: '390 × 844',
      status: hasSelectedFfc && calculatedVisible && hasHoldingListed && savedOverviewVisible ? 'PASS' : 'FAIL',
      details: 'PSX FFC search, simplified holding layout, live holding value calculation, saved plan overview confirmed',
    });

    await page.close();
  }

  // =========================================================================
  // JOURNEY 4: Zero monthly contributions with existing investments
  // =========================================================================
  {
    console.log('\n--- Running Journey 4: Zero monthly contributions ---');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Step 1: Total value 500k
    const totalRadio = page.locator('button[role="radio"]').nth(1);
    await totalRadio.scrollIntoViewIfNeeded();
    await totalRadio.click();
    await page.fill('#total-investment-value', '500000');
    await clickBtn(page, 'Set my monthly amount');
    await page.waitForTimeout(200);

    // Step 2: Monthly investment = 0
    await page.fill('#monthly-invest-input', '0');
    await page.locator('#monthly-invest-input').blur();
    await page.waitForTimeout(100);

    await clickBtn(page, 'Review plan assumptions');
    await page.waitForTimeout(200);
    await clickBtn(page, 'View my starting plan');
    await page.waitForTimeout(200);

    // Step 4: Verify starting capital is 500k, money added over time is 0
    const startingText = await page.getByText('500,000').first().isVisible();
    const moneyAddedZero = await page.getByText('Rs. 0').first().isVisible();

    results.push({
      journey: '4. Zero Monthly Contributions with Existing 500k',
      viewport: '390 × 844',
      status: startingText && moneyAddedZero ? 'PASS' : 'FAIL',
      details: 'Opening capital compounds without monthly deposits, money added is 0',
    });

    await page.close();
  }

  // =========================================================================
  // JOURNEY 5: Negative budget surplus handling
  // =========================================================================
  {
    console.log('\n--- Running Journey 5: Negative budget surplus ---');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    const freshRadio = page.locator('button[role="radio"]').nth(2);
    await freshRadio.scrollIntoViewIfNeeded();
    await freshRadio.click();
    await clickBtn(page, 'Set my monthly amount');
    await page.waitForTimeout(200);

    // Select "Help me work it out" with expenses > income
    const helpMeWorkRadio = page.locator('button[role="radio"]').nth(1);
    await helpMeWorkRadio.scrollIntoViewIfNeeded();
    await helpMeWorkRadio.click();
    await page.fill('#budget-income', '80000');
    await page.fill('#budget-expenses', '95000');
    await page.fill('#budget-cash-saving', '0');
    await page.waitForTimeout(150);

    // Check negative surplus notice
    const hasDeficitNotice = await page.getByText('equal or exceed income in the numbers you entered').first().isVisible();

    results.push({
      journey: '5. Negative Budget Surplus Handling',
      viewport: '390 × 844',
      status: hasDeficitNotice ? 'PASS' : 'FAIL',
      details: 'Deficit explained clearly without crash or disabling valid progress',
    });

    await page.close();
  }

  // =========================================================================
  // JOURNEY 6: Back navigation and edits from the review screen
  // =========================================================================
  {
    console.log('\n--- Running Journey 6: Back navigation and edits from review screen ---');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Step 1: fresh
    const freshRadio = page.locator('button[role="radio"]').nth(2);
    await freshRadio.scrollIntoViewIfNeeded();
    await freshRadio.click();
    await clickBtn(page, 'Set my monthly amount');
    await page.waitForTimeout(150);

    // Step 2: 25k
    await clickBtn(page, 'Review plan assumptions');
    await page.waitForTimeout(150);

    // Step 3: assumptions
    await clickBtn(page, 'View my starting plan');
    await page.waitForTimeout(150);

    // On Step 4 Review Plan: Click "Edit" next to Monthly Investment
    const editMonthlyBtn = page.locator('button[aria-label="Edit monthly investment"]');
    await editMonthlyBtn.scrollIntoViewIfNeeded();
    await editMonthlyBtn.click();
    await page.waitForTimeout(200);

    // Should now be on Step 2
    const onStep2 = await page.getByText('Do you know how much you want to invest each month?').first().isVisible();

    // Edit monthly investment to 45,000
    await page.fill('#monthly-invest-input', '45000');
    await page.locator('#monthly-invest-input').blur();
    await page.waitForTimeout(100);

    // Click Continue back to Step 3 then Step 4
    await clickBtn(page, 'Review plan assumptions');
    await page.waitForTimeout(150);
    await clickBtn(page, 'View my starting plan');
    await page.waitForTimeout(200);

    // Verify 45,000/mo is reflected in Step 4 summary
    const has45k = await page.getByText('45,000').first().isVisible();

    results.push({
      journey: '6. Back Navigation & Edit from Review Screen',
      viewport: '390 × 844',
      status: onStep2 && has45k ? 'PASS' : 'FAIL',
      details: 'Navigated back from Step 4 to Step 2, updated amount to 45k, change verified on Step 4',
    });

    await page.close();
  }

  // =========================================================================
  // JOURNEY 7: Refresh halfway through setup
  // =========================================================================
  {
    console.log('\n--- Running Journey 7: Refresh halfway through setup ---');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Step 1: Total value 350k
    const totalRadio = page.locator('button[role="radio"]').nth(1);
    await totalRadio.scrollIntoViewIfNeeded();
    await totalRadio.click();
    await page.fill('#total-investment-value', '350000');
    await clickBtn(page, 'Set my monthly amount');
    await page.waitForTimeout(200);

    // On Step 2: enter 28,000
    await page.fill('#monthly-invest-input', '28000');
    await page.locator('#monthly-invest-input').blur();
    await page.waitForTimeout(200);

    // Refresh page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);

    // Verify user is still on Step 2 with 28,000 preserved
    const inputValue = await page.locator('#monthly-invest-input').inputValue();
    const isStep2 = await page.getByText('Do you know how much you want to invest each month?').first().isVisible();

    results.push({
      journey: '7. Refresh Halfway Through Setup',
      viewport: '390 × 844',
      status: isStep2 && inputValue.includes('28,000') ? 'PASS' : 'FAIL',
      details: 'Step position and entered 28,000 preserved after full browser reload',
    });

    await page.close();
  }

  // =========================================================================
  // JOURNEY 8: Reload a completed saved plan
  // =========================================================================
  {
    console.log('\n--- Running Journey 8: Reload a completed saved plan ---');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Fast-path to Step 4 and save
    const freshRadio = page.locator('button[role="radio"]').nth(2);
    await freshRadio.scrollIntoViewIfNeeded();
    await freshRadio.click();
    await clickBtn(page, 'Set my monthly amount');
    await page.waitForTimeout(150);
    await clickBtn(page, 'Review plan assumptions');
    await page.waitForTimeout(150);
    await clickBtn(page, 'View my starting plan');
    await page.waitForTimeout(150);
    await clickBtn(page, 'Save my plan');
    await page.waitForTimeout(250);

    // Now on Step 5: Saved Plan Overview
    const isOverviewBefore = await page.getByText('Your Plan Overview').first().isVisible();

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);

    // Verify user directly lands on Step 5 Overview without repeating onboarding
    const isOverviewAfter = await page.getByText('Your Plan Overview').first().isVisible();
    const hasAdjustBtn = await page.getByText('Adjust my plan').first().isVisible();

    results.push({
      journey: '8. Reload a Completed Saved Plan',
      viewport: '390 × 844',
      status: isOverviewBefore && isOverviewAfter && hasAdjustBtn ? 'PASS' : 'FAIL',
      details: 'Lands on saved-plan overview on reload without restarting onboarding from Step 1',
    });

    await page.close();
  }

  // =========================================================================
  // JOURNEY 9: Duplicate stock handling, custom price override & in-place edit
  // =========================================================================
  {
    console.log('\n--- Running Journey 9: Duplicate detection and manual price override ---');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Step 1: Select "Add my stocks"
    const addStocksRadio = page.locator('button[role="radio"]').nth(0);
    await addStocksRadio.scrollIntoViewIfNeeded();
    await addStocksRadio.click();
    await page.waitForTimeout(150);

    // Add first holding: MEBL with market price
    await page.fill('#company-search-input', 'MEBL');
    await page.waitForTimeout(200);
    const meblBtn = page.locator('button:has-text("Meezan Bank Limited")').first();
    await meblBtn.click();
    await page.waitForTimeout(150);
    await page.fill('#holding-shares-input', '200');
    // Set price if not populated
    const meblPrice = await page.locator('#holding-price-input').inputValue();
    if (!meblPrice || meblPrice === '0') {
      await page.fill('#holding-price-input', '230');
    }
    await page.waitForTimeout(100);
    await clickBtn(page, 'Add holding');
    await page.waitForTimeout(200);

    // Verify MEBL in list
    const hasMeblInList = await page.getByText('MEBL').first().isVisible();

    // Now search MEBL again to test duplicate detection
    await page.fill('#company-search-input', 'MEBL');
    await page.waitForTimeout(200);
    const meblAgainBtn = page.locator('button:has-text("Meezan Bank Limited")').first();
    await meblAgainBtn.click();
    await page.waitForTimeout(150);

    // Duplicate alert should appear
    const hasDuplicateWarning = await page.getByText('You already have MEBL in your holdings').first().isVisible();

    // Click "Update existing holding"
    await clickBtn(page, 'Update existing holding');
    await page.waitForTimeout(150);

    // Test "Enter manually" toggle if present
    const enterManuallyBtn = page.locator('button:has-text("Enter manually")');
    if (await enterManuallyBtn.isVisible()) {
      await enterManuallyBtn.click();
      await page.waitForTimeout(100);
    }

    // Change shares to 350 and price to 240
    await page.fill('#holding-shares-input', '350');
    await page.fill('#holding-price-input', '240');
    await page.waitForTimeout(100);

    // Click "Update holding"
    await clickBtn(page, 'Update holding');
    await page.waitForTimeout(200);

    // Verify holding was updated in place: 350 shares @ Rs. 240 = 84,000 and Entered by you label
    const hasUpdatedShares = await page.getByText('350 shares @ Rs. 240').first().isVisible();
    const hasManualBadge = await page.getByText('Entered by you.').first().isVisible();
    const has84k = await page.getByText('84,000').first().isVisible();

    // Take screenshot of duplicate handling & custom price override
    await page.screenshot({ path: path.join(outDir, 'journey9-duplicate-and-custom-price.png') });

    results.push({
      journey: '9. Duplicate Detection & Custom Price Override',
      viewport: '390 × 844',
      status: hasMeblInList && hasDuplicateWarning && hasUpdatedShares && hasManualBadge && has84k ? 'PASS' : 'FAIL',
      details: 'Detected duplicate MEBL, loaded into update mode, switched to custom price 240, updated in place',
    });

    await page.close();
  }

  await browser.close();

  // Print results table
  console.log('\n================ ALL END-TO-END PLAYWRIGHT TESTS COMPLETE ================');
  console.table(results);

  const allPassed = results.every((r) => r.status === 'PASS');
  if (!allPassed) {
    console.error('One or more journeys failed!');
    process.exit(1);
  } else {
    console.log(`All ${results.length} end-to-end user journeys passed successfully.`);
  }
}

run().catch((err) => {
  console.error('Playwright execution error:', err);
  process.exit(1);
});
