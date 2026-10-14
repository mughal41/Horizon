/**
 * Versioned local storage management with graceful fallbacks and migration.
 * Preserves user plans across sessions without requiring an account or server.
 */

import { HorizonState } from '../types/horizon';
import { migrateLegacyHoldings } from './psxService';

export const STORAGE_KEY = 'horizon_investing_state_v2';
const LEGACY_STORAGE_KEY = 'horizon_investing_state_v1';
const CURRENT_VERSION = 2;

let lastSaveSuccess: boolean | null = null;

export function getLastSaveStatus(): 'saved' | 'failed' | 'idle' {
  if (lastSaveSuccess === null) return 'idle';
  return lastSaveSuccess ? 'saved' : 'failed';
}

export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__horizon_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_INITIAL_STATE: HorizonState = {
  version: CURRENT_VERSION,
  currentStep: 1,
  hasCompletedOnboarding: false,
  showLakhFormat: false,

  // Step 1: Investments today (null for brand-new users)
  investmentChoice: null,
  stockHoldings: [],
  totalInvestmentsValue: 0,
  cashAvailableToInvest: 0,
  trackedWealth: [],

  // Step 2: Monthly investment
  monthlyChoice: 'enter_amount',
  budget: {
    monthlyIncome: 0,
    monthlyExpenses: 0,
    monthlyCashSavingsCommitment: 0,
  },
  monthlyInvestment: 25000,
  annualStepUpPercent: 0,

  // Step 3: Assumptions (user-reviewed)
  assumptions: {
    timeHorizonYears: 10,
    assumedAnnualReturnRate: 0.12, // 12% illustrative annual return assumption
    assumedAnnualInflationRate: 0.10, // 10% illustrative inflation assumption
    shariahPreference: false,
    goalTitle: 'Wealth Building',
  },

  // Journey & Contribution Ledger
  journeySchedule: undefined,
  contributionRecords: [],
  catchUpCommitment: undefined,
  monthDecisions: {},
  lastSelectedTab: 'plan',

  lastUpdated: new Date().toISOString(),
};

/**
 * Load state safely from localStorage with migration from v1
 */
export function loadSavedState(): HorizonState {
  if (typeof window === 'undefined') {
    return DEFAULT_INITIAL_STATE;
  }

  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    let isV1 = false;

    if (!raw) {
      // Check legacy v1 key
      raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) isV1 = true;
    }

    if (!raw) {
      return DEFAULT_INITIAL_STATE;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_INITIAL_STATE;
    }

    // Migrate from v1 if applicable
    if (isV1 || parsed.version === 1) {
      const legacyMonthly = parsed.plan?.monthlyInvestment ?? 25000;
      const legacyStepUp = parsed.plan?.annualStepUpPercent ?? 10;
      const legacyYears = parsed.plan?.timeHorizonYears ?? 10;
      const legacyIncome = parsed.situation?.monthlyIncome ?? 0;
      const legacyExpenses = parsed.situation?.monthlyExpenses ?? 0;
      const legacyCash = parsed.situation?.cashKeptAside ?? 0;

      return {
        ...DEFAULT_INITIAL_STATE,
        version: CURRENT_VERSION,
        currentStep: typeof parsed.currentStep === 'number' ? Math.min(parsed.currentStep, 5) : 1,
        hasCompletedOnboarding: Boolean(parsed.hasCompletedOnboarding),
        showLakhFormat: Boolean(parsed.showLakhFormat),
        monthlyInvestment: legacyMonthly,
        annualStepUpPercent: legacyStepUp,
        budget: {
          monthlyIncome: legacyIncome,
          monthlyExpenses: legacyExpenses,
          monthlyCashSavingsCommitment: 0,
        },
        trackedWealth: legacyCash > 0 ? [
          {
            id: 'legacy-emergency-cash',
            category: 'emergency_cash',
            label: 'Emergency cash kept aside',
            amount: legacyCash,
          }
        ] : [],
        assumptions: {
          timeHorizonYears: legacyYears,
          assumedAnnualReturnRate: parsed.plan?.customReturnRate ?? 0.12,
          assumedAnnualInflationRate: parsed.plan?.customInflationRate ?? 0.10,
          shariahPreference: Boolean(parsed.plan?.shariahPreference),
          goalTitle: 'Wealth Building',
        },
        contributionRecords: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // Regular v2 state
    return {
      version: CURRENT_VERSION,
      currentStep: typeof parsed.currentStep === 'number' ? parsed.currentStep : 1,
      hasCompletedOnboarding: Boolean(parsed.hasCompletedOnboarding),
      showLakhFormat: Boolean(parsed.showLakhFormat),
      investmentChoice: parsed.investmentChoice !== undefined ? parsed.investmentChoice : null,
      stockHoldings: Array.isArray(parsed.stockHoldings) ? migrateLegacyHoldings(parsed.stockHoldings) : [],
      totalInvestmentsValue: parsed.totalInvestmentsValue || 0,
      cashAvailableToInvest: parsed.cashAvailableToInvest || 0,
      trackedWealth: Array.isArray(parsed.trackedWealth) ? parsed.trackedWealth : [],
      monthlyChoice: parsed.monthlyChoice || 'enter_amount',
      budget: {
        monthlyIncome: parsed.budget?.monthlyIncome || 0,
        monthlyExpenses: parsed.budget?.monthlyExpenses || 0,
        monthlyCashSavingsCommitment: parsed.budget?.monthlyCashSavingsCommitment || 0,
      },
      monthlyInvestment: typeof parsed.monthlyInvestment === 'number' ? parsed.monthlyInvestment : 25000,
      annualStepUpPercent: typeof parsed.annualStepUpPercent === 'number' ? parsed.annualStepUpPercent : 0,
      assumptions: {
        timeHorizonYears: parsed.assumptions?.timeHorizonYears || 10,
        assumedAnnualReturnRate: typeof parsed.assumptions?.assumedAnnualReturnRate === 'number' ? parsed.assumptions.assumedAnnualReturnRate : 0.12,
        assumedAnnualInflationRate: typeof parsed.assumptions?.assumedAnnualInflationRate === 'number' ? parsed.assumptions.assumedAnnualInflationRate : 0.10,
        shariahPreference: Boolean(parsed.assumptions?.shariahPreference),
        goalTitle: parsed.assumptions?.goalTitle || 'Wealth Building',
      },
      journeySchedule: parsed.journeySchedule || undefined,
      contributionRecords: Array.isArray(parsed.contributionRecords) ? parsed.contributionRecords : [],
      catchUpCommitment: parsed.catchUpCommitment || undefined,
      monthDecisions: parsed.monthDecisions && typeof parsed.monthDecisions === 'object' ? parsed.monthDecisions : {},
      lastSelectedTab: parsed.lastSelectedTab || undefined,
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    };
  } catch (err) {
    console.warn('Unable to load Horizon state from local storage:', err);
    return DEFAULT_INITIAL_STATE;
  }
}

// Compare JSON data independently of object-key order after loading/migration.
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
    }
    return item;
  });
}

/**
 * Save state safely to localStorage
 */
export function saveState(state: HorizonState): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const previousRaw = window.localStorage.getItem(STORAGE_KEY);
    let previous: HorizonState | undefined;
    try { previous = previousRaw ? JSON.parse(previousRaw) : undefined; } catch { /* Replace corrupt saved JSON. */ }
    const { lastUpdated: ignoredPrevious, ...previousData } = previous ?? {};
    const { lastUpdated: ignoredCurrent, ...currentData } = state;
    const unchanged = stableJson(previousData) === stableJson(currentData);
    const payload = {
      ...state,
      version: CURRENT_VERSION,
      lastUpdated: unchanged && previous ? previous.lastUpdated : new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    lastSaveSuccess = true;
    return true;
  } catch (err) {
    console.warn('Unable to save Horizon state to local storage:', err);
    lastSaveSuccess = false;
    return false;
  }
}

/**
 * Reset state to fresh beginning
 */
export function clearSavedState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (err) {
    console.warn('Unable to clear local storage:', err);
  }
}
