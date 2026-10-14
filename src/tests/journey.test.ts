/**
 * Acceptance & Calculation Test Suite: "My investment journey"
 * 
 * Verifies against the real journey calculation functions:
 * 1. Schedule generation (start month, contribution day, leap year date clamping, step-up)
 * 2. Ledger aggregation & statuses (unconfirmed past months vs confirmed skipped vs partly added vs added)
 * 3. Shortfall calculation & exact catch-up distribution (single-rupee integrity)
 * 4. Distinct accounting: Contributions deposited vs Cost Basis vs Portfolio Value vs Investment Gains
 * 5. Backup serialization, export checkpoint generation, validation, and restore preview
 */

import {
  getCurrentDateInfo,
  getDaysInMonth,
  getValidScheduledDate,
  addMonthsToKey,
  generatePlannedSchedule,
  calculateJourneyMetrics,
  calculateCatchUpDistribution,
  calculateContributionVsGainDistinction,
  calculateUpdatedProjection
} from '../utils/journey';

import {
  createBackupPayload,
  validateBackupContent,
  BACKUP_APP_IDENTIFIER
} from '../utils/backup';

import {
  HorizonState,
  JourneySchedule,
  ContributionRecord,
  HorizonPlan,
  CatchUpCommitment
} from '../types/horizon';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message} (Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
}

console.log('=== TEST SUITE: Horizon My Investment Journey ===\n');

// -------------------------------------------------------------
// 1. SCHEDULE GENERATION & CALENDAR EDGE CASES
// -------------------------------------------------------------
console.log('1. Schedule Generation & Calendar Invariants:');

// October 2026 start with preferred day 31
const schedule1: JourneySchedule = {
  isActive: true,
  startMonth: '2026-10',
  contributionDay: 31,
  originalMonthlyAmount: 25000,
  originalStepUpPercent: 10,
  originalHorizonYears: 5,
  originalReturnRate: 0.12,
  originalInflationRate: 0.08,
  createdAt: '2026-10-14'
};

const planned = generatePlannedSchedule(schedule1, {
  horizonYears: 2,
  currentMonthKey: '2026-10'
});

assertEquals(planned.length, 24, 'Generates 24 scheduled months for 2-year timeline');
assertEquals(planned[0].monthKey, '2026-10', 'First month is 2026-10');
assertEquals(planned[0].scheduledDate, '2026-10-31', 'Clamps October preferred day 31 to 2026-10-31');
assertEquals(planned[1].monthKey, '2026-11', 'Second month is 2026-11');
assertEquals(planned[1].scheduledDate, '2026-11-30', 'Clamps November preferred day 31 to 2026-11-30 (not 31)');
assertEquals(planned[4].monthKey, '2027-02', 'Fifth month is 2027-02');
assertEquals(planned[4].scheduledDate, '2027-02-28', 'Clamps Feb 2027 to 2027-02-28 (non-leap year)');

// Leap year 2028 check
assertEquals(getDaysInMonth(2028, 2), 29, '2028 is leap year with 29 days in Feb');
assertEquals(getValidScheduledDate('2028-02', 31), '2028-02-29', 'Clamps Feb 2028 day 31 to 2028-02-29');

// Step-up verification: Months 1-12 = 25,000; Months 13-24 = +10% -> 27,500
assertEquals(planned[0].baseAmount, 25000, 'Month 1 base amount is 25,000 PKR');
assertEquals(planned[11].baseAmount, 25000, 'Month 12 base amount is 25,000 PKR');
assertEquals(planned[12].baseAmount, 27500, 'Month 13 (Year 2) base amount is 27,500 PKR (+10% step-up)');
assertEquals(planned[12].stepUpAppliedPercent, 10, 'Month 13 reflects 10% step-up applied');

// -------------------------------------------------------------
// 2. LEDGER AGGREGATION & MONTHLY STATUSES
// -------------------------------------------------------------
console.log('\n2. Ledger Aggregation & Distinct Monthly Statuses:');

// October: 25k scheduled. Recorded 15k on Oct 5 and 10k on Oct 20 -> Full 25k (added)
// November: 25k scheduled. Recorded 12k on Nov 15 -> Partial (partly_added, shortfall 13k)
// December: 25k scheduled. Confirmed skipped by user.
const records: ContributionRecord[] = [
  { id: 'rec-1', monthKey: '2026-10', date: '2026-10-05', amount: 15000, note: 'Salary bonus', status: 'partly_added' },
  { id: 'rec-2', monthKey: '2026-10', date: '2026-10-20', amount: 10000, note: 'Mid-month saving', status: 'added' },
  { id: 'rec-3', monthKey: '2026-11', date: '2026-11-15', amount: 12000, note: 'Partial deposit', status: 'partly_added' }
];

const decisions = {
  '2026-12': { decision: 'skipped' as const, decidedAt: '2026-12-05' }
};

// Simulate evaluation as of December 2026 (custom today = 2026-12-15)
const metricsDec = calculateJourneyMetrics(
  schedule1,
  records,
  decisions,
  undefined,
  new Date(2026, 11, 15) // Dec 15, 2026
);

assertEquals(metricsDec.recordedContributionsToDate, 37000, 'Recorded contributions sum to 37,000 PKR (15k + 10k + 12k)');
const octSummary = metricsDec.months.find(m => m.monthKey === '2026-10');
assert(octSummary !== undefined && octSummary.status === 'added', 'October with full 25k marked as "added"');
assertEquals(octSummary?.recordedAmount, 25000, 'October aggregated recorded amount is 25,000 PKR');
assertEquals(octSummary?.records.length, 2, 'October preserved 2 distinct deposit records');

const novSummary = metricsDec.months.find(m => m.monthKey === '2026-11');
assert(novSummary !== undefined && novSummary.status === 'partly_added', 'November marked as "partly_added"');
assertEquals(novSummary?.recordedAmount, 12000, 'November recorded amount is 12,000 PKR');
assertEquals(novSummary?.remainingAmount, 13000, 'November remaining amount is 13,000 PKR');

const decSummary = metricsDec.months.find(m => m.monthKey === '2026-12');
assert(decSummary !== undefined && decSummary.status === 'skipped', 'December marked as "skipped" following user decision');

// Test unconfirmed past month detection
const unconfirmedSchedule: JourneySchedule = {
  isActive: true,
  startMonth: '2026-08',
  contributionDay: 5,
  originalMonthlyAmount: 20000,
  originalStepUpPercent: 0,
  originalHorizonYears: 1,
  originalReturnRate: 0.12,
  originalInflationRate: 0.08,
  createdAt: '2026-08-01'
};
// As of Oct 2026, Aug and Sep had no payments and no explicit skipped decision
const unconfirmedMetrics = calculateJourneyMetrics(
  unconfirmedSchedule,
  [],
  {},
  undefined,
  new Date(2026, 9, 14) // Oct 14, 2026
);
assertEquals(unconfirmedMetrics.unconfirmedPastMonthsCount, 2, 'Detects 2 unconfirmed past months (Aug, Sep)');
assert(unconfirmedMetrics.hasUnconfirmedMonths, 'hasUnconfirmedMonths flag is true');
const augSummary = unconfirmedMetrics.months.find(m => m.monthKey === '2026-08');
assertEquals(augSummary?.status, 'not_confirmed', 'August marked as "not_confirmed" (never assumed as confirmed skipped or paid)');

// -------------------------------------------------------------
// 3. SHORTFALL AND EXACT CATCH-UP DISTRIBUTION (ZERO SINGLE-RUPEE LEAKAGE)
// -------------------------------------------------------------
console.log('\n3. Catch-Up Distribution Math:');

const gapAmount = 13000; // e.g. 13,000 PKR shortfall
const spread3Months = calculateCatchUpDistribution(gapAmount, 3, '2027-01');

assertEquals(spread3Months.breakdown.length, 3, 'Generates 3 catch-up monthly allocations');
// 13,000 / 3 = 4,333 base + 1 remainder
// Month 1: 4,334
// Month 2: 4,333
// Month 3: 4,333
assertEquals(spread3Months.breakdown[0].extraCatchUp, 4334, 'First month receives 4,334 PKR (+1 remainder rupee)');
assertEquals(spread3Months.breakdown[1].extraCatchUp, 4333, 'Second month receives 4,333 PKR');
assertEquals(spread3Months.breakdown[2].extraCatchUp, 4333, 'Third month receives 4,333 PKR');

const sumSpread = Object.values(spread3Months.monthlyAllocations).reduce((a, b) => a + b, 0);
assertEquals(sumSpread, 13000, 'Sum of distributed amounts matches 13,000 PKR exactly with 0 single-rupee leakage');

// Verify integration of catchUpCommitment in generatePlannedSchedule
const commitment: CatchUpCommitment = {
  strategy: 'spread_out',
  startMonthKey: '2027-01',
  spreadMonths: 3,
  totalGapAmount: 13000,
  extraMonthlyAmount: 4333,
  monthlyAllocations: spread3Months.monthlyAllocations,
  appliedAt: '2026-12-15'
};

const plannedWithCatchUp = generatePlannedSchedule(schedule1, {
  catchUpCommitment: commitment,
  currentMonthKey: '2026-12'
});

const jan2027 = plannedWithCatchUp.find(m => m.monthKey === '2027-01');
assertEquals(jan2027?.baseAmount, 25000, 'Jan 2027 regular base is 25,000 PKR');
assertEquals(jan2027?.catchUpAmount, 4334, 'Jan 2027 catch-up amount is 4,334 PKR');
assertEquals(jan2027?.totalScheduledAmount, 29334, 'Jan 2027 total scheduled target is 29,334 PKR');

// -------------------------------------------------------------
// 4. INVARIANT: CONTRIBUTIONS VS PURCHASES VS INVESTMENT GAINS
// -------------------------------------------------------------
console.log('\n4. Financial Invariants: Contributions vs Purchases vs Gains:');

// Total deposited = 50,000 PKR
// Purchases in stocks = 40,000 PKR (cost basis)
// Current market valuation of those stocks = 46,000 PKR
const breakdown = calculateContributionVsGainDistinction(50000, 40000, 46000);

assertEquals(breakdown.totalDeposited, 50000, 'Total deposited matches money transferred');
assertEquals(breakdown.deployedInStocks, 40000, 'Deployed in stocks matches cost basis');
assertEquals(breakdown.uninvestedCash, 10000, 'Uninvested cash is 50,000 - 40,000 = 10,000 PKR');
assertEquals(breakdown.currentHoldingsValue, 46000, 'Holdings value is 46,000 PKR');
assertEquals(breakdown.totalAccountValue, 56000, 'Total account value = 46,000 stocks + 10,000 cash = 56,000 PKR');
assertEquals(breakdown.unrealizedGainLossPKR, 6000, 'Stock unrealized gain is 46k - 40k = +6,000 PKR');
assertEquals(breakdown.totalGainLossPKR, 6000, 'Total gain is 56,000 total account - 50,000 deposited = +6,000 PKR');
assertEquals(breakdown.totalGainLossPercent, 12, 'Total gain percentage is +6,000 / 50,000 = +12.0%');

// Verify that if uninvested cash is 0 and stocks dropped:
const lossBreakdown = calculateContributionVsGainDistinction(30000, 30000, 24000);
assertEquals(lossBreakdown.uninvestedCash, 0, 'Uninvested cash is 0');
assertEquals(lossBreakdown.totalGainLossPKR, -6000, 'Total loss is -6,000 PKR');
assertEquals(lossBreakdown.totalGainLossPercent, -20, 'Total loss percentage is -20.0%');

// -------------------------------------------------------------
// 5. BACKUP SERIALIZATION, VALIDATION, AND PREVIEWS
// -------------------------------------------------------------
console.log('\n5. Portable Backups: Export, Validation, and Safety:');

const mockPlan: HorizonPlan = {
  existingInvestmentsToProject: 100000,
  cashAvailableToInvest: 0,
  monthlyInvestment: 25000,
  annualStepUpPercent: 10,
  assumptions: {
    timeHorizonYears: 10,
    assumedAnnualReturnRate: 0.12,
    assumedAnnualInflationRate: 0.08,
    shariahPreference: false
  }
};

const fullState: HorizonState = {
  version: 2,
  currentStep: 5,
  hasCompletedOnboarding: true,
  showLakhFormat: true,
  investmentChoice: 'stocks_detail',
  stockHoldings: [
    { id: 'h1', symbolOrName: 'SYS', shares: 100, pricePerShare: 480, marketValue: 48000, averageBuyingPrice: 420 },
    { id: 'h2', symbolOrName: 'LUCK', shares: 50, pricePerShare: 810, marketValue: 40500, averageBuyingPrice: 750 }
  ],
  totalInvestmentsValue: 88500,
  cashAvailableToInvest: 0,
  trackedWealth: [],
  monthlyChoice: 'enter_amount',
  budget: { monthlyIncome: 0, monthlyExpenses: 0, monthlyCashSavingsCommitment: 0 },
  monthlyInvestment: 25000,
  annualStepUpPercent: 10,
  assumptions: mockPlan.assumptions,
  journeySchedule: schedule1,
  contributionRecords: records,
  catchUpCommitment: commitment,
  monthDecisions: decisions,
  lastSelectedTab: 'journey',
  lastUpdated: '2026-10-14'
};

const payload = createBackupPayload(fullState, [], 'journey');
const exportedJson = JSON.stringify(payload, null, 2);
assert(exportedJson.length > 50, 'Checkpoint JSON exported successfully');
assert(exportedJson.includes('"app": "horizon_investing_companion"'), 'Backup contains horizon identifier');
assert(exportedJson.includes('"SYS"'), 'Backup includes holdings data');
assert(exportedJson.includes('"rec-1"'), 'Backup includes contribution records');

// Validate the exported backup
const validationResult = validateBackupContent(exportedJson);
assert(validationResult.isValid, 'Valid backup passes validation');
assertEquals(validationResult.preview?.holdingsCount, 2, 'Preview accurately counts 2 holdings');
assertEquals(validationResult.preview?.contributionRecordsCount, 3, 'Preview accurately counts 3 contribution records');
assertEquals(validationResult.preview?.totalContributionsRecorded, 37000, 'Preview accurately totals 37,000 PKR contributed');
assertEquals(validationResult.preview?.journeyActive, true, 'Preview confirms active journey schedule');

// Test rejection of non-Horizon files
const nonHorizonJson = JSON.stringify({ app: 'different-app', schemaVersion: 1, data: {} });
const nonHorizonValidation = validateBackupContent(nonHorizonJson);
assert(!nonHorizonValidation.isValid, 'Rejects files with unrecognized application identifier');

// Test rejection of corrupted JSON
const badJsonValidation = validateBackupContent('{ not valid json');
assert(!badJsonValidation.isValid, 'Gracefully handles malformed JSON without crashing');

// Test rejection of oversized file (> 5MB)
const oversizedValidation = validateBackupContent('{}', 6 * 1024 * 1024);
assert(!oversizedValidation.isValid, 'Rejects files exceeding 5MB safety limit');

// -------------------------------------------------------------
// RESULTS SUMMARY
// -------------------------------------------------------------
console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log(`✓ All ${passed} acceptance and calculation assertions passed successfully!`);
}
