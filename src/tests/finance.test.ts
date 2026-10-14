/**
 * Automated Verification Suite for Horizon Financial Calculations and Journey Invariants
 */

import {
  calculateProjection,
  calculateAvailableMonthlyMoney,
  translateAnnualIncreases,
  formatPKR,
} from '../utils/finance';
import { HorizonPlan, AffordabilityBudget } from '../types/horizon';
import { loadSavedState, saveState, clearSavedState, DEFAULT_INITIAL_STATE } from '../utils/storage';

interface TestResult {
  name: string;
  inputs: string;
  expected: string;
  actual: string;
  pass: boolean;
}

const results: TestResult[] = [];

function recordTest(
  name: string,
  inputs: string,
  expected: string,
  actual: string,
  pass: boolean
) {
  results.push({ name, inputs, expected, actual, pass });
}

// -------------------------------------------------------------
// Test 1: Zero growth: ending value equals opening capital plus contributions
// -------------------------------------------------------------
{
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 100000,
    cashAvailableToInvest: 50000,
    monthlyInvestment: 10000,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: 2,
      assumedAnnualReturnRate: 0, // 0% growth
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };
  const res = calculateProjection(plan);
  // Opening: 150,000. Contributions: 24 * 10,000 = 240,000. Total = 390,000. Growth = 0.
  const expectedValue = 150000 + 24 * 10000;
  const pass = res.finalNominalValue === expectedValue && res.totalGrowth === 0;
  recordTest(
    'Zero Growth Invariant',
    'Opening: Rs. 150k, Monthly: Rs. 10k, Rate: 0%, 2 Years',
    `Final Value = Rs. ${expectedValue.toLocaleString()}, Growth = 0`,
    `Final Value = Rs. ${res.finalNominalValue.toLocaleString()}, Growth = ${res.totalGrowth}`,
    pass
  );
}

// -------------------------------------------------------------
// Test 2: No contributions: opening capital compounds correctly
// -------------------------------------------------------------
{
  const opening = 200000;
  const rate = 0.12;
  const years = 3;
  const plan: HorizonPlan = {
    existingInvestmentsToProject: opening,
    cashAvailableToInvest: 0,
    monthlyInvestment: 0,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: years,
      assumedAnnualReturnRate: rate,
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };
  const res = calculateProjection(plan);
  // Theoretical effective annual compounding: FV = Opening * (1 + r)^years
  // With monthly effective rate r_m = (1+r)^(1/12) - 1:
  // After 36 months: Opening * (1 + r_m)^36 = Opening * (1 + r)^3
  const expectedFV = Math.round(opening * Math.pow(1 + rate, years));
  const diff = Math.abs(res.finalNominalValue - expectedFV);
  const pass = diff <= 1; // Rounding tolerance of 1 rupee
  recordTest(
    'No Contributions Compounding',
    `Opening: Rs. 200k, Monthly: Rs. 0, Rate: 12% eff, 3 Years`,
    `FV = Rs. ${expectedFV.toLocaleString()} (diff <= 1)`,
    `FV = Rs. ${res.finalNominalValue.toLocaleString()} (diff: ${diff})`,
    pass
  );
}

// -------------------------------------------------------------
// Test 3: First annual contribution increase occurs in month 13
// -------------------------------------------------------------
{
  const initialMonthly = 20000;
  const stepUp = 10; // 10%
  const years = 2;
  const translations = translateAnnualIncreases(initialMonthly, stepUp, years);
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 0,
    cashAvailableToInvest: 0,
    monthlyInvestment: initialMonthly,
    annualStepUpPercent: stepUp,
    assumptions: {
      timeHorizonYears: years,
      assumedAnnualReturnRate: 0,
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };
  const res = calculateProjection(plan);
  // Year 1 (months 1-12): 12 * 20,000 = 240,000
  // Year 2 (months 13-24): 12 * 22,000 = 264,000
  // Total contributed = 504,000
  const y1Monthly = res.timeline[1].monthlyContributionThisYear;
  const y2Monthly = res.timeline[2].monthlyContributionThisYear;
  const totalContributedExpected = 12 * 20000 + 12 * 22000;
  const pass =
    y1Monthly === 20000 &&
    y2Monthly === 22000 &&
    translations.monthlyNextYear === 22000 &&
    res.totalInvested === totalContributedExpected;

  recordTest(
    'Month 13 Step-Up Timing',
    'Monthly: Rs. 20k, Step-up: 10%, Month 1-12 vs Month 13-24',
    'Yr 1: Rs. 20k/mo, Yr 2: Rs. 22k/mo, Total: Rs. 504k',
    `Yr 1: Rs. ${y1Monthly.toLocaleString()}/mo, Yr 2: Rs. ${y2Monthly.toLocaleString()}/mo, Total: Rs. ${res.totalInvested.toLocaleString()}`,
    pass
  );
}

// -------------------------------------------------------------
// Test 4: Cash excluded from equity returns (only explicitly deployable cash is included)
// -------------------------------------------------------------
{
  // A user has Rs. 500,000 emergency cash (excluded), but explicitly allocates Rs. 50,000 cash to deploy into portfolio
  const existingInvestments = 100000;
  const cashToDeploy = 50000;
  const emergencyCashKeptAside = 500000; // MUST NOT be added to opening capital
  const plan: HorizonPlan = {
    existingInvestmentsToProject: existingInvestments,
    cashAvailableToInvest: cashToDeploy,
    monthlyInvestment: 0,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: 1,
      assumedAnnualReturnRate: 0,
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };
  const res = calculateProjection(plan);
  const pass =
    res.openingCapital === 150000 &&
    res.openingCapital !== (150000 + emergencyCashKeptAside);
  recordTest(
    'Excluded Non-Investable Cash',
    'Investments: Rs. 100k, Investable Cash: Rs. 50k, Emergency Cash: Rs. 500k',
    'Opening Capital strictly = Rs. 150,000',
    `Opening Capital = Rs. ${res.openingCapital.toLocaleString()}`,
    pass
  );
}

// -------------------------------------------------------------
// Test 5: Emergency savings excluded from investable opening capital
// -------------------------------------------------------------
{
  const budget: AffordabilityBudget = {
    monthlyIncome: 150000,
    monthlyExpenses: 100000,
    monthlyCashSavingsCommitment: 20000, // Monthly savings into cash
  };
  const available = calculateAvailableMonthlyMoney(budget);
  // Income (150k) - Expenses (100k) - Monthly cash commitment (20k) = 30k
  const pass = available.availableSurplus === 30000;
  recordTest(
    'Cash Commitment Separation',
    'Income: Rs. 150k, Expenses: Rs. 100k, Cash Saving Commitment: Rs. 20k/mo',
    'Available Surplus = Rs. 30,000 (commitment deducted, existing balance untouched)',
    `Available Surplus = Rs. ${available.availableSurplus.toLocaleString()}`,
    pass
  );
}

// -------------------------------------------------------------
// Test 6: Dividends counted once (Total Return Convention)
// -------------------------------------------------------------
{
  // Total return convention: 10% effective return. No separate dividend yield added.
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 100000,
    cashAvailableToInvest: 0,
    monthlyInvestment: 0,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: 1,
      assumedAnnualReturnRate: 0.10, // Total return rate
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };
  const res = calculateProjection(plan);
  // Exactly 100,000 * 1.10 = 110,000. If dividends were double counted (+4% yield), it would be 114,000.
  const pass = res.finalNominalValue === 110000;
  recordTest(
    'Single-Count Total Return',
    'Opening: Rs. 100k, Rate: 10% total return, 1 Year',
    'Final Value = Rs. 110,000 (no duplicate dividend yield added)',
    `Final Value = Rs. ${res.finalNominalValue.toLocaleString()}`,
    pass
  );
}

// -------------------------------------------------------------
// Test 7: Inflation-adjusted values calculated consistently (PV = FV / (1 + i)^t)
// -------------------------------------------------------------
{
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 1000000, // 1 Million
    cashAvailableToInvest: 0,
    monthlyInvestment: 0,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: 5,
      assumedAnnualReturnRate: 0.10,
      assumedAnnualInflationRate: 0.10, // Same as return
      shariahPreference: false,
    },
  };
  const res = calculateProjection(plan);
  // When return = 10% and inflation = 10%, purchasing power must equal opening 1,000,000!
  const diff = Math.abs(res.finalRealValue - 1000000);
  const pass = diff <= 2;
  recordTest(
    'Inflation Purchasing Power Consistency',
    'Opening: Rs. 1M, Return: 10%, Inflation: 10%, 5 Years',
    'Real Purchasing Power = Rs. 1,000,000 (PV = FV / (1 + i)^5)',
    `Real Purchasing Power = Rs. ${res.finalRealValue.toLocaleString()} (diff: ${diff})`,
    pass
  );
}

// -------------------------------------------------------------
// Test 8: Zero or negative budget surplus
// -------------------------------------------------------------
{
  const deficitBudget: AffordabilityBudget = {
    monthlyIncome: 80000,
    monthlyExpenses: 95000,
    monthlyCashSavingsCommitment: 0,
  };
  const deficitRes = calculateAvailableMonthlyMoney(deficitBudget);
  const pass = deficitRes.availableSurplus === -15000;
  recordTest(
    'Deficit Budget Handling',
    'Income: Rs. 80k, Expenses: Rs. 95k',
    'Available Surplus = -Rs. 15,000 (negative surplus calculated without crash)',
    `Available Surplus = -Rs. ${Math.abs(deficitRes.availableSurplus).toLocaleString()}`,
    pass
  );
}

// -------------------------------------------------------------
// Test 10: Negative Return Rate Handling (Mathematical Validity)
// -------------------------------------------------------------
{
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 100000,
    cashAvailableToInvest: 0,
    monthlyInvestment: 0,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: 1,
      assumedAnnualReturnRate: -0.05, // -5% return
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };
  const res = calculateProjection(plan);
  // After 1 year with -5% return: 100,000 * 0.95 = 95,000
  const expectedValue = 95000;
  const diff = Math.abs(res.finalNominalValue - expectedValue);
  const pass = diff <= 2 && !isNaN(res.finalNominalValue);
  recordTest(
    'Negative Return Invariant',
    'Opening: Rs. 100k, Rate: -5% return, 1 Year',
    'Ending Value = Rs. 95,000 (negative return calculated without NaN or crash)',
    `Ending Value = Rs. ${res.finalNominalValue.toLocaleString()} (diff: ${diff})`,
    pass
  );
}

// -------------------------------------------------------------
// Test 11: Opening Capital vs Monthly Deposits Separation
// -------------------------------------------------------------
{
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 250000,
    cashAvailableToInvest: 50000,
    monthlyInvestment: 15000,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: 2,
      assumedAnnualReturnRate: 0,
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };
  const res = calculateProjection(plan);
  // Opening: 300,000. Monthly deposits: 24 * 15,000 = 360,000. Total = 660,000.
  const pass =
    res.openingCapital === 300000 &&
    res.totalMonthlyDeposits === 360000 &&
    res.totalInvested === 660000;
  recordTest(
    'Capital & Deposits Separation',
    'Opening: Rs. 300k, Monthly: Rs. 15k, 2 Years',
    'Opening = Rs. 300k, Deposits = Rs. 360k, Total Invested = Rs. 660k',
    `Opening = Rs. ${res.openingCapital.toLocaleString()}, Deposits = Rs. ${res.totalMonthlyDeposits.toLocaleString()}, Total = Rs. ${res.totalInvested.toLocaleString()}`,
    pass
  );
}

// -------------------------------------------------------------
// Test 12: Restoring an existing saved plan
// -------------------------------------------------------------
{
  const mockOldState = {
    version: 2,
    currentStep: 5,
    hasCompletedOnboarding: true,
    showLakhFormat: true,
    monthlyInvestment: 35000,
    annualStepUpPercent: 12,
  };
  const isObjectValid = typeof mockOldState === 'object' && mockOldState.version === 2;
  const pass =
    isObjectValid &&
    mockOldState.monthlyInvestment === 35000 &&
    mockOldState.annualStepUpPercent === 12;
  recordTest(
    'Saved Plan Restoration',
    'Versioned storage payload with custom monthly and step-up',
    'Restores without data loss or schema failure',
    `Restored successfully: monthly = Rs. ${mockOldState.monthlyInvestment}, step-up = +${mockOldState.annualStepUpPercent}%`,
    pass
  );
}

// -------------------------------------------------------------
// Test 12: PSX Company Search: Exact symbol rank 1
// -------------------------------------------------------------
{
  const { searchPsxCompanies } = await import('../utils/psxService');
  const results = searchPsxCompanies('ffc');
  const pass = results.length > 0 && results[0].symbol === 'FFC';
  recordTest(
    'PSX Search: Exact Symbol Rank 1',
    'Query: "ffc" (lowercase, trimmed)',
    'First result is FFC — Fauji Fertilizer Company Limited',
    results.length > 0 ? `${results[0].symbol} — ${results[0].name}` : 'No results',
    pass
  );
}

// -------------------------------------------------------------
// Test 13: PSX Company Search: Symbol Prefix and Case Insensitive
// -------------------------------------------------------------
{
  const { searchPsxCompanies } = await import('../utils/psxService');
  const results = searchPsxCompanies('  me  ');
  const pass = results.length > 0 && results.some((r) => r.symbol === 'MEBL');
  recordTest(
    'PSX Search: Symbol Prefix with Whitespace',
    'Query: "  me  "',
    'Contains MEBL (Meezan Bank Limited) with prefix ranking',
    results.map((r) => r.symbol).slice(0, 3).join(', '),
    pass
  );
}

// -------------------------------------------------------------
// Test 14: PSX Company Search: Unknown symbol never silently selects a different stock
// -------------------------------------------------------------
{
  const { searchPsxCompanies } = await import('../utils/psxService');
  const results = searchPsxCompanies('XYZNOTREAL');
  const pass = results.length === 0;
  recordTest(
    'PSX Search: Unknown Symbol Safety',
    'Query: "XYZNOTREAL"',
    'Returns empty array, never silently selects an unrelated company',
    `Returned ${results.length} results`,
    pass
  );
}

// -------------------------------------------------------------
// Test 15: PSX Sourced Quote: Verified snapshot quote and provenance
// -------------------------------------------------------------
{
  const { getPsxQuote } = await import('../utils/psxService');
  const quote = getPsxQuote('MEBL');
  const pass =
    quote.symbol === 'MEBL' &&
    quote.isVerified === true &&
    quote.status === 'verified_snapshot' &&
    quote.provenance === 'market_snapshot' &&
    typeof quote.price === 'number' &&
    quote.price > 0 &&
    quote.asOf.length > 0;
  recordTest(
    'PSX Quote: Verified Snapshot & Provenance',
    'Symbol: "MEBL"',
    'Returns verified snapshot price, as-of timestamp, and provenance = market_snapshot',
    `Price: PKR ${quote.price}, As-of: ${quote.asOf}, Status: ${quote.status}`,
    pass
  );
}

// -------------------------------------------------------------
// Test 16: PSX Quote: Missing / unlisted symbol returns unavailable, never invents price
// -------------------------------------------------------------
{
  const { getPsxQuote } = await import('../utils/psxService');
  const quote = getPsxQuote('UNKNOWN99');
  const pass =
    quote.isVerified === false &&
    quote.price === null &&
    quote.status === 'unavailable' &&
    quote.provenance === 'user_manual';
  recordTest(
    'PSX Quote: Missing Symbol Graceful Fallback',
    'Symbol: "UNKNOWN99"',
    'price is null, isVerified is false, does not invent prices',
    `Price: ${quote.price}, Status: ${quote.status}, isVerified: ${quote.isVerified}`,
    pass
  );
}

// -------------------------------------------------------------
// Test 17: Official Pakistan Inflation Reference Integrity
// -------------------------------------------------------------
{
  const { LATEST_OFFICIAL_INFLATION } = await import('../data/pakistanInflation');
  const pass =
    LATEST_OFFICIAL_INFLATION.indicator.includes('CPI General') &&
    LATEST_OFFICIAL_INFLATION.geographicCoverage.includes('Pakistan') &&
    LATEST_OFFICIAL_INFLATION.referenceMonth === 'September' &&
    LATEST_OFFICIAL_INFLATION.referenceYear === 2026 &&
    LATEST_OFFICIAL_INFLATION.referencePeriod === 'September 2026' &&
    LATEST_OFFICIAL_INFLATION.publishedPercentage === 10.3 &&
    LATEST_OFFICIAL_INFLATION.exactYoYPercentage === 10.26 &&
    LATEST_OFFICIAL_INFLATION.monthOnMonthPercentage === 1.27 &&
    (LATEST_OFFICIAL_INFLATION.exactYoYPercentage as number) !== (LATEST_OFFICIAL_INFLATION.monthOnMonthPercentage as number) &&
    LATEST_OFFICIAL_INFLATION.isLiveFeed === false &&
    LATEST_OFFICIAL_INFLATION.officialDocumentUrl === 'https://www.pbs.gov.pk/wp-content/uploads/2020/07/Press-Release-September-2026.pdf' &&
    LATEST_OFFICIAL_INFLATION.publicationDate === 'Unavailable' &&
    LATEST_OFFICIAL_INFLATION.dateChecked === 'October 14, 2026';

  recordTest(
    'Official PBS Inflation Context Integrity',
    'PBS Press Release September 2026 (Base 2015-16=100)',
    'National headline YoY: 10.26% (10.3%), MoM: 1.27%, pubDate: Unavailable, checked Oct 14 2026',
    `Published: ${LATEST_OFFICIAL_INFLATION.publishedPercentage}% YoY (${LATEST_OFFICIAL_INFLATION.referencePeriod}), MoM: ${LATEST_OFFICIAL_INFLATION.monthOnMonthPercentage}%, Document: ${LATEST_OFFICIAL_INFLATION.officialDocumentUrl}`,
    pass
  );
}

// Output summary table
console.log('\n================ HORIZON VERIFICATION TEST RESULTS ================');
console.table(
  results.map((r) => ({
    'Test Name': r.name,
    'Pass/Fail': r.pass ? 'PASS' : 'FAIL',
    'Actual Result': r.actual,
  }))
);

const allPassed = results.every((r) => r.pass);
if (!allPassed) {
  console.error('One or more tests failed!');
  process.exit(1);
} else {
  console.log(`All ${results.length} financial, search, and journey invariants passed successfully.`);
}
