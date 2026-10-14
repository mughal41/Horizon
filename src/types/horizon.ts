/**
 * Core type definitions for Horizon
 * Strict separation of investable assets, non-invested wealth, and user-confirmed assumptions.
 */

export type InvestmentStatusChoice =
  | 'stocks_detail'
  | 'total_value'
  | 'fresh';

export type HoldingEntryMode = 'shares_and_price' | 'total_value';
export type HoldingPriceProvenance =
  | 'provider_quote'       // Fetched from psxdata-api quote provider
  | 'user_manual'          // User manually entered or edited price
  | 'market_snapshot'      // Historical verified snapshot (Oct 11, 2024)
  | 'unverified_legacy'    // Legacy entry without verified provenance
  | 'missing_price';       // No price entered or available

export type HoldingPriceStatus =
  | 'valid_quote'
  | 'price_needs_updating'
  | 'unverified_saved'
  | 'price_unavailable'
  | 'manual';

export interface StockHolding {
  id: string;
  symbolOrName: string;
  symbol?: string;
  companyName?: string;
  sector?: string;
  instrumentType?: 'equity' | 'reit' | 'etf' | 'mutual_fund' | 'unclassified';
  isVerifiedPsx?: boolean;
  entryMode?: HoldingEntryMode;
  shares?: number;
  pricePerShare?: number;
  averageBuyingPrice?: number; // Optional average amount paid per share
  purchaseDate?: string;       // Optional purchase date
  marketValue: number; // in PKR
  priceProvenance?: HoldingPriceProvenance;
  priceAsOf?: string;
  fetchedAt?: string;
  marketAsOf?: string | null;
  providerTimestamp?: string;
  providerSource?: string;
  priceStatus?: HoldingPriceStatus;
  quoteError?: string;
  notes?: string;
}

export type MonthlyMethodChoice =
  | 'enter_amount'
  | 'help_me_work_it_out';

export interface AffordabilityBudget {
  monthlyIncome: number; // in PKR
  monthlyExpenses: number; // in PKR
  monthlyCashSavingsCommitment: number; // in PKR, ongoing monthly cash saved (e.g. for emergency cushion)
}

export type NonProjectedCategory =
  | 'emergency_cash'
  | 'gold'
  | 'kameti' // Kameti / Committee receivables
  | 'property'
  | 'other';

export interface TrackedWealthItem {
  id: string;
  category: NonProjectedCategory;
  label: string;
  amount: number; // in PKR
  notes?: string;
}

export interface UserAssumptions {
  timeHorizonYears: number; // in years
  assumedAnnualReturnRate: number; // Effective annual rate (e.g. 0.12 = 12%)
  assumedAnnualInflationRate: number; // Assumed annual inflation (e.g. 0.08 = 8%, or 0 for unadjusted)
  shariahPreference: boolean; // Personal investor preference
  goalTitle?: string;
}

export interface HorizonPlan {
  // Opening capital entering projection
  existingInvestmentsToProject: number; // from stocks or entered total
  cashAvailableToInvest: number; // optional lump-sum cash deployed to start

  // Monthly investment commitment
  monthlyInvestment: number; // in PKR
  annualStepUpPercent: number; // percentage increase each 12-month period

  // Assumptions
  assumptions: UserAssumptions;
}

export interface YearProjectionPoint {
  year: number;
  monthlyContributionThisYear: number;
  totalMonthlyDeposits: number; // Cumulative monthly contributions added by this year (excluding opening capital)
  totalContributions: number;   // Cumulative money entering portfolio (opening capital + monthly deposits)
  investmentGrowth: number;     // Cumulative investment growth
  nominalPortfolioValue: number; // Total portfolio value
  realPurchasingPower: number;   // Value in today's purchasing power discounted by inflation
}

export interface ProjectionResult {
  timeline: YearProjectionPoint[];
  openingCapital: number;
  totalMonthlyDeposits: number; // Money added over time through monthly investments
  totalInvested: number;        // Opening capital + total monthly deposits
  totalGrowth: number;          // Investment growth
  finalNominalValue: number;
  finalRealValue: number;
  effectiveAnnualReturn: number;
  assumedAnnualInflation: number;
}

export type ContributionStatus =
  | 'upcoming'
  | 'due'
  | 'partly_added'
  | 'added'
  | 'skipped'
  | 'past_due'
  | 'not_confirmed';

export interface ContributionRecord {
  id: string;
  monthKey: string; // e.g. '2026-10'
  amount: number;   // in PKR
  date: string;     // ISO or YYYY-MM-DD
  note?: string;
  status: ContributionStatus;
}

export interface JourneySchedule {
  isActive: boolean;
  startMonth: string; // e.g. '2026-10'
  contributionDay: number; // e.g. 5
  originalMonthlyAmount: number;
  originalStepUpPercent: number;
  originalHorizonYears: number;
  originalReturnRate: number;
  originalInflationRate: number;
  createdAt: string;
}

export interface CatchUpCommitment {
  strategy: 'next_month' | 'spread_out' | 'none';
  targetMonthKey?: string;
  startMonthKey?: string;
  spreadMonths?: number;
  totalGapAmount?: number;
  extraMonthlyAmount?: number;
  monthlyAllocations?: Record<string, number>; // monthKey -> extra catchup amount
  appliedAt?: string;
}

export interface MonthDecision {
  decision: 'skipped' | 'not_yet';
  decidedAt: string;
}

export interface HorizonState {
  version: number;
  currentStep: number; // 1 to 5
  hasCompletedOnboarding: boolean;
  showLakhFormat: boolean;

  // Step 1: Investments today (null if brand new and not yet selected)
  investmentChoice: InvestmentStatusChoice | null;
  stockHoldings: StockHolding[];
  totalInvestmentsValue: number;
  cashAvailableToInvest: number;
  trackedWealth: TrackedWealthItem[];

  // Step 2: Monthly investment
  monthlyChoice: MonthlyMethodChoice;
  budget: AffordabilityBudget;
  monthlyInvestment: number;
  annualStepUpPercent: number;

  // Step 3: Assumptions
  assumptions: UserAssumptions;

  // Journey & Contribution Ledger
  journeySchedule?: JourneySchedule;
  contributionRecords: ContributionRecord[];
  catchUpCommitment?: CatchUpCommitment;
  monthDecisions?: Record<string, MonthDecision>;
  lastSelectedTab?: 'plan' | 'portfolio' | 'journey';

  lastUpdated: string;
}
