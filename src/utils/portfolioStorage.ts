/**
 * Versioned Portfolio History & Snapshot Storage
 * 
 * Stores browser-recorded portfolio snapshots separately from session quote cache
 * and saved plans. Enables honest historical tracking ("Tracked since [date]")
 * without background polling or backend dependencies.
 */

import { StockHolding } from '../types/horizon';

export interface PortfolioSnapshot {
  timestamp: string; // ISO string
  totalMarketValue: number;
  totalCostBasis: number;
  eligibleCostBasisForPnL: number;
  eligibleMarketValueForPnL: number;
  totalUnrealisedPnL: number;
  holdingsCount: number;
  holdingsWithCostBasisCount: number;
  valuationComplete: boolean;
  changeType?: 'initial' | 'market_update' | 'coverage_change' | 'portfolio_change';
  changeNote?: string;
  holdingsSummary: Array<{
    symbol: string;
    shares: number;
    currentPrice: number;
    averageBuyingPrice?: number;
    marketValue: number;
    costBasis?: number;
    unrealisedPnL?: number;
  }>;
}

export const PORTFOLIO_SNAPSHOT_KEY = 'horizon_portfolio_snapshots_v1';

/**
 * Storage adapter with automatic in-memory fallback for environments
 * without window.localStorage (such as Node.js test suites).
 */
export class SafePortfolioStore {
  private memoryFallback = new Map<string, string>();

  public getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Storage access blocked or restricted
    }
    return this.memoryFallback.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        this.memoryFallback.set(key, value);
        return;
      }
    } catch {
      // Quota exceeded or restricted
    }
    this.memoryFallback.set(key, value);
  }

  public clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(PORTFOLIO_SNAPSHOT_KEY);
      }
    } catch {
      // Ignore
    }
    this.memoryFallback.clear();
  }
}

export const defaultPortfolioStore = new SafePortfolioStore();

export function loadPortfolioSnapshots(store: SafePortfolioStore = defaultPortfolioStore): PortfolioSnapshot[] {
  try {
    const raw = store.getItem(PORTFOLIO_SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Unable to load portfolio snapshots:', err);
    return [];
  }
}

export interface SnapshotOptions {
  now?: string | number;
  store?: SafePortfolioStore;
}

export function savePortfolioSnapshot(
  holdings: StockHolding[],
  options?: SnapshotOptions
): PortfolioSnapshot[] {
  const store = options?.store ?? defaultPortfolioStore;
  try {
    const snapshots = loadPortfolioSnapshots(store);
    const nowIso = options?.now ? new Date(options.now).toISOString() : new Date().toISOString();

    let totalMarketValue = 0;
    let totalCostBasis = 0;
    let eligibleCostBasisForPnL = 0;
    let eligibleMarketValueForPnL = 0;
    let holdingsWithCostBasisCount = 0;
    let valuationComplete = true;

    const holdingsSummary = holdings.map((h) => {
      const marketVal = h.marketValue || 0;
      totalMarketValue += marketVal;

      const hasPrice = typeof h.pricePerShare === 'number' && h.pricePerShare > 0;
      if (!hasPrice) {
        valuationComplete = false;
      }

      let costBasis: number | undefined = undefined;
      let unrealisedPnL: number | undefined = undefined;

      if (
        typeof h.shares === 'number' &&
        h.shares > 0 &&
        typeof h.averageBuyingPrice === 'number' &&
        h.averageBuyingPrice > 0
      ) {
        costBasis = h.shares * h.averageBuyingPrice;
        totalCostBasis += costBasis;
        eligibleCostBasisForPnL += costBasis;
        eligibleMarketValueForPnL += marketVal;
        unrealisedPnL = marketVal - costBasis;
        holdingsWithCostBasisCount++;
      }

      return {
        symbol: h.symbol || h.symbolOrName,
        shares: h.shares || 0,
        currentPrice: h.pricePerShare || 0,
        averageBuyingPrice: h.averageBuyingPrice,
        marketValue: marketVal,
        costBasis,
        unrealisedPnL,
      };
    });

    const totalUnrealisedPnL = eligibleMarketValueForPnL - eligibleCostBasisForPnL;

    let changeType: PortfolioSnapshot['changeType'] = snapshots.length === 0 ? 'initial' : 'market_update';
    let changeNote = snapshots.length === 0 ? 'First portfolio observation' : 'Market observation';

    // Check against previous snapshot for deduplication policy and change categorization
    if (snapshots.length > 0) {
      const last = snapshots[snapshots.length - 1];
      const lastTime = new Date(last.timestamp).getTime();
      const currentTime = new Date(nowIso).getTime();

      const isPriceIdentical =
        last.holdingsSummary.length === holdingsSummary.length &&
        last.holdingsSummary.every((prev, i) => {
          const curr = holdingsSummary[i];
          return (
            curr &&
            curr.symbol === prev.symbol &&
            curr.shares === prev.shares &&
            curr.currentPrice === prev.currentPrice &&
            curr.averageBuyingPrice === prev.averageBuyingPrice
          );
        });

      const isValueIdentical =
        last.totalMarketValue === totalMarketValue &&
        last.totalCostBasis === totalCostBasis &&
        last.holdingsCount === holdings.length &&
        last.holdingsWithCostBasisCount === holdingsWithCostBasisCount;

      // Deduplication: Avoid duplicate identical consecutive snapshots within 1 hour policy
      if (isPriceIdentical && isValueIdentical && currentTime - lastTime < 3600000) {
        return snapshots; // Skip duplicate rapid observation
      }

      // Categorize non-market changes explicitly
      if (last.holdingsWithCostBasisCount !== holdingsWithCostBasisCount) {
        changeType = 'coverage_change';
        changeNote = `Gain/loss coverage changed (${holdingsWithCostBasisCount} of ${holdings.length} with buying price) — not a market gain/loss`;
      } else if (last.holdingsCount !== holdings.length) {
        changeType = 'portfolio_change';
        changeNote = `Holdings count changed from ${last.holdingsCount} to ${holdings.length} (recorded portfolio change)`;
      } else if (isPriceIdentical && !isValueIdentical) {
        changeType = 'portfolio_change';
        changeNote = 'Portfolio structure edited';
      } else {
        changeType = 'market_update';
        changeNote = 'Market prices updated';
      }
    }

    const newSnapshot: PortfolioSnapshot = {
      timestamp: nowIso,
      totalMarketValue,
      totalCostBasis,
      eligibleCostBasisForPnL,
      eligibleMarketValueForPnL,
      totalUnrealisedPnL,
      holdingsCount: holdings.length,
      holdingsWithCostBasisCount,
      valuationComplete,
      changeType,
      changeNote,
      holdingsSummary,
    };

    const updated = [...snapshots, newSnapshot];
    // Keep max 100 snapshots
    const trimmed = updated.slice(-100);
    store.setItem(PORTFOLIO_SNAPSHOT_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (err) {
    console.warn('Unable to save portfolio snapshot:', err);
    return loadPortfolioSnapshots(store);
  }
}

/**
 * Calculates weighted average buying price when combining duplicate lots:
 * total purchase cost / total shares.
 */
export function calculateWeightedAverageBuyingPrice(
  existingShares: number,
  existingAvgPrice: number,
  newShares: number,
  newAvgPrice: number
): number {
  const totalShares = existingShares + newShares;
  if (totalShares <= 0) return 0;
  const totalCost = existingShares * existingAvgPrice + newShares * newAvgPrice;
  return totalCost / totalShares;
}
