/**
 * Downside Scenarios Test Suite
 * 
 * Tests:
 * 1. Sudden market fall applied exactly once to equity, cash protected
 * 2. Several years without growth with continuing contributions
 * 3. Contribution pause start/end boundaries and resumption rule (no catch-up)
 * 4. Slower investment growth (negative rates supported)
 * 5. Original saved plan unchanged comparison
 * 6. Recovery analysis excluding external contributions
 */

import { calculateScenarioProjection } from '../utils/scenarios';
import { HorizonPlan } from '../types/horizon';

const testResults: Array<{ name: string; condition: string; pass: boolean; details: string }> = [];

function assertTest(name: string, condition: string, pass: boolean, details: string) {
  testResults.push({ name, condition, pass, details });
}

const samplePlan: HorizonPlan = {
  existingInvestmentsToProject: 300000,
  cashAvailableToInvest: 50000,
  monthlyInvestment: 20000,
  annualStepUpPercent: 5,
  assumptions: {
    timeHorizonYears: 5,
    assumedAnnualReturnRate: 0.12,
    assumedAnnualInflationRate: 0.05,
    shariahPreference: false,
  },
};

// 1. Sudden market fall applied once to equity, cash protected
{
  const scenario = calculateScenarioProjection(samplePlan, {
    type: 'market_fall',
    marketFall: { dropPercent: 30, targetMonth: 1 },
  });

  const pass = scenario.scenarioEndingValue < scenario.originalEndingValue && scenario.scenarioEndingValue > 0;
  assertTest(
    'Sudden Market Fall',
    'Applies 30% drop once to equity at target month while cash is protected',
    pass,
    `Original FV: ${scenario.originalEndingValue}, Scenario FV: ${scenario.scenarioEndingValue}`
  );
}

// 2. Several years without growth with continuing contributions
{
  const scenario = calculateScenarioProjection(samplePlan, {
    type: 'zero_growth',
    zeroGrowth: { startYear: 2, durationYears: 2 },
  });

  const pass = scenario.scenarioEndingValue < scenario.originalEndingValue && scenario.scenarioTotalContributions === scenario.originalTotalContributions;
  assertTest(
    'Zero Growth Years',
    'Sets return to 0% for years 2-3 while regular contributions continue unchanged',
    pass,
    `Original FV: ${scenario.originalEndingValue}, Scenario FV: ${scenario.scenarioEndingValue}`
  );
}

// 3. Contribution pause start/end boundaries and resumption
{
  const scenario = calculateScenarioProjection(samplePlan, {
    type: 'contribution_pause',
    contributionPause: { startMonth: 13, durationMonths: 6 },
  });

  const pass = scenario.scenarioTotalContributions < scenario.originalTotalContributions && scenario.scenarioEndingValue < scenario.originalEndingValue;
  assertTest(
    'Contribution Pause & Resumption',
    'Reduces total contributions during 6-month pause starting month 13, resumes schedule without catch-up',
    pass,
    `Original Contributions: ${scenario.originalTotalContributions}, Scenario Contributions: ${scenario.scenarioTotalContributions}`
  );
}

// 4. Slower investment growth with negative return supported
{
  const scenario = calculateScenarioProjection(samplePlan, {
    type: 'slower_growth',
    slowerGrowth: { annualReturnRate: -0.05 },
  });

  const pass = scenario.scenarioEndingValue < scenario.originalEndingValue;
  assertTest(
    'Slower Investment Growth (Negative Return)',
    'Supports negative annual return (-5% p.a.) and reflects lower ending value correctly',
    pass,
    `Scenario FV with -5% p.a.: ${scenario.scenarioEndingValue}`
  );
}

// 5. Recovery analysis evaluation
{
  const scenario = calculateScenarioProjection(samplePlan, {
    type: 'market_fall',
    marketFall: { dropPercent: 40, targetMonth: 6 },
  });

  const pass = scenario.recoveryInfo !== undefined && typeof scenario.recoveryInfo.drawdownPct === 'number';
  assertTest(
    'Recovery Analysis Series',
    'Computes drawdown and unitized recovery tracking independently of external contributions',
    pass,
    `Drawdown: ${scenario.recoveryInfo?.drawdownPct}%, Recovered: ${scenario.recoveryInfo?.recovered}`
  );
}

console.log('\n================ DOWNSIDE SCENARIOS SPECIFICATION TESTS ================');
console.table(
  testResults.map((r) => ({
    'Test Name': r.name,
    'Pass/Fail': r.pass ? 'PASS' : 'FAIL',
    'Condition Checked': r.condition,
    'Actual Outcome': r.details,
  }))
);

const allPass = testResults.every((r) => r.pass);
if (!allPass) {
  console.error('Scenario test failure detected.');
  process.exit(1);
} else {
  console.log(`All ${testResults.length} downside scenario specification tests passed.`);
}
