import assert from 'node:assert/strict';
import { DEFAULT_INITIAL_STATE, STORAGE_KEY, saveState } from '../utils/storage';
import { createBackupPayload, validateBackupContent, restoreValidatedBackup } from '../utils/backup';
import { PORTFOLIO_SNAPSHOT_KEY } from '../utils/portfolioStorage';
import { generatePlannedSchedule, calculateJourneyMetrics, calculateCatchUpDistribution, calculateUpdatedProjection } from '../utils/journey';
import type { JourneySchedule, CatchUpCommitment, ContributionRecord } from '../types/horizon';

const schedule: JourneySchedule = { isActive: true, startMonth: '2026-01', contributionDay: 5,
  originalMonthlyAmount: 20000, originalStepUpPercent: 0, originalHorizonYears: 2,
  originalReturnRate: -.05, originalInflationRate: .08, createdAt: '2026-01-01T00:00:00Z' };
for (const rate of [0, 10, 7.5]) {
  const months = generatePlannedSchedule({ ...schedule, originalStepUpPercent: rate });
  assert.equal(months[11].baseAmount, 20000);
  assert.equal(months[12].baseAmount, Math.round(20000 * (1 + rate / 100)));
}
const catchUp: CatchUpCommitment = { strategy: 'next_month', totalGapAmount: 20000,
  monthlyAllocations: { '2026-02': 20000 }, appliedAt: '2026-01-10T00:00:00Z' };
const today = new Date(2026, 1, 10);
const gap = (commitment?: CatchUpCommitment, records: ContributionRecord[] = []) =>
  calculateJourneyMetrics(schedule, records, {}, commitment, today).contributionGap;
assert.equal(gap(catchUp), 40000, 'Missed catch-up is not a second debt');
assert.equal(gap({ ...catchUp }), 40000, 'Reapplying replaces the commitment');
assert.equal(gap({ ...catchUp, monthlyAllocations: { '2026-02': 10000, '2026-03': 10000 } }), 40000);
assert.equal(gap(), 40000, 'Cancelling does not erase or increase debt');
assert.equal(gap(catchUp, [{ id: 'partial', monthKey: '2026-02', date: '2026-02-08', amount: 25000, status: 'added' }]), 15000);
assert.equal(calculateJourneyMetrics(schedule, [], {}, catchUp, today).cumulativeTimeline[1].plannedCumulative, 40000);
const bounded = calculateCatchUpDistribution(20001, 12, '2027-11', '2027-12');
assert.deepEqual(bounded.monthlyAllocations, { '2027-11': 10001, '2027-12': 10000 });
assert.deepEqual(calculateCatchUpDistribution(20000, 3, '2028-01', '2027-12').monthlyAllocations, {});

const original = JSON.stringify(schedule);
const projection = calculateUpdatedProjection(schedule, [{ id: 'deposit', monthKey: '2026-01', date: '2026-01-05', amount: 5000, status: 'partly_added' }],
  { timeHorizonYears: 2, assumedAnnualReturnRate: -.05, assumedAnnualInflationRate: .08 }, 100000, undefined, today);
assert.equal(projection.totalInvested, 100000 + 5000 + 23 * 20000, 'Past actual replaces planned deposit');
assert.ok(projection.totalGrowth < 0, 'Negative return remains a loss');
assert.equal(JSON.stringify(schedule), original, 'Baseline remains unchanged');

const state = { ...DEFAULT_INITIAL_STATE, assumptions: { ...DEFAULT_INITIAL_STATE.assumptions, assumedAnnualReturnRate: -.05 },
  stockHoldings: [{ id: 'holding', symbolOrName: 'FFC', shares: 10, pricePerShare: 90, averageBuyingPrice: 100, marketValue: 900 }], journeySchedule: schedule };
const backup = createBackupPayload(state, [], 'journey');
assert.equal(validateBackupContent(JSON.stringify(backup)).isValid, true);
for (const field of ['shares', 'pricePerShare', 'averageBuyingPrice', 'marketValue']) {
  const invalid = structuredClone(backup);
  (invalid.data.state.stockHoldings[0] as any)[field] = -1;
  assert.equal(validateBackupContent(JSON.stringify(invalid)).isValid, false, field);
}
const invalid = structuredClone(backup);
invalid.data.state.contributionRecords = [{ id: 'bad', date: '2026-01-01', monthKey: '2026-01', amount: -1, status: 'added' }];
assert.equal(validateBackupContent(JSON.stringify(invalid)).isValid, false);

// Inject one failed write at each transaction stage, including a clean destination.
for (const populated of [true, false]) {
  for (const failKey of [STORAGE_KEY, PORTFOLIO_SNAPSHOT_KEY, 'horizon_active_tab']) {
    const data = new Map<string, string>(populated ? [[STORAGE_KEY, JSON.stringify(state)], [PORTFOLIO_SNAPSHOT_KEY, '[]'], ['horizon_active_tab', 'plan']] : []);
    const before = [...data];
    let fail = true;
    (globalThis as any).window = { localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { if (key === failKey && fail) { fail = false; throw new Error('Quota exceeded'); } data.set(key, value); },
      removeItem: (key: string) => data.delete(key),
    } };
    assert.equal(restoreValidatedBackup(backup).success, false);
    assert.deepEqual([...data], before, `Rollback ${failKey}, populated=${populated}`);
    assert.equal(restoreValidatedBackup(backup).success, true);
    assert.deepEqual(JSON.parse(data.get(STORAGE_KEY)!), JSON.parse(JSON.stringify(backup.data.state)));
    assert.equal(restoreValidatedBackup(backup).success, true);
    assert.equal(saveState(backup.data.state), true);
    assert.deepEqual(JSON.parse(data.get(STORAGE_KEY)!), JSON.parse(JSON.stringify(backup.data.state)));
  }
}
delete (globalThis as any).window;
console.log('Journey acceptance checks passed: annual increases, catch-up lifecycle, horizon, projection, negative fields, restore rollback and repeat import.');
