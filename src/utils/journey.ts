/**
 * Horizon Investment Journey Engine
 * 
 * Manages monthly investment schedules, actual contribution records,
 * progress tracking, contribution shortfall calculation, catch-up distribution,
 * and forward projections.
 * 
 * Strict financial separation:
 * - Contributions add external money to the investment account.
 * - Opening capital is excluded from contribution totals and graphs.
 * - Catch-up commitments are planned future payments, not retroactive money or recorded contributions.
 * - Catch-up closes the contribution gap but does not promise recovering missed market compounding.
 */

import {
  JourneySchedule,
  ContributionRecord,
  ContributionStatus,
  CatchUpCommitment,
  MonthDecision,
  YearProjectionPoint,
} from '../types/horizon';

/**
 * Returns current date in Pakistan format (YYYY-MM-DD) and monthKey (YYYY-MM)
 * Note: Default local task runtime reference is October 14, 2026.
 */
export function getCurrentDateInfo(customDate?: Date): {
  dateString: string;
  monthKey: string;
  year: number;
  month: number; // 1-12
  day: number;
} {
  const d = customDate || new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const monthKey = `${year}-${pad(month)}`;
  const dateString = `${year}-${pad(month)}-${pad(day)}`;

  return { dateString, monthKey, year, month, day };
}

/**
 * Days in month helper handling leap years
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Clamps preferred day of month (e.g. 31) to the actual valid max day of that month.
 */
export function getValidScheduledDate(monthKey: string, preferredDay: number): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const maxDays = getDaysInMonth(year, month);
  const validDay = Math.min(Math.max(1, preferredDay), maxDays);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${year}-${pad(month)}-${pad(validDay)}`;
}

/**
 * Format month key YYYY-MM to human readable (e.g. "October 2026")
 */
export function formatMonthKey(monthKey: string): string {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const date = new Date(parseInt(yearStr, 10), monthIdx, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Short month label (e.g. "Oct '26")
 */
export function formatShortMonthKey(monthKey: string): string {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const date = new Date(parseInt(yearStr, 10), monthIdx, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/**
 * Add N months to a YYYY-MM month key
 */
export function addMonthsToKey(monthKey: string, monthsToAdd: number): string {
  const [yearStr, monthStr] = monthKey.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + monthsToAdd;

  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${year}-${pad(month)}`;
}

/**
 * Month difference between two month keys (monthKey2 - monthKey1)
 */
export function getMonthDifference(monthKey1: string, monthKey2: string): number {
  const [y1, m1] = monthKey1.split('-').map(Number);
  const [y2, m2] = monthKey2.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export interface ScheduledMonthItem {
  monthIndex: number; // 1-based index (Month 1, Month 2, ..., Month 13 has step up)
  monthKey: string;   // e.g. "2026-10"
  scheduledDate: string; // e.g. "2026-10-05"
  baseAmount: number;    // Regular scheduled amount for this month
  stepUpAppliedPercent: number; // Step-up factor active (e.g. 0% for yr 1, 10% for yr 2)
  catchUpAmount: number; // Catch-up allocated to this month
  totalScheduledAmount: number; // baseAmount + catchUpAmount
  isFuture: boolean;
  isCurrent: boolean;
  isPast: boolean;
}

/**
 * Generates the full scheduled months timeline for the journey.
 * Applies first annual step-up at journey month 13, month 25, etc.
 * Adds catch-up allocations if a catch-up commitment is active.
 */
export function generatePlannedSchedule(
  schedule: JourneySchedule,
  options?: {
    horizonYears?: number;
    catchUpCommitment?: CatchUpCommitment;
    currentMonthKey?: string;
  }
): ScheduledMonthItem[] {
  const horizonYears = options?.horizonYears ?? schedule.originalHorizonYears ?? 10;
  const totalMonths = horizonYears * 12;
  const currentKey = options?.currentMonthKey ?? getCurrentDateInfo().monthKey;
  const catchUp = options?.catchUpCommitment;

  const result: ScheduledMonthItem[] = [];

  for (let i = 0; i < totalMonths; i++) {
    const monthIndex = i + 1; // 1-based
    const monthKey = addMonthsToKey(schedule.startMonth, i);
    const scheduledDate = getValidScheduledDate(monthKey, schedule.contributionDay);

    // Calculate step-up: Month 1-12 = 0 stepups, Month 13-24 = 1 stepup, etc.
    const completedYears = Math.floor(i / 12);
    const stepUpRate = (schedule.originalStepUpPercent || 0) / 100;
    const stepUpMultiplier = Math.pow(1 + stepUpRate, completedYears);
    const baseAmount = Math.round(schedule.originalMonthlyAmount * stepUpMultiplier);
    const stepUpAppliedPercent = Math.round((stepUpMultiplier - 1) * 100);

    // Catch-up allocation
    let catchUpAmount = 0;
    if (catchUp && catchUp.strategy !== 'none' && catchUp.monthlyAllocations) {
      catchUpAmount = catchUp.monthlyAllocations[monthKey] || 0;
    }

    const totalScheduledAmount = baseAmount + catchUpAmount;

    const diffToCurrent = getMonthDifference(currentKey, monthKey);
    const isPast = diffToCurrent < 0;
    const isCurrent = diffToCurrent === 0;
    const isFuture = diffToCurrent > 0;

    result.push({
      monthIndex,
      monthKey,
      scheduledDate,
      baseAmount,
      stepUpAppliedPercent,
      catchUpAmount,
      totalScheduledAmount,
      isFuture,
      isCurrent,
      isPast,
    });
  }

  return result;
}

export interface MonthLedgerSummary {
  monthIndex: number;
  monthKey: string;
  scheduledDate: string;
  plannedAmount: number;
  baseAmount: number;
  catchUpAmount: number;
  recordedAmount: number;
  remainingAmount: number;
  status: ContributionStatus;
  statusLabel: string;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  records: ContributionRecord[];
  decision?: MonthDecision;
}

export interface JourneyMetrics {
  totalMonthsActive: number;
  scheduledContributionsDueToDate: number;
  recordedContributionsToDate: number;
  contributionGap: number;
  amountAhead: number;
  unconfirmedPastMonthsCount: number;
  hasUnconfirmedMonths: boolean;
  currentMonthSummary?: MonthLedgerSummary;
  months: MonthLedgerSummary[];
  cumulativeTimeline: Array<{
    monthKey: string;
    monthIndex: number;
    date: string;
    plannedCumulative: number;
    recordedCumulative: number;
    isPastOrCurrent: boolean;
  }>;
}

/**
 * Calculates full ledger metrics comparing planned vs actual contributions.
 */
export function calculateJourneyMetrics(
  schedule: JourneySchedule,
  records: ContributionRecord[],
  monthDecisions: Record<string, MonthDecision> = {},
  catchUpCommitment?: CatchUpCommitment,
  customToday?: Date
): JourneyMetrics {
  const todayInfo = getCurrentDateInfo(customToday);
  const plannedMonths = generatePlannedSchedule(schedule, {
    catchUpCommitment,
    currentMonthKey: todayInfo.monthKey,
  });

  // Group records by monthKey
  const recordsByMonth: Record<string, ContributionRecord[]> = {};
  records.forEach((r) => {
    if (!recordsByMonth[r.monthKey]) {
      recordsByMonth[r.monthKey] = [];
    }
    recordsByMonth[r.monthKey].push(r);
  });

  let scheduledContributionsDueToDate = 0;
  let recordedContributionsToDate = 0;
  let unconfirmedPastMonthsCount = 0;

  const monthSummaries: MonthLedgerSummary[] = [];

  let runningPlannedCumulative = 0;
  let runningRecordedCumulative = 0;
  const cumulativeTimeline: JourneyMetrics['cumulativeTimeline'] = [];

  plannedMonths.forEach((planned) => {
    const monthKey = planned.monthKey;
    const monthRecords = recordsByMonth[monthKey] || [];
    const recordedAmount = monthRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
    const plannedAmount = planned.totalScheduledAmount;
    const decision = monthDecisions[monthKey];

    // Determine status
    let status: ContributionStatus = 'upcoming';
    let statusLabel = 'Upcoming';

    if (planned.isPast) {
      if (decision?.decision === 'skipped') {
        status = 'skipped';
        statusLabel = recordedAmount > 0 ? 'Partly added (Skipped remainder)' : 'Skipped';
      } else if (recordedAmount >= plannedAmount && plannedAmount > 0) {
        status = 'added';
        statusLabel = recordedAmount > plannedAmount ? 'Added (Extra)' : 'Added';
      } else if (recordedAmount > 0) {
        status = 'partly_added';
        statusLabel = 'Partly added';
      } else {
        // 0 recorded and no explicit decision
        status = 'not_confirmed';
        statusLabel = 'Not confirmed';
        unconfirmedPastMonthsCount++;
      }
    } else if (planned.isCurrent) {
      const isPastDueDate = todayInfo.dateString >= planned.scheduledDate;

      if (decision?.decision === 'skipped') {
        status = 'skipped';
        statusLabel = recordedAmount > 0 ? 'Partly added (Skipped remainder)' : 'Skipped';
      } else if (recordedAmount >= plannedAmount && plannedAmount > 0) {
        status = 'added';
        statusLabel = recordedAmount > plannedAmount ? 'Added (Extra)' : 'Added';
      } else if (recordedAmount > 0) {
        status = 'partly_added';
        statusLabel = 'Partly added';
      } else if (isPastDueDate) {
        status = 'due';
        statusLabel = 'Due';
      } else {
        status = 'upcoming';
        statusLabel = 'Upcoming';
      }
    } else {
      // Future month
      if (recordedAmount > 0) {
        status = 'partly_added';
        statusLabel = 'Pre-paid';
      } else {
        status = 'upcoming';
        statusLabel = 'Upcoming';
      }
    }

    const remainingAmount = Math.max(0, plannedAmount - recordedAmount);

    const summary: MonthLedgerSummary = {
      monthIndex: planned.monthIndex,
      monthKey,
      scheduledDate: planned.scheduledDate,
      plannedAmount,
      baseAmount: planned.baseAmount,
      catchUpAmount: planned.catchUpAmount,
      recordedAmount,
      remainingAmount,
      status,
      statusLabel,
      isPast: planned.isPast,
      isCurrent: planned.isCurrent,
      isFuture: planned.isFuture,
      records: monthRecords,
      decision,
    };

    monthSummaries.push(summary);

    // Accumulate metrics for due-to-date
    // A month's scheduled amount is considered due if it is in the past, OR if it's the current month AND the scheduled day has arrived (or money was already added)
    const isDue = planned.isPast || (planned.isCurrent && (todayInfo.dateString >= planned.scheduledDate || recordedAmount > 0));

    if (isDue) {
      // Catch-up reallocates existing debt; it never creates new debt.
      scheduledContributionsDueToDate += planned.baseAmount;
    }

    // Money actually recorded through today counts
    recordedContributionsToDate += recordedAmount;

    // Cumulative timeline calculation
    runningPlannedCumulative += planned.baseAmount;
    runningRecordedCumulative += recordedAmount;

    // Push to cumulative chart
    cumulativeTimeline.push({
      monthKey,
      monthIndex: planned.monthIndex,
      date: planned.scheduledDate,
      plannedCumulative: runningPlannedCumulative,
      recordedCumulative: runningRecordedCumulative,
      isPastOrCurrent: planned.isPast || planned.isCurrent,
    });
  });

  const contributionGap = Math.max(0, scheduledContributionsDueToDate - recordedContributionsToDate);
  const amountAhead = Math.max(0, recordedContributionsToDate - scheduledContributionsDueToDate);

  const currentMonthSummary = monthSummaries.find((m) => m.isCurrent);

  return {
    totalMonthsActive: monthSummaries.filter((m) => m.isPast || m.isCurrent).length,
    scheduledContributionsDueToDate,
    recordedContributionsToDate,
    contributionGap,
    amountAhead,
    unconfirmedPastMonthsCount,
    hasUnconfirmedMonths: unconfirmedPastMonthsCount > 0,
    currentMonthSummary,
    months: monthSummaries,
    cumulativeTimeline,
  };
}

/**
 * Calculates exact catch-up distribution across N future months.
 * Guarantees that the sum of allocated amounts matches the gap down to the single rupee.
 */
export function calculateCatchUpDistribution(
  gapAmount: number,
  spreadMonths: number,
  startMonthKey: string,
  endMonthKey?: string
): {
  monthlyAllocations: Record<string, number>;
  breakdown: Array<{
    monthKey: string;
    monthIndex: number;
    extraCatchUp: number;
  }>;
} {
  if (gapAmount <= 0 || spreadMonths <= 0) {
    return { monthlyAllocations: {}, breakdown: [] };
  }

  const roundedGap = Math.round(gapAmount);
  const availableMonths = endMonthKey === undefined ? 24 : Math.max(0, getMonthDifference(startMonthKey, endMonthKey) + 1);
  if (availableMonths === 0) return { monthlyAllocations: {}, breakdown: [] };
  const safeMonths = Math.max(1, Math.min(24, availableMonths, Math.round(spreadMonths)));

  const basePerMonth = Math.floor(roundedGap / safeMonths);
  const remainder = roundedGap % safeMonths;

  const monthlyAllocations: Record<string, number> = {};
  const breakdown: Array<{ monthKey: string; monthIndex: number; extraCatchUp: number }> = [];

  for (let i = 0; i < safeMonths; i++) {
    const monthKey = addMonthsToKey(startMonthKey, i);
    // Add 1 rupee of remainder to the first `remainder` months so sum is exact
    const extraCatchUp = basePerMonth + (i < remainder ? 1 : 0);
    monthlyAllocations[monthKey] = extraCatchUp;
    breakdown.push({
      monthKey,
      monthIndex: i + 1,
      extraCatchUp,
    });
  }

  return { monthlyAllocations, breakdown };
}

/**
 * Generates forward projection based on actual recorded contributions to date
 * plus future scheduled contributions (including catch-ups), keeping the baseline unchanged.
 */
export function calculateUpdatedProjection(
  schedule: JourneySchedule,
  records: ContributionRecord[],
  assumptions: {
    timeHorizonYears: number;
    assumedAnnualReturnRate: number;
    assumedAnnualInflationRate: number;
  },
  openingCapital: number = 0,
  catchUpCommitment?: CatchUpCommitment,
  customToday?: Date
): {
  timeline: YearProjectionPoint[];
  endingNominalValue: number;
  endingRealValue: number;
  totalInvested: number;
  totalDeposited: number;
  totalGrowth: number;
  contributionGapAtPresent: number;
} {
  const currentKey = getCurrentDateInfo(customToday).monthKey;
  const plannedSchedule = generatePlannedSchedule(schedule, {
    horizonYears: assumptions.timeHorizonYears,
    catchUpCommitment,
    currentMonthKey: currentKey,
  });

  const recordsByMonth: Record<string, number> = {};
  records.forEach((r) => {
    recordsByMonth[r.monthKey] = (recordsByMonth[r.monthKey] || 0) + (r.amount || 0);
  });

  const monthlyRate = Math.pow(1 + assumptions.assumedAnnualReturnRate, 1 / 12) - 1;
  const monthlyInflationRate = Math.pow(1 + assumptions.assumedAnnualInflationRate, 1 / 12) - 1;

  let currentPortfolioValue = openingCapital;
  let cumulativeDeposits = 0;

  const timeline: YearProjectionPoint[] = [];

  // Track month by month
  plannedSchedule.forEach((month, idx) => {
    const isPast = month.isPast;
    // In past months, use actual recorded amount. In future/current, use planned total
    const depositThisMonth = isPast
      ? recordsByMonth[month.monthKey] ?? 0
      : month.totalScheduledAmount;

    // End-of-month contribution convention: investment return on start balance + deposit
    const startBalance = currentPortfolioValue;
    const growth = startBalance * monthlyRate;
    currentPortfolioValue = startBalance + growth + depositThisMonth;
    cumulativeDeposits += depositThisMonth;

    // Check if this is the end of a year (month 12, 24, 36...)
    if ((idx + 1) % 12 === 0 || idx === plannedSchedule.length - 1) {
      const yearNum = Math.ceil((idx + 1) / 12);
      const totalContributed = openingCapital + cumulativeDeposits;
      const totalGrowth = currentPortfolioValue - totalContributed;
      const discountFactor = Math.pow(1 + monthlyInflationRate, idx + 1);
      const realPurchasingPower = currentPortfolioValue / discountFactor;

      timeline.push({
        year: yearNum,
        monthlyContributionThisYear: month.baseAmount,
        totalMonthlyDeposits: cumulativeDeposits,
        totalContributions: totalContributed,
        investmentGrowth: totalGrowth,
        nominalPortfolioValue: Math.round(currentPortfolioValue),
        realPurchasingPower: Math.round(realPurchasingPower),
      });
    }
  });

  const endingNominal = Math.round(currentPortfolioValue);
  const totalContributed = openingCapital + cumulativeDeposits;
  const totalGrowth = endingNominal - totalContributed;
  const discountFactor = Math.pow(1 + assumptions.assumedAnnualInflationRate, assumptions.timeHorizonYears);
  const endingReal = Math.round(endingNominal / discountFactor);

  const metrics = calculateJourneyMetrics(schedule, records, {}, catchUpCommitment, customToday);

  return {
    timeline,
    endingNominalValue: endingNominal,
    endingRealValue: endingReal,
    totalInvested: totalContributed,
    totalDeposited: cumulativeDeposits,
    totalGrowth,
    contributionGapAtPresent: metrics.contributionGap,
  };
}

/**
 * Pure accounting calculation separating:
 * 1. Total money deposited (contributions)
 * 2. Money deployed in stocks (cost basis)
 * 3. Uninvested cash reserve in investment account
 * 4. Current valuation of stocks
 * 5. Total account value (stocks + cash)
 * 6. True unrealized investment gain/loss
 *
 * Invariant: Never confuse cash deposited with investment return.
 */
export function calculateContributionVsGainDistinction(
  totalDeposited: number,
  costBasisOfStocks: number,
  currentMarketValueOfStocks: number
): {
  totalDeposited: number;
  deployedInStocks: number;
  uninvestedCash: number;
  currentHoldingsValue: number;
  totalAccountValue: number;
  unrealizedGainLossPKR: number;
  unrealizedGainLossPercent: number;
  totalGainLossPKR: number;
  totalGainLossPercent: number;
} {
  const safeDeposited = Math.max(0, totalDeposited);
  const safeCostBasis = Math.max(0, costBasisOfStocks);
  const safeHoldingsValue = Math.max(0, currentMarketValueOfStocks);

  // Uninvested cash in brokerage/savings account
  const uninvestedCash = Math.max(0, safeDeposited - safeCostBasis);

  // Total account value = stocks + cash
  const totalAccountValue = safeHoldingsValue + uninvestedCash;

  // Stock unrealized gain/loss
  const unrealizedGainLossPKR = safeCostBasis > 0 ? safeHoldingsValue - safeCostBasis : 0;
  const unrealizedGainLossPercent =
    safeCostBasis > 0 ? (unrealizedGainLossPKR / safeCostBasis) * 100 : 0;

  // Overall account gain/loss relative to all capital deposited
  const totalGainLossPKR = safeDeposited > 0 ? totalAccountValue - safeDeposited : 0;
  const totalGainLossPercent =
    safeDeposited > 0 ? (totalGainLossPKR / safeDeposited) * 100 : 0;

  return {
    totalDeposited: safeDeposited,
    deployedInStocks: safeCostBasis,
    uninvestedCash,
    currentHoldingsValue: safeHoldingsValue,
    totalAccountValue,
    unrealizedGainLossPKR,
    unrealizedGainLossPercent,
    totalGainLossPKR,
    totalGainLossPercent,
  };
}
