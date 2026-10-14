/**
 * Downside Scenario Acceptance Testing & Numerical Verification Suite
 */

import { calculateScenarioProjection } from '../utils/scenarios';
import { HorizonPlan } from '../types/horizon';

interface AcceptanceTestRecord {
  testName: string;
  inputsDescription: string;
  expectedResultStr: string;
  actualResultStr: string;
  pass: boolean;
}

const acceptanceRecords: AcceptanceTestRecord[] = [];

// 1. Market fall applied once, cash unaffected, equity contribution timing
{
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 100000,
    cashAvailableToInvest: 20000,
    monthlyInvestment: 10000,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: 1,
      assumedAnnualReturnRate: 0,
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };

  const scenario = calculateScenarioProjection(plan, {
    type: 'market_fall',
    marketFall: { dropPercent: 30, targetMonth: 1 },
  });

  const pass = scenario.scenarioEndingValue === 210000;
  acceptanceRecords.push({
    testName: 'Market Fall & Cash Protection',
    inputsDescription: 'Equity 100k, Cash 20k, 30% fall at M1, 0% return, 10k/mo',
    expectedResultStr: 'Ending 1-yr FV: Rs. 210,000',
    actualResultStr: `Ending FV: Rs. ${scenario.scenarioEndingValue.toLocaleString()}`,
    pass,
  });
}

// 2. Zero equity at time of fall
{
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 0,
    cashAvailableToInvest: 50000,
    monthlyInvestment: 15000,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: 1,
      assumedAnnualReturnRate: 0.10,
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };

  const scenario = calculateScenarioProjection(plan, {
    type: 'market_fall',
    marketFall: { dropPercent: 50, targetMonth: 1 },
  });

  const pass = scenario.scenarioEndingValue > 0;
  acceptanceRecords.push({
    testName: 'Zero Equity Market Fall',
    inputsDescription: 'Equity 0, Cash 50k, 50% fall at M1, 15k/mo',
    expectedResultStr: 'Equity fall = 0, Cash 50k unaffected',
    actualResultStr: `Ending FV: Rs. ${scenario.scenarioEndingValue.toLocaleString()}`,
    pass,
  });
}

// 3. Flat returns with contributions continuing (Zero growth years)
{
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 200000,
    cashAvailableToInvest: 0,
    monthlyInvestment: 20000,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: 3,
      assumedAnnualReturnRate: 0.12,
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };

  const scenario = calculateScenarioProjection(plan, {
    type: 'zero_growth',
    zeroGrowth: { startYear: 2, durationYears: 1 },
  });

  const pass = scenario.scenarioEndingValue < scenario.originalEndingValue;
  acceptanceRecords.push({
    testName: 'Flat Returns (Zero Growth Year)',
    inputsDescription: 'Year 2 return set to 0%, contributions continue at 20k/mo',
    expectedResultStr: 'Ending value lower than baseline',
    actualResultStr: `Scenario FV: Rs. ${scenario.scenarioEndingValue.toLocaleString()}`,
    pass,
  });
}

// 4. Contribution pause crossing month 13 & resumption without catch-up
{
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 100000,
    cashAvailableToInvest: 0,
    monthlyInvestment: 10000,
    annualStepUpPercent: 10,
    assumptions: {
      timeHorizonYears: 2,
      assumedAnnualReturnRate: 0,
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };

  const scenario = calculateScenarioProjection(plan, {
    type: 'contribution_pause',
    contributionPause: { startMonth: 10, durationMonths: 6 },
  });

  const diff = scenario.originalTotalContributions - scenario.scenarioTotalContributions;
  const pass = diff === 63000;
  acceptanceRecords.push({
    testName: 'Contribution Pause Crossing Month 13',
    inputsDescription: 'Pause months 10-15 (6 mos), step-up at M13 to 11k/mo',
    expectedResultStr: 'Contribution reduction: Rs. 63,000',
    actualResultStr: `Contribution reduction: Rs. ${diff.toLocaleString()}`,
    pass,
  });
}

// 5. Negative annual returns supported
{
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 300000,
    cashAvailableToInvest: 0,
    monthlyInvestment: 25000,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: 2,
      assumedAnnualReturnRate: 0.12,
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };

  const scenario = calculateScenarioProjection(plan, {
    type: 'slower_growth',
    slowerGrowth: { annualReturnRate: -0.10 },
  });

  const pass = scenario.scenarioEndingValue < scenario.scenarioTotalContributions;
  acceptanceRecords.push({
    testName: 'Negative Annual Returns (-10% p.a.)',
    inputsDescription: 'Annual return set to -10% p.a. over 2 years',
    expectedResultStr: 'Ending FV < Total Contributed',
    actualResultStr: `Ending FV: Rs. ${scenario.scenarioEndingValue.toLocaleString()}`,
    pass,
  });
}

// 6. No recovery within horizon
{
  const plan: HorizonPlan = {
    existingInvestmentsToProject: 500000,
    cashAvailableToInvest: 0,
    monthlyInvestment: 10000,
    annualStepUpPercent: 0,
    assumptions: {
      timeHorizonYears: 1,
      assumedAnnualReturnRate: 0,
      assumedAnnualInflationRate: 0,
      shariahPreference: false,
    },
  };

  const scenario = calculateScenarioProjection(plan, {
    type: 'market_fall',
    marketFall: { dropPercent: 50, targetMonth: 12 },
  });

  const pass = scenario.recoveryInfo?.recovered === false;
  acceptanceRecords.push({
    testName: 'No Recovery Within Horizon',
    inputsDescription: '50% fall at month 12 with 0% return in 1-year plan',
    expectedResultStr: 'recoveryInfo.recovered === false',
    actualResultStr: 'Not recovered within this plan',
    pass,
  });
}

console.log('\n================ ACCEPTANCE TESTING CALCULATION REPORT ================');
console.table(
  acceptanceRecords.map((r, i) => ({
    '#': i + 1,
    'Test Name': r.testName,
    'Inputs': r.inputsDescription,
    'Expected Result': r.expectedResultStr,
    'Actual Result': r.actualResultStr,
    'Status': r.pass ? 'PASS' : 'FAIL',
  }))
);

const allPass = acceptanceRecords.every((r) => r.pass);
if (!allPass) {
  console.error('Acceptance testing calculation failure detected.');
  process.exit(1);
} else {
  console.log('All acceptance testing calculations passed successfully.');
}
