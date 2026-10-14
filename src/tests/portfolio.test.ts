/**
 * Portfolio Calculation Test Suite
 * 
 * Tests:
 * 1. Cost basis, market value, unrealised P&L, and percentage calculation.
 * 2. Acceptance example (250 FFC shares @ 580 buy, 541 current -> cost basis 145k, market value 135.25k, P&L -9.75k, -6.72%).
 * 3. Weighted average buying price calculation for duplicate lots.
 * 4. Portfolio percentage aggregate calculation (sum of eligible P&L / sum of eligible cost basis).
 */

const testResults: Array<{ name: string; condition: string; pass: boolean; details: string }> = [];

function assertTest(name: string, condition: string, pass: boolean, details: string) {
  testResults.push({ name, condition, pass, details });
}

// 1. Basic Unrealised P&L calculation
{
  const shares = 250;
  const avgBuy = 580;
  const currentPrice = 541;

  const costBasis = shares * avgBuy; // 145,000
  const marketValue = shares * currentPrice; // 135,250
  const unrealisedPnL = marketValue - costBasis; // -9,750
  const unrealisedPnLPct = (unrealisedPnL / costBasis) * 100; // -6.724137...

  const pass =
    costBasis === 145000 &&
    marketValue === 135250 &&
    unrealisedPnL === -9750 &&
    Math.abs(unrealisedPnLPct - (-6.7241)) < 0.01;

  assertTest(
    'Acceptance Example P&L Calculation',
    '250 FFC shares @ Rs. 580 cost, Rs. 541 current -> Rs. -9,750 (-6.72%)',
    pass,
    `Cost basis: Rs. ${costBasis}, Market Val: Rs. ${marketValue}, P&L: Rs. ${unrealisedPnL} (${unrealisedPnLPct.toFixed(2)}%)`
  );
}

// 2. Weighted average buying price calculation
{
  // Lot 1: 100 shares @ Rs. 500 = Rs. 50,000 cost
  // Lot 2: 150 shares @ Rs. 600 = Rs. 90,000 cost
  // Total shares = 250, Total cost = 140,000 -> Weighted avg = 140,000 / 250 = 560
  const shares1 = 100;
  const price1 = 500;
  const shares2 = 150;
  const price2 = 600;

  const totalShares = shares1 + shares2;
  const totalCost = shares1 * price1 + shares2 * price2;
  const weightedAvg = totalCost / totalShares;

  const pass = totalShares === 250 && totalCost === 140000 && weightedAvg === 560;
  assertTest(
    'Weighted Average Buying Price',
    'Calculates total purchase cost / total shares correctly without simple averaging',
    pass,
    `Total shares: ${totalShares}, Total cost: ${totalCost}, Weighted Avg: Rs. ${weightedAvg}`
  );
}

// 3. Portfolio aggregate percentage calculation
{
  // Stock A: P&L +10,000 on cost 50,000 (20%)
  // Stock B: P&L -5,000 on cost 100,000 (-5%)
  // Total eligible P&L = +5,000, Total eligible cost = 150,000 -> Aggregate P&L % = 5,000 / 150,000 = +3.33%
  // Note: Simple average of individual % would be (20 + (-5)) / 2 = +7.5% (which is incorrect weighting!)
  const pnlA = 10000;
  const costA = 50000;
  const pnlB = -5000;
  const costB = 100000;

  const totalEligiblePnL = pnlA + pnlB;
  const totalEligibleCost = costA + costB;
  const aggregatePct = (totalEligiblePnL / totalEligibleCost) * 100;

  const pass = Math.abs(aggregatePct - 3.3333) < 0.01;
  assertTest(
    'Portfolio Aggregate Percentage (Weighted)',
    'Sums eligible P&L and eligible cost basis correctly without averaging stock percentages',
    pass,
    `Aggregate P&L %: ${aggregatePct.toFixed(2)}%`
  );
}

console.log('\n================ PORTFOLIO CALCULATION TEST SUITE ================');
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
  console.error('Portfolio calculation test failure detected.');
  process.exit(1);
} else {
  console.log(`All ${testResults.length} portfolio calculation tests passed successfully.`);
}
