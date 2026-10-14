import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const outputDir = 'tests/screenshots/projection-chart';
const url = 'http://127.0.0.1:4173';
await mkdir(outputDir, { recursive: true });

const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort',
], { stdio: 'ignore' });

let browser;
try {
  for (let attempt = 0; attempt < 300; attempt++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    if (attempt === 299) throw new Error('Preview did not start');
    await delay(100);
  }

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const state = {
    version: 2,
    currentStep: 4,
    hasCompletedOnboarding: false,
    showLakhFormat: false,
    investmentChoice: 'total_value',
    stockHoldings: [],
    totalInvestmentsValue: 250000,
    cashAvailableToInvest: 0,
    trackedWealth: [],
    monthlyChoice: 'enter_amount',
    budget: { monthlyIncome: 0, monthlyExpenses: 0, monthlyCashSavingsCommitment: 0 },
    monthlyInvestment: 25000,
    annualStepUpPercent: 10,
    assumptions: {
      timeHorizonYears: 25,
      assumedAnnualReturnRate: 0.12,
      assumedAnnualInflationRate: 0.10,
      shariahPreference: false,
      goalTitle: 'Wealth Building',
    },
    contributionRecords: [],
    monthDecisions: {},
    lastSelectedTab: 'plan',
    lastUpdated: '2026-10-14T00:00:00.000Z',
  };

  for (const viewport of [{ name: 'mobile-320', width: 320, height: 844 }, { name: 'desktop-1280', width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.evaluate(value => localStorage.setItem('horizon_investing_state_v2', JSON.stringify(value)), state);
    await page.reload();

    const chart = page.getByTestId('projection-chart');
    await chart.waitFor();
    assert.equal(await page.getByText('Portfolio value (PKR)', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Investment timeline', { exact: true }).count(), 1);
    assert.ok(await page.getByText('Year 25', { exact: true }).count());

    const svg = chart.locator('svg');
    const bounds = await svg.boundingBox();
    assert.ok(bounds);
    await svg.hover({ position: { x: bounds.width * 0.55, y: bounds.height * 0.5 } });
    const tooltip = page.getByTestId('projection-tooltip');
    await tooltip.waitFor();
    assert.match(await tooltip.innerText(), /End of year \d+/);
    assert.match(await tooltip.innerText(), /Future portfolio/);
    assert.match(await tooltip.innerText(), /Money invested/);
    assert.match(await tooltip.innerText(), /Buying power/);

    await chart.focus();
    await chart.press('Home');
    assert.match(await tooltip.innerText(), /Starting point/);
    await chart.press('ArrowRight');
    assert.match(await tooltip.innerText(), /End of year 1/);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `No page overflow at ${viewport.width}px`);
    await page.screenshot({ path: `${outputDir}/${viewport.name}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
  }

  console.log('PASS: projection chart axes, pointer tooltip, keyboard navigation, responsive overflow and screenshots.');
} finally {
  await browser?.close();
  server.kill();
}
