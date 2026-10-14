import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const outputDir = 'tests/screenshots/portfolio-history';
const url = 'http://127.0.0.1:4173';
const snapshotKey = 'horizon_portfolio_snapshots_v1';
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);

  const state = {
    version: 2,
    currentStep: 5,
    hasCompletedOnboarding: true,
    showLakhFormat: false,
    investmentChoice: 'stocks_detail',
    stockHoldings: [{
      id: 'ffc-history-test', symbolOrName: 'FFC', symbol: 'FFC', sector: 'Fertilizer', instrumentType: 'equity',
      isVerifiedPsx: true, entryMode: 'shares_and_price', shares: 100, pricePerShare: 550,
      averageBuyingPrice: 500, marketValue: 55000, priceProvenance: 'user_manual', priceStatus: 'manual',
    }],
    totalInvestmentsValue: 55000,
    cashAvailableToInvest: 0,
    trackedWealth: [],
    monthlyChoice: 'enter_amount',
    budget: { monthlyIncome: 0, monthlyExpenses: 0, monthlyCashSavingsCommitment: 0 },
    monthlyInvestment: 25000,
    annualStepUpPercent: 0,
    assumptions: { timeHorizonYears: 10, assumedAnnualReturnRate: 0.12, assumedAnnualInflationRate: 0.10, shariahPreference: false },
    contributionRecords: [], monthDecisions: {}, lastSelectedTab: 'portfolio', lastUpdated: '2026-10-14T00:00:00.000Z',
  };
  await page.evaluate(({ state, snapshotKey }) => {
    localStorage.setItem('horizon_investing_state_v2', JSON.stringify(state));
    localStorage.setItem('horizon_active_tab', 'portfolio');
    localStorage.removeItem(snapshotKey);
  }, { state, snapshotKey });
  await page.reload();

  await page.getByRole('heading', { name: 'Portfolio History', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Gain/loss', exact: true }).click();
  const chart = page.getByTestId('portfolio-history-chart');
  await chart.waitFor();
  assert.equal(await page.getByText('1 observation', { exact: true }).count(), 1);
  assert.ok(await page.getByText('+Rs. 5,000', { exact: true }).count());
  assert.equal((await page.evaluate(key => JSON.parse(localStorage.getItem(key)).length, snapshotKey)), 1);

  await page.getByRole('button', { name: /FFC/ }).click();
  await page.getByRole('button', { name: 'Edit holding & buying price', exact: true }).click();
  await page.getByLabel('Current price per share (PKR)', { exact: true }).fill('570');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText('Changes saved successfully.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close detail modal', exact: true }).click();

  await page.getByText('2 observations', { exact: true }).waitFor();
  assert.ok(await page.getByText('+Rs. 7,000', { exact: true }).count());
  const snapshots = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), snapshotKey);
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].totalUnrealisedPnL, 5000);
  assert.equal(snapshots[1].totalUnrealisedPnL, 7000);
  const historySvg = chart.locator('svg');
  assert.ok(await historySvg.locator('path').count() >= 2, 'Line and area paths render');
  const bounds = await historySvg.boundingBox();
  assert.ok(bounds);
  await historySvg.hover({ position: { x: bounds.width * 0.8, y: bounds.height * 0.5 } });
  const tooltip = page.getByTestId('portfolio-history-tooltip');
  await tooltip.waitFor();
  assert.match(await tooltip.innerText(), /Rs\. 7,000/);
  await chart.focus();
  await chart.press('Home');
  assert.match(await tooltip.innerText(), /Rs\. 5,000/);
  await chart.press('End');
  assert.match(await tooltip.innerText(), /Rs\. 7,000/);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${outputDir}/gain-loss-two-observations.png`, fullPage: true });
  console.log('PASS: gain/loss line graph renders its first snapshot, connects a price-edit observation, and supports pointer and keyboard inspection.');
} finally {
  await browser?.close();
  server.kill();
}
