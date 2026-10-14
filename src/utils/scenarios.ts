/**
 * Downside Scenario Calculation Engine for Horizon
 * 
 * Supports 4 stress scenarios:
 * 1. Sudden market fall (one-time drop applied to equity balance, cash protected)
 * 2. Several years without growth (return rate = 0%, contributions continue)
 * 3. Break from monthly investing (contributions = 0 for duration, compounding continues)
 * 4. Slower investment growth (user-chosen lower annual effective return)
 */

import { HorizonPlan, ProjectionResult, YearProjectionPoint } from '../types/horizon';
import { calculateProjection } from './finance';

export type StressScenarioType = 'market_fall' | 'zero_growth' | 'contribution_pause' | 'slower_growth';

export interface MarketFallParams {
  dropPercent: number; // e.g. 30 for 30%
  targetMonth: number; // 1-indexed month within horizon (e.g. month 1 to totalMonths)
}

export interface ZeroGrowthParams {
  startYear: number; // 1-indexed year
  durationYears: number; // number of years with 0% return
}

export interface ContributionPauseParams {
  startMonth: number; // 1-indexed month
  durationMonths: number; // number of months pause
}

export interface SlowerGrowthParams {
  annualReturnRate: number; // e.g. 0.05 for 5% p.a.
}

export interface ScenarioOptions {
  type: StressScenarioType;
  marketFall?: MarketFallParams;
  zeroGrowth?: ZeroGrowthParams;
  contributionPause?: ContributionPauseParams;
  slowerGrowth?: SlowerGrowthParams;
}

export interface ScenarioComparisonResult {
  originalProjection: ProjectionResult;
  scenarioProjection: ProjectionResult;
  scenarioType: StressScenarioType;
  originalEndingValue: number;
  scenarioEndingValue: number;
  nominalDifference: number;
  originalTotalContributions: number;
  scenarioTotalContributions: number;
  contributionDifference: number;
  factualTakeaway: string;
  recoveryInfo?: {
    recovered: boolean;
    recoveryMonth?: number;
    recoveryYear?: number;
    peakValue: number;
    troughValue: number;
    drawdownPct: number;
  };
}

/**
 * Calculates a scenario projection alongside the baseline original projection.
 */
export function calculateScenarioProjection(
  plan: HorizonPlan,
  options: ScenarioOptions
): ScenarioComparisonResult {
  const originalProjection = calculateProjection(plan);
  const totalYears = Math.max(1, Math.min(40, plan.assumptions.timeHorizonYears || 10));
  const totalMonths = totalYears * 12;

  const openingCapital = Math.max(
    0,
    (plan.existingInvestmentsToProject || 0) + (plan.cashAvailableToInvest || 0)
  );
  const baseMonthly = Math.max(0, plan.monthlyInvestment || 0);
  const stepUpPercent = Math.max(0, plan.annualStepUpPercent || 0) / 100;

  const effectiveAnnualReturn = Math.max(
    -0.99,
    plan.assumptions.assumedAnnualReturnRate ?? 0.12
  );
  const assumedAnnualInflation = Math.max(
    0,
    plan.assumptions.assumedAnnualInflationRate ?? 0
  );

  // Asset split: equity vs cash
  const equityOpening = Math.max(0, plan.existingInvestmentsToProject || 0);
  const cashOpening = Math.max(0, plan.cashAvailableToInvest || 0);

  let currentEquity = equityOpening;
  let currentCash = cashOpening;
  let totalContributed = openingCapital;
  let totalMonthlyDeposits = 0;
  let currentMonthly = baseMonthly;

  const timeline: YearProjectionPoint[] = [];

  // Track unitized performance series for recovery analysis (excludes external contributions)
  let unitValue = 100;
  let peakUnitValue = 100;
  let troughUnitValue = 100;
  let hasDropped = false;
  let recoveredAfterDrop = true;
  let recoveryMonthIndex: number | null = null;

  // Year 0
  timeline.push({
    year: 0,
    monthlyContributionThisYear: currentMonthly,
    totalMonthlyDeposits: 0,
    totalContributions: totalContributed,
    investmentGrowth: 0,
    nominalPortfolioValue: openingCapital,
    realPurchasingPower: openingCapital,
  });

  let globalMonth = 0;

  for (let year = 1; year <= totalYears; year++) {
    for (let monthInYear = 1; monthInYear <= 12; monthInYear++) {
      globalMonth++;

      // 1. Determine monthly contribution for this month
      let monthlyContribution = currentMonthly;

      // Check contribution pause scenario
      if (options.type === 'contribution_pause' && options.contributionPause) {
        const pStart = options.contributionPause.startMonth;
        const pEnd = pStart + options.contributionPause.durationMonths - 1;
        if (globalMonth >= pStart && globalMonth <= pEnd) {
          monthlyContribution = 0;
        }
      }

      // Add monthly contribution to cash or equity (assume cash/surplus injected into portfolio cash/equity)
      currentCash += monthlyContribution;
      totalContributed += monthlyContribution;
      if (monthlyContribution > 0) {
        totalMonthlyDeposits += monthlyContribution;
      }

      // 2. Check sudden market fall at target month
      if (
        options.type === 'market_fall' &&
        options.marketFall &&
        globalMonth === options.marketFall.targetMonth
      ) {
        const dropRatio = Math.max(0, Math.min(100, options.marketFall.dropPercent)) / 100;
        const equityBeforeFall = currentEquity;
        const fallAmount = equityBeforeFall * dropRatio;
        currentEquity = Math.max(0, equityBeforeFall - fallAmount);
        // Cash does not suffer stock market fall
        hasDropped = true;
        recoveredAfterDrop = false;
        troughUnitValue = Math.min(troughUnitValue, unitValue * (1 - dropRatio));
      }

      // 3. Determine effective monthly return rate for this month
      let currentAnnualReturn = effectiveAnnualReturn;

      if (options.type === 'slower_growth' && options.slowerGrowth) {
        currentAnnualReturn = Math.max(-0.99, options.slowerGrowth.annualReturnRate);
      } else if (options.type === 'zero_growth' && options.zeroGrowth) {
        const zgStartYear = options.zeroGrowth.startYear;
        const zgEndYear = zgStartYear + options.zeroGrowth.durationYears - 1;
        if (year >= zgStartYear && year <= zgEndYear) {
          currentAnnualReturn = 0;
        }
      }

      const monthlyRate =
        currentAnnualReturn === 0
          ? 0
          : Math.pow(1 + currentAnnualReturn, 1 / 12) - 1;

      // Apply return to equity and cash (assuming cash earns 0 or same rate; here total portfolio compounds at monthlyRate)
      const totalPortfolioBeforeReturn = currentEquity + currentCash;
      const portfolioAfterReturn = totalPortfolioBeforeReturn * (1 + monthlyRate);
      
      // Maintain proportional split or compound equity
      const growthFactor = totalPortfolioBeforeReturn > 0 ? portfolioAfterReturn / totalPortfolioBeforeReturn : 1;
      currentEquity *= growthFactor;
      currentCash *= growthFactor;

      // Update unitized series for recovery tracking (growth factor only, excluding contributions)
      unitValue *= growthFactor;
      if (unitValue > peakUnitValue) {
        peakUnitValue = unitValue;
        if (hasDropped && !recoveredAfterDrop) {
          recoveredAfterDrop = true;
          recoveryMonthIndex = globalMonth;
        }
      }
      if (unitValue < troughUnitValue) {
        troughUnitValue = unitValue;
      }
    }

    // End of year calculations
    const inflationDiscountFactor =
      assumedAnnualInflation > 0
        ? Math.pow(1 + assumedAnnualInflation, year)
        : 1;

    const currentPortfolioTotal = Math.round(currentEquity + currentCash);
    const realPurchasingPower = Math.round(currentPortfolioTotal / inflationDiscountFactor);
    const growth = Math.max(0, currentPortfolioTotal - totalContributed);

    timeline.push({
      year,
      monthlyContributionThisYear: currentMonthly,
      totalMonthlyDeposits,
      totalContributions: totalContributed,
      investmentGrowth: growth,
      nominalPortfolioValue: currentPortfolioTotal,
      realPurchasingPower,
    });

    // Step-up contribution for the next 12-month period (Start of Year 2, Year 3, etc.)
    currentMonthly = Math.round(currentMonthly * (1 + stepUpPercent));
  }

  const finalPoint = timeline[timeline.length - 1];
  const originalFinalPoint = originalProjection.timeline[originalProjection.timeline.length - 1];

  const originalEndingValue = originalFinalPoint.nominalPortfolioValue;
  const scenarioEndingValue = finalPoint.nominalPortfolioValue;
  const nominalDifference = scenarioEndingValue - originalEndingValue;

  const originalTotalContributions = originalProjection.totalInvested;
  const scenarioTotalContributions = totalContributed;
  const contributionDifference = scenarioTotalContributions - originalTotalContributions;

  // Generate factual takeaway
  let factualTakeaway = '';
  if (nominalDifference < 0) {
    factualTakeaway = `In this example, your ending value is ${Math.abs(nominalDifference).toLocaleString('en-US', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })} lower than your original plan.`;
  } else if (nominalDifference > 0) {
    factualTakeaway = `In this example, your ending value is ${nominalDifference.toLocaleString('en-US', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })} higher than your original plan.`;
  } else {
    factualTakeaway = `In this example, your ending value matches your original plan.`;
  }

  let recoveryInfo = undefined;
  if (options.type === 'market_fall') {
    const dropPct = options.marketFall?.dropPercent || 30;
    const trough = peakUnitValue * (1 - dropPct / 100);
    const recovered = recoveredAfterDrop && recoveryMonthIndex !== null;
    recoveryInfo = {
      recovered,
      recoveryMonth: recoveryMonthIndex !== null ? recoveryMonthIndex % 12 || 12 : undefined,
      recoveryYear: recoveryMonthIndex !== null ? Math.ceil(recoveryMonthIndex / 12) : undefined,
      peakValue: peakUnitValue,
      troughValue: trough,
      drawdownPct: dropPct,
    };
  }

  const scenarioProjection: ProjectionResult = {
    timeline,
    openingCapital,
    totalMonthlyDeposits,
    totalInvested: totalContributed,
    totalGrowth: finalPoint.investmentGrowth,
    finalNominalValue: finalPoint.nominalPortfolioValue,
    finalRealValue: finalPoint.realPurchasingPower,
    effectiveAnnualReturn,
    assumedAnnualInflation,
  };

  return {
    originalProjection,
    scenarioProjection,
    scenarioType: options.type,
    originalEndingValue,
    scenarioEndingValue,
    nominalDifference,
    originalTotalContributions,
    scenarioTotalContributions,
    contributionDifference,
    factualTakeaway,
    recoveryInfo,
  };
}
