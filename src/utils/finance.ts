/**
 * Pure, testable financial calculation and formatting engine.
 * 
 * Compounding Convention:
 * - Return metric: Effective Annual Return (total return, with dividends reinvested).
 * - Monthly growth rate: r_monthly = (1 + r_annual)^(1/12) - 1.
 * - This guarantees that over 12 months with zero contributions, 
 *   (1 + r_monthly)^12 = 1 + r_annual exactly.
 * - Total return includes dividends; dividends are counted once within compound growth 
 *   and never double-counted.
 * 
 * Inflation Convention:
 * - Purchasing power is discounted using the user-assumed annual inflation rate:
 *   PV = FV / (1 + inflation)^year.
 * - If inflation rate is 0%, purchasing power equals nominal value.
 * - Official inflation data is not connected; all inflation rates are user-confirmed assumptions.
 */

import {
  HorizonPlan,
  ProjectionResult,
  YearProjectionPoint,
  AffordabilityBudget,
} from '../types/horizon';

/**
 * Format an amount in Pakistani Rupees (PKR)
 * Supports standard comma format (Rs. 1,500,000) and Pakistani Lakh/Crore format (Rs. 15 Lakh).
 */
export function formatPKR(
  amount: number,
  options?: {
    useLakhFormat?: boolean;
    compact?: boolean;
    showDecimals?: boolean;
    showPrefix?: boolean;
  }
): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Rs. 0';
  }

  const {
    useLakhFormat = false,
    compact = false,
    showDecimals = false,
    showPrefix = true,
  } = options || {};

  const prefix = showPrefix ? 'Rs. ' : '';
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);

  if (compact || useLakhFormat) {
    if (absVal >= 10_000_000) {
      // 1 Crore = 10,000,000
      const crores = absVal / 10_000_000;
      const formatted = crores.toLocaleString('en-US', {
        minimumFractionDigits: crores >= 10 ? 1 : 2,
        maximumFractionDigits: 2,
      });
      return `${isNegative ? '-' : ''}${prefix}${formatted} Crore`;
    } else if (absVal >= 100_000) {
      // 1 Lakh = 100,000
      const lakhs = absVal / 100_000;
      const formatted = lakhs.toLocaleString('en-US', {
        minimumFractionDigits: lakhs >= 10 ? 1 : 2,
        maximumFractionDigits: 2,
      });
      return `${isNegative ? '-' : ''}${prefix}${formatted} Lakh`;
    } else if (absVal >= 1_000) {
      const thousands = absVal / 1_000;
      return `${isNegative ? '-' : ''}${prefix}${thousands.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      })}k`;
    }
  }

  const formattedNumber = Math.round(absVal).toLocaleString('en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  return `${isNegative ? '-' : ''}${prefix}${formattedNumber}`;
}

/**
 * Parse numeric input safely, handling Pakistani formatting, commas, and edge cases.
 */
export function parseCleanNumber(input: string | number): number {
  if (typeof input === 'number') {
    return isFinite(input) ? Math.max(0, input) : 0;
  }
  if (!input) return 0;
  const clean = input.toString().replace(/[^0-9.]/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) || !isFinite(parsed) ? 0 : Math.max(0, parsed);
}

/**
 * Calculate available monthly uncommitted surplus from budget.
 * Distinguishes existing cash balances from ongoing monthly cash-saving commitments.
 * Does NOT subtract existing emergency fund balance from monthly income.
 */
export function calculateAvailableMonthlyMoney(budget: AffordabilityBudget): {
  income: number;
  expenses: number;
  cashSavingsCommitment: number;
  availableSurplus: number;
} {
  const income = Math.max(0, budget.monthlyIncome || 0);
  const expenses = Math.max(0, budget.monthlyExpenses || 0);
  const cashSavingsCommitment = Math.max(0, budget.monthlyCashSavingsCommitment || 0);

  // Available surplus = Income - Expenses - Ongoing cash savings commitment
  const availableSurplus = income - expenses - cashSavingsCommitment;

  return {
    income,
    expenses,
    cashSavingsCommitment,
    availableSurplus,
  };
}

/**
 * Translate annual increases into actual monthly amounts across key years:
 * - Monthly investment now (Year 1)
 * - Monthly investment next year (Year 2, starts Month 13)
 * - Monthly investment in the final year (Year T)
 */
export function translateAnnualIncreases(
  initialMonthly: number,
  annualStepUpPercent: number,
  totalYears: number
): {
  monthlyNow: number;
  monthlyNextYear: number;
  monthlyFinalYear: number;
} {
  const base = Math.max(0, initialMonthly || 0);
  const stepRate = Math.max(0, annualStepUpPercent || 0) / 100;
  const years = Math.max(1, totalYears || 1);

  const monthlyNow = base;
  const monthlyNextYear = Math.round(base * (1 + stepRate));
  const monthlyFinalYear = Math.round(base * Math.pow(1 + stepRate, Math.max(0, years - 1)));

  return {
    monthlyNow,
    monthlyNextYear,
    monthlyFinalYear,
  };
}

/**
 * Pure monthly compounding projection engine.
 * 
 * Rules:
 * - Opening capital consists strictly of existing investments to project + cash explicitly available to invest.
 * - Non-invested assets (gold, property, kameti, emergency cash) are excluded.
 * - Effective monthly rate: r_monthly = (1 + r_annual)^(1/12) - 1.
 * - Contributions occur at the beginning of each month.
 * - Step-up occurs at month 13, month 25, etc. (beginning of each 12-month period).
 * - Inflation discount: PV = FV / (1 + inflation)^year.
 * - When return rate is 0%: final value = opening capital + total contributions.
 */
export function calculateProjection(plan: HorizonPlan): ProjectionResult {
  const openingCapital = Math.max(
    0,
    (plan.existingInvestmentsToProject || 0) + (plan.cashAvailableToInvest || 0)
  );
  const baseMonthly = Math.max(0, plan.monthlyInvestment || 0);
  const stepUpPercent = Math.max(0, plan.annualStepUpPercent || 0) / 100;
  const years = Math.max(1, Math.min(40, plan.assumptions.timeHorizonYears || 10));

  const effectiveAnnualReturn = Math.max(
    -0.9,
    plan.assumptions.assumedAnnualReturnRate ?? 0.12
  );
  const assumedAnnualInflation = Math.max(
    0,
    plan.assumptions.assumedAnnualInflationRate ?? 0
  );

  // Effective monthly rate: (1 + r)^(1/12) - 1
  const monthlyRate =
    effectiveAnnualReturn === 0
      ? 0
      : Math.pow(1 + effectiveAnnualReturn, 1 / 12) - 1;

  let currentPortfolio = openingCapital;
  let totalContributed = openingCapital;
  let totalMonthlyDeposits = 0;
  let currentMonthly = baseMonthly;

  const timeline: YearProjectionPoint[] = [];

  // Year 0: Opening position
  timeline.push({
    year: 0,
    monthlyContributionThisYear: currentMonthly,
    totalMonthlyDeposits: 0,
    totalContributions: totalContributed,
    investmentGrowth: 0,
    nominalPortfolioValue: currentPortfolio,
    realPurchasingPower: currentPortfolio,
  });

  for (let year = 1; year <= years; year++) {
    // In Year `year`, the monthly contribution is `currentMonthly`
    // First annual increase occurs in month 13 (start of Year 2)
    for (let month = 1; month <= 12; month++) {
      // Contribution at start of month
      currentPortfolio += currentMonthly;
      totalContributed += currentMonthly;
      totalMonthlyDeposits += currentMonthly;

      // Compound growth over the month
      if (monthlyRate !== 0) {
        currentPortfolio *= 1 + monthlyRate;
      }
    }

    // Purchasing power adjusted for assumed inflation: PV = FV / (1 + i)^year
    const inflationDiscountFactor =
      assumedAnnualInflation > 0
        ? Math.pow(1 + assumedAnnualInflation, year)
        : 1;

    const roundedNominal = Math.round(currentPortfolio);
    const realPurchasingPower = Math.round(currentPortfolio / inflationDiscountFactor);
    const growth = Math.max(0, roundedNominal - totalContributed);

    timeline.push({
      year,
      monthlyContributionThisYear: currentMonthly,
      totalMonthlyDeposits,
      totalContributions: totalContributed,
      investmentGrowth: growth,
      nominalPortfolioValue: roundedNominal,
      realPurchasingPower,
    });

    // Step-up contribution for the next 12-month period (e.g. Month 13, Month 25...)
    currentMonthly = Math.round(currentMonthly * (1 + stepUpPercent));
  }

  const finalPoint = timeline[timeline.length - 1];

  return {
    timeline,
    openingCapital,
    totalMonthlyDeposits: finalPoint.totalMonthlyDeposits,
    totalInvested: finalPoint.totalContributions,
    totalGrowth: finalPoint.investmentGrowth,
    finalNominalValue: finalPoint.nominalPortfolioValue,
    finalRealValue: finalPoint.realPurchasingPower,
    effectiveAnnualReturn,
    assumedAnnualInflation,
  };
}
