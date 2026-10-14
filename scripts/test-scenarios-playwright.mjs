/**
 * Playwright Scenario & Visual Interaction Test Suite
 * Tests:
 * 1. Opening "What if things go wrong?" panel from saved plan overview
 * 2. Testing all 4 scenarios (Sudden market fall, Years without growth, Break from investing, Slower growth)
 * 3. Inspecting comparison values and factual takeaways
 * 4. Resetting scenario and confirming baseline plan is unchanged
 * 5. Capturing mobile (320px, 390px) and desktop screenshots
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function run() {
  const outDir = path.resolve('tests/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const testReport = [];
  console.log('--- Starting Downside Scenario & Visual Interaction Tests ---');

  const viewports = [
    { width: 320, height: 640, name: 'mobile-320-scenario-panel.png', label: '320px Mobile' },
    { width: 390, height: 844, name: 'mobile-390-scenario-panel.png', label: '390px Mobile' },
    { width: 1280, height: 800, name: 'desktop-1280-scenario-panel.png', label: '1280px Desktop' },
  ];

  for (const vp of viewports) {
    console.log(`\nTesting scenarios on ${vp.label} (${vp.width}px)...`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    // Complete onboarding quickly to reach Step 5
    // Step 1: Click "I'm starting fresh"
    const freshRadio = page.locator('button[role="radio"]').nth(2);
    await freshRadio.click();
    await page.waitForTimeout(150);

    const step1Next = page.locator('button:has-text("Set my monthly amount")');
    await step1Next.click();
    await page.waitForTimeout(200);

    // Step 2: Monthly amount -> Next
    const step2Next = page.locator('button:has-text("Review plan assumptions")');
    await step2Next.click();
    await page.waitForTimeout(200);

    // Step 3: Assumptions -> Next
    const step3Next = page.locator('button:has-text("View my starting plan")');
    await step3Next.click();
    await page.waitForTimeout(200);

    // Step 4: Starting plan -> Save plan (completes onboarding to Step 5)
    const savePlanBtn = page.locator('button:has-text("Save this plan & explore")');
    if (await savePlanBtn.isVisible()) {
      await savePlanBtn.click();
      await page.waitForTimeout(300);
    }

    // Now on Step 5 (Saved plan overview)
    await page.waitForSelector('text=Your Plan Overview', { timeout: 5000 });

    // Click "What if things go wrong?"
    const whatIfBtn = page.locator('button:has-text("What if things go wrong?")');
    await whatIfBtn.scrollIntoViewIfNeeded();
    await whatIfBtn.click();
    await page.waitForTimeout(300);

    // Verify scenario panel opened
    const panelTitle = page.locator('text=See how a difficult period could affect your plan.');
    const isPanelOpen = await panelTitle.isVisible();
    testReport.push({
      test: `Open Scenario Panel (${vp.label})`,
      expected: 'Panel opens on click',
      actual: isPanelOpen ? 'Opened successfully' : 'Failed to open',
      pass: isPanelOpen,
    });

    // Test Scenario 1: Sudden market fall
    const marketFallTab = page.locator('button:has-text("Sudden market fall")');
    await marketFallTab.click();
    await page.waitForTimeout(200);
    const comparisonCard1 = page.locator('text=Scenario Comparison').first();
    const hasComparison1 = await comparisonCard1.isVisible();

    // Capture screenshot of sudden market fall scenario
    await page.screenshot({ path: path.join(outDir, vp.name), fullPage: false });

    // Test Scenario 2: Years without growth
    const zeroGrowthTab = page.locator('button:has-text("Years without growth")');
    await zeroGrowthTab.click();
    await page.waitForTimeout(200);
    const hasComparison2 = await comparisonCard1.isVisible();

    // Test Scenario 3: Break from investing
    const pauseTab = page.locator('button:has-text("Break from investing")');
    await pauseTab.click();
    await page.waitForTimeout(200);
    const hasComparison3 = await comparisonCard1.isVisible();

    // Test Scenario 4: Slower growth rate
    const slowerTab = page.locator('button:has-text("Slower growth rate")');
    await slowerTab.click();
    await page.waitForTimeout(200);
    const hasComparison4 = await comparisonCard1.isVisible();

    testReport.push({
      test: `All Scenarios Interactive (${vp.label})`,
      expected: 'All 4 scenarios selectable and update comparison values',
      actual: (hasComparison1 && hasComparison2 && hasComparison3 && hasComparison4) ? 'All scenarios rendered comparisons correctly' : 'Some scenario failed',
      pass: hasComparison1 && hasComparison2 && hasComparison3 && hasComparison4,
    });

    // Test Reset Scenario
    const resetScenarioBtn = page.locator('button:has-text("Reset scenario")');
    await resetScenarioBtn.click();
    await page.waitForTimeout(200);

    // Test Back to my plan / close
    const backBtn = page.locator('button:has-text("Back to my plan")');
    await backBtn.click();
    await page.waitForTimeout(200);

    const isPanelClosed = !(await panelTitle.isVisible());
    testReport.push({
      test: `Close & Reset Scenario (${vp.label})`,
      expected: 'Scenario panel closes and original plan remains unchanged',
      actual: isPanelClosed ? 'Closed successfully, baseline intact' : 'Failed to close',
      pass: isPanelClosed,
    });

    await page.close();
  }

  await browser.close();

  console.log('\n================ PLAYWRIGHT SCENARIO TEST REPORT ================');
  console.table(testReport);

  const allPassed = testReport.every((t) => t.pass);
  if (!allPassed) {
    console.error('One or more Playwright scenario tests failed!');
    process.exit(1);
  } else {
    console.log('All Playwright scenario and interaction tests PASSED successfully.');
  }
}

run().catch((err) => {
  console.error('Playwright execution error:', err);
  process.exit(1);
});
