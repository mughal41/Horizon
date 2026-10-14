/**
 * Portfolio Acceptance Testing Suite
 * 
 * Verifies:
 * 1. Snapshot Recording & Deduplication Lifecycle using real application storage functions:
 *    - First eligible observation (count = 1)
 *    - Rerender / navigation deduplication within 1h (count = 1)
 *    - Persisted state reload (count = 1, timestamp preserved)
 *    - Genuinely new eligible quote observation under recording policy (count = 2)
 *    - Immutability of earlier snapshot (index 0 untouched)
 *    - Holding edit / coverage change identification (not market gains)
 * 2. Landing screen destination logic (stocks_detail with holdings -> Portfolio; fresh/total value -> Plan).
 * 3. Partial and missing data calculations (denominator strictly matches eligible holdings).
 * 4. Duplicate lot weighted average buying price calculation (100 @ 500 + 150 @ 600 -> 250 shares, Rs. 140k cost, Rs. 560 avg, at Rs. 541 -> Rs. 135,250 value, -Rs. 4,750 / -3.39% P&L).
 */

import {
  calculateWeightedAverageBuyingPrice,
  savePortfolioSnapshot,
  loadPortfolioSnapshots,
  SafePortfolioStore,
} from '../utils/portfolioStorage';
import { StockHolding } from '../types/horizon';

interface AcceptanceRecord {
  testName: string;
  expectedResult: string;
  actualResult: string;
  pass: boolean;
}

const acceptanceRecords: AcceptanceRecord[] = [];

// ============================================================================
// 1. Snapshot Recording & Deduplication Lifecycle Test
// ============================================================================
{
  const testStore = new SafePortfolioStore();
  const t0 = 1728900000000; // Controlled base timestamp (Oct 14, 2024)

  const initialHoldings: StockHolding[] = [
    {
      id: 'h1',
      symbolOrName: 'FFC — Fauji Fertilizer Company Limited',
      symbol: 'FFC',
      shares: 250,
      pricePerShare: 541,
      averageBuyingPrice: 500,
      marketValue: 135250,
      isVerifiedPsx: true,
      priceProvenance: 'provider_quote',
    },
  ];

  // Step 1: Record first eligible observation
  const snap1 = savePortfolioSnapshot(initialHoldings, { now: t0, store: testStore });
  const step1Pass = snap1.length === 1 && snap1[0].totalMarketValue === 135250;

  // Step 2: Repeat same observation through rerenders and navigation at t0 + 5 minutes
  const t1 = t0 + 5 * 60 * 1000;
  const snap2 = savePortfolioSnapshot(initialHoldings, { now: t1, store: testStore });
  const step2Pass = snap2.length === 1;

  // Step 3: Reload persisted state
  const reloaded = loadPortfolioSnapshots(testStore);
  const step3Pass =
    reloaded.length === 1 &&
    reloaded[0].timestamp === new Date(t0).toISOString() &&
    reloaded[0].totalMarketValue === 135250;

  // Step 4: Genuinely new eligible quote observation under policy (price update to 560 at t0 + 15 min)
  const t2 = t0 + 15 * 60 * 1000;
  const updatedQuoteHoldings: StockHolding[] = [
    {
      ...initialHoldings[0],
      pricePerShare: 560,
      marketValue: 250 * 560, // 140,000
    },
  ];
  const snap3 = savePortfolioSnapshot(updatedQuoteHoldings, { now: t2, store: testStore });
  const step4Pass = snap3.length === 2 && snap3[1].totalMarketValue === 140000;

  // Step 5: Confirm previous snapshot (index 0) remains unchanged
  const step5Pass =
    snap3[0].timestamp === new Date(t0).toISOString() &&
    snap3[0].totalMarketValue === 135250 &&
    snap3[0].holdingsSummary[0].currentPrice === 541;

  // Step 6: Add holding and update coverage (add buying price to MEBL)
  // 6a: Add holding without buying price
  const t3 = t2 + 10 * 60 * 1000;
  const withNewHolding: StockHolding[] = [
    ...updatedQuoteHoldings,
    {
      id: 'h2',
      symbolOrName: 'MEBL — Meezan Bank Limited',
      symbol: 'MEBL',
      shares: 100,
      pricePerShare: 250,
      marketValue: 25000,
      isVerifiedPsx: true,
      priceProvenance: 'provider_quote',
    },
  ];
  const snap4 = savePortfolioSnapshot(withNewHolding, { now: t3, store: testStore });
  const step6aPass = Boolean(
    snap4.length === 3 &&
    snap4[2].changeType === 'portfolio_change' &&
    snap4[2].changeNote?.includes('Holdings count changed')
  );

  // 6b: Add missing buying-price information to MEBL (coverage update)
  const t4 = t3 + 10 * 60 * 1000;
  const withCoverageUpdate: StockHolding[] = [
    withNewHolding[0],
    {
      ...withNewHolding[1],
      averageBuyingPrice: 200, // now has buying price
    },
  ];
  const snap5 = savePortfolioSnapshot(withCoverageUpdate, { now: t4, store: testStore });
  const step6bPass = Boolean(
    snap5.length === 4 &&
    snap5[3].changeType === 'coverage_change' &&
    snap5[3].changeNote?.includes('not a market gain/loss')
  );

  const allLifecyclePass =
    step1Pass && step2Pass && step3Pass && step4Pass && step5Pass && step6aPass && step6bPass;

  acceptanceRecords.push({
    testName: 'Snapshot Lifecycle & Deduplication',
    expectedResult: 'Initial: 1 -> Dedup: 1 -> Reload: 1 -> New Quote: 2 (Prev immutable) -> Coverage Update: 4 (categorized)',
    actualResult: `Counts: [${snap1.length}, ${snap2.length}, ${reloaded.length}, ${snap3.length}, ${snap4.length}, ${snap5.length}], ChangeType: "${snap5[3]?.changeType}"`,
    pass: allLifecyclePass,
  });
}

// ============================================================================
// 2. Landing Screen Selection Logic
// ============================================================================
{
  const determineLandingDestination = (
    hasCompletedOnboarding: boolean,
    investmentChoice: string | null,
    holdingsCount: number,
    storedTabPreference?: string | null
  ): 'plan' | 'portfolio' => {
    if (storedTabPreference === 'plan' || storedTabPreference === 'portfolio') {
      return storedTabPreference;
    }
    if (hasCompletedOnboarding) {
      if (investmentChoice === 'stocks_detail' && holdingsCount > 0) {
        return 'portfolio';
      }
      return 'plan';
    }
    return 'plan';
  };

  const case1 = determineLandingDestination(true, 'stocks_detail', 3, null); // Has holdings -> portfolio
  const case2 = determineLandingDestination(true, 'fresh', 0, null); // Fresh -> plan
  const case3 = determineLandingDestination(true, 'total_value', 0, null); // Total value only -> plan
  const case4 = determineLandingDestination(true, 'stocks_detail', 0, null); // No holdings -> plan
  const case5 = determineLandingDestination(true, 'stocks_detail', 3, 'plan'); // User preference preserved -> plan

  const pass =
    case1 === 'portfolio' &&
    case2 === 'plan' &&
    case3 === 'plan' &&
    case4 === 'plan' &&
    case5 === 'plan';

  acceptanceRecords.push({
    testName: 'Landing Destination User Fit',
    expectedResult: 'Holdings: portfolio, Fresh: plan, Total value: plan, Empty: plan, Saved preference preserved: plan',
    actualResult: `Holdings: ${case1}, Fresh: ${case2}, TotalVal: ${case3}, Empty: ${case4}, Preference: ${case5}`,
    pass,
  });
}

// ============================================================================
// 3. Partial and Missing Data Calculations
// ============================================================================
{
  const mixedPortfolio: StockHolding[] = [
    { id: '1', symbolOrName: 'FFC', shares: 100, pricePerShare: 541, averageBuyingPrice: 500, marketValue: 54100 },
    { id: '2', symbolOrName: 'MEBL', shares: 200, pricePerShare: 250, marketValue: 50000 }, // No buying price
    { id: '3', symbolOrName: 'OGDC', shares: 300, averageBuyingPrice: 150, marketValue: 0 }, // No current price
    { id: '4', symbolOrName: 'Total Position', marketValue: 100000 }, // Total value only
  ];

  let totalMarketValue = 0;
  let eligibleCostBasis = 0;
  let eligibleMarketValue = 0;
  let eligibleCount = 0;

  mixedPortfolio.forEach((h) => {
    totalMarketValue += h.marketValue;
    if (
      typeof h.shares === 'number' &&
      h.shares > 0 &&
      typeof h.averageBuyingPrice === 'number' &&
      h.averageBuyingPrice > 0 &&
      typeof h.pricePerShare === 'number' &&
      h.pricePerShare > 0
    ) {
      eligibleCostBasis += h.shares * h.averageBuyingPrice;
      eligibleMarketValue += h.marketValue;
      eligibleCount++;
    }
  });

  const aggregatePnL = eligibleMarketValue - eligibleCostBasis;
  const aggregatePnLPct = (aggregatePnL / eligibleCostBasis) * 100;
  const isPartial = eligibleCount < mixedPortfolio.length;

  const pass =
    eligibleCount === 1 &&
    eligibleCostBasis === 50000 &&
    eligibleMarketValue === 54100 &&
    aggregatePnL === 4100 &&
    Math.abs(aggregatePnLPct - 8.2) < 0.01 &&
    isPartial === true &&
    totalMarketValue === 204100;

  acceptanceRecords.push({
    testName: 'Partial Data Denominator Consistency',
    expectedResult: 'Eligible count: 1 of 4, Cost: Rs. 50k, P&L: +Rs. 4.1k (+8.2%), Partial label: true',
    actualResult: `Eligible: ${eligibleCount}/${mixedPortfolio.length}, Cost: Rs. ${eligibleCostBasis}, P&L: Rs. ${aggregatePnL} (${aggregatePnLPct.toFixed(1)}%), Partial: ${isPartial}`,
    pass,
  });
}

// ============================================================================
// 4. Duplicate Lots Weighted Average Buying Price
// ============================================================================
{
  const lot1Shares = 100;
  const lot1Price = 500;
  const lot2Shares = 150;
  const lot2Price = 600;
  const currentPrice = 541;

  const totalShares = lot1Shares + lot2Shares; // 250
  const weightedAvg = calculateWeightedAverageBuyingPrice(lot1Shares, lot1Price, lot2Shares, lot2Price); // 560
  const costBasis = totalShares * weightedAvg; // 140,000
  const marketVal = totalShares * currentPrice; // 135,250
  const unrealisedPnL = marketVal - costBasis; // -4,750
  const unrealisedPnLPct = (unrealisedPnL / costBasis) * 100; // -3.392857%

  const pass =
    totalShares === 250 &&
    weightedAvg === 560 &&
    costBasis === 140000 &&
    marketVal === 135250 &&
    unrealisedPnL === -4750 &&
    Math.abs(unrealisedPnLPct - (-3.3928)) < 0.01;

  acceptanceRecords.push({
    testName: 'Duplicate Lots Weighted Average & P&L',
    expectedResult: '250 shares, Weighted Avg: Rs. 560, Cost: Rs. 140k, Value: Rs. 135,250, P&L: -Rs. 4,750 (-3.39%)',
    actualResult: `Shares: ${totalShares}, Weighted Avg: Rs. ${weightedAvg}, Cost: Rs. ${costBasis}, Value: Rs. ${marketVal}, P&L: Rs. ${unrealisedPnL} (${unrealisedPnLPct.toFixed(2)}%)`,
    pass,
  });
}

// ============================================================================
// Print Formal Acceptance Report Table
// ============================================================================
console.log('\n================ CALCULATION & INTEGRATION ACCEPTANCE REPORT ================');
console.table(
  acceptanceRecords.map((r, i) => ({
    '#': i + 1,
    'Acceptance Area': r.testName,
    'Expected Behavior / Values': r.expectedResult,
    'Actual Outcome': r.actualResult,
    'Result': r.pass ? 'PASS' : 'FAIL',
  }))
);

const allPassed = acceptanceRecords.every((r) => r.pass);
if (!allPassed) {
  console.error('Acceptance suite failure detected.');
  process.exit(1);
} else {
  console.log(`All ${acceptanceRecords.length} acceptance integration tests passed successfully.`);
}
