import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const dir = 'tests/screenshots/acceptance';
await mkdir(dir, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'inherit' });
server.on('error', error => { throw error; });
const url = 'http://127.0.0.1:4173';
const stateKey = 'horizon_investing_state_v2';
const snapshotKey = 'horizon_portfolio_snapshots_v1';
let browser;
try {
  for (let i = 0; i < 300; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    if (i === 299) throw new Error('Preview did not start');
    await delay(100);
  }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const source = await browser.newContext();
  const page = await source.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const fixture = {
    version: 2, currentStep: 5, hasCompletedOnboarding: true, showLakhFormat: false,
    investmentChoice: 'stocks_detail', totalInvestmentsValue: 900, cashAvailableToInvest: 1234,
    stockHoldings: [{ id: 'holding-original', symbolOrName: 'FFC', symbol: 'FFC', sector: 'Unassigned', instrumentType: 'equity', isVerifiedPsx: true,
      entryMode: 'shares_and_price', shares: 10, pricePerShare: 90, averageBuyingPrice: 100, purchaseDate: '2026-01-02', marketValue: 900,
      priceProvenance: 'user_manual', priceStatus: 'manual', marketAsOf: null, priceAsOf: '2026-01-02', fetchedAt: '2026-01-02T12:00:00Z' }],
    trackedWealth: [{ id: 'cash', category: 'emergency_cash', label: 'Emergency cash', amount: 5000 }],
    monthlyChoice: 'enter_amount', budget: { monthlyIncome: 100000, monthlyExpenses: 50000, monthlyCashSavingsCommitment: 5000 },
    monthlyInvestment: 20000, annualStepUpPercent: 7.5,
    assumptions: { timeHorizonYears: 2, assumedAnnualReturnRate: -.05, assumedAnnualInflationRate: .08, shariahPreference: false, goalTitle: 'Round trip' },
    journeySchedule: { isActive: true, startMonth: '2026-01', contributionDay: 5, originalMonthlyAmount: 20000, originalStepUpPercent: 7.5,
      originalHorizonYears: 2, originalReturnRate: -.05, originalInflationRate: .08, createdAt: '2026-01-01T00:00:00Z' },
    contributionRecords: [{ id: 'deposit-original', monthKey: '2026-01', amount: 5000, date: '2026-01-05', note: 'First deposit', status: 'partly_added' }],
    catchUpCommitment: { strategy: 'next_month', targetMonthKey: '2026-11', totalGapAmount: 15000, monthlyAllocations: { '2026-11': 15000 }, appliedAt: '2026-10-01T00:00:00Z' },
    monthDecisions: { '2026-02': { decision: 'skipped', decidedAt: '2026-02-06T00:00:00Z' } },
    lastSelectedTab: 'journey', lastUpdated: '2026-10-01T00:00:00Z',
  };
  const snapshots = [{ timestamp: '2026-01-02T12:00:00Z', totalMarketValue: 900, totalCostBasis: 1000, eligibleCostBasisForPnL: 1000,
    eligibleMarketValueForPnL: 900, totalUnrealisedPnL: -100, holdingsCount: 1, holdingsWithCostBasisCount: 1, valuationComplete: true,
    holdingsSummary: [{ symbol: 'FFC', shares: 10, currentPrice: 90, averageBuyingPrice: 100, marketValue: 900, costBasis: 1000, unrealisedPnL: -100 }] }];
  await page.evaluate(({ fixture, snapshots, stateKey, snapshotKey }) => {
    localStorage.setItem(stateKey, JSON.stringify(fixture));
    localStorage.setItem(snapshotKey, JSON.stringify(snapshots));
    localStorage.setItem('horizon_active_tab', 'journey');
  }, { fixture, snapshots, stateKey, snapshotKey });
  await page.reload();
  await page.getByRole('button', { name: 'My Journey', exact: true }).waitFor();
  const read = p => p.evaluate(({ stateKey, snapshotKey }) => ({ state: JSON.parse(localStorage.getItem(stateKey)), snapshots: JSON.parse(localStorage.getItem(snapshotKey)), tab: localStorage.getItem('horizon_active_tab') }), { stateKey, snapshotKey });
  const original = await read(page);
  assert.deepEqual(original.state.stockHoldings, fixture.stockHoldings, 'Reload preserves holding cost basis and price timestamps');
  const openBackup = async p => {
    await p.getByRole('button', { name: 'Open settings and options', exact: true }).click();
    await p.getByRole('button', { name: 'Backup & Restore' }).click();
  };
  await openBackup(page);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup file (.json)', exact: true }).click();
  const download = await downloading;
  const backupFile = `${dir}/round-trip.json`;
  await download.saveAs(backupFile);
  const exported = JSON.parse(await readFile(backupFile, 'utf8'));
  assert.deepEqual(exported.data.state, original.state);
  assert.deepEqual(exported.data.portfolioSnapshots, original.snapshots);

  const clean = await browser.newContext();
  const restored = await clean.newPage();
  restored.on('pageerror', error => errors.push(error.message));
  await restored.goto(url);
  assert.equal((await read(restored)).state.hasCompletedOnboarding, false);
  const importBackup = async () => {
    await openBackup(restored);
    await restored.getByRole('button', { name: 'Restore backup', exact: true }).click();
    await restored.locator('input[type=file]').setInputFiles(backupFile);
    await restored.getByRole('button', { name: 'Confirm & Restore', exact: true }).click();
    await restored.getByRole('dialog').waitFor({ state: 'hidden' });
  };
  await importBackup();
  assert.deepEqual(await read(restored), original);
  await restored.reload();
  await restored.getByRole('button', { name: 'My Journey', exact: true }).waitFor();
  assert.deepEqual(await read(restored), original);
  await importBackup();
  assert.deepEqual(await read(restored), original, 'Repeated import creates no duplicates');

  await openBackup(restored);
  await restored.getByRole('button', { name: 'Restore backup', exact: true }).click();
  await restored.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await restored.getByText(/Invalid JSON/).waitFor();
  assert.deepEqual(await read(restored), original);
  await restored.getByRole('button', { name: 'Close modal', exact: true }).click();
  // A storage failure after the state write must roll back the whole restore.
  await openBackup(restored);
  await restored.getByRole('button', { name: 'Restore backup', exact: true }).click();
  const changedBackup = structuredClone(exported);
  changedBackup.data.state.monthlyInvestment = 999;
  await restored.locator('input[type=file]').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(changedBackup)) });
  await restored.getByRole('button', { name: 'Confirm & Restore', exact: true }).waitFor();
  await restored.evaluate(snapshotKey => {
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === snapshotKey) {
        Storage.prototype.setItem = originalSet;
        throw new Error('Injected storage failure');
      }
      return originalSet.call(this, key, value);
    };
  }, snapshotKey);
  await restored.getByRole('button', { name: 'Confirm & Restore', exact: true }).click();
  await restored.getByText('Injected storage failure', { exact: true }).waitFor();
  assert.deepEqual(await read(restored), original, 'Failed storage write rolls back state, snapshots and preferences');
  await restored.getByRole('button', { name: 'Close modal', exact: true }).click();
  await restored.reload();
  await restored.getByRole('button', { name: 'My Journey', exact: true }).waitFor();
  assert.deepEqual(await read(restored), original);
  for (const width of [320, 390, 1280]) {
    await restored.setViewportSize({ width, height: 844 });
    const overflow = await restored.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await restored.screenshot({ path: `${dir}/journey-${width}.png`, fullPage: true });
    if (overflow) console.log(await restored.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 15).map(e => ({tag: e.tagName, cls: e.className, text: e.textContent?.slice(0, 70), right: e.getBoundingClientRect().right}))));
    assert.equal(overflow, false, `No page overflow at ${width}px`);
  }
  for (const rate of [0, 10, 7.5]) {
    await page.evaluate(({ fixture, stateKey, rate }) => {
      localStorage.setItem(stateKey, JSON.stringify({ ...fixture, annualStepUpPercent: rate, journeySchedule: undefined, contributionRecords: [], catchUpCommitment: undefined }));
    }, { fixture, stateKey, rate });
    await page.reload();
    await page.getByRole('button', { name: 'Start my journey', exact: true }).click();
    await page.getByRole('button', { name: 'Start my journey', exact: true }).waitFor({ state: 'hidden' });
    assert.equal((await read(page)).state.journeySchedule.originalStepUpPercent, rate);
  }
  assert.deepEqual(errors, [], 'Obfuscated production bundle has no runtime errors');
  console.log('PASS: actual downloaded backup → clean context → reload → repeated import; exact data, IDs, timestamps, negative returns/P&L; invalid import preserves data; production journey at 320/390/1280px.');
} finally {
  await browser?.close();
  server.kill();
}
