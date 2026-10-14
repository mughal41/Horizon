/**
 * PSX Company Search and Verified Quote Service
 *
 * Sourced regular-market equities directory paired with psxdata-api
 * provider adapter for optional automated pricing and transparent provenance.
 */

import {
  PSX_COMPANIES,
  PSX_DIRECTORY_METADATA,
  PsxCompany,
  InstrumentType,
} from '../data/psxDirectory';
import {
  defaultQuoteProvider,
  ProviderQuoteResponse,
  classifyInstrument,
  isDebtOrDerivativeInstrument,
} from './psxQuoteProvider';
import { StockHolding, HoldingPriceProvenance, HoldingPriceStatus } from '../types/horizon';

export type { PsxCompany, InstrumentType };
export type { PsxSnapshotQuote } from '../data/psxDirectory';
export type { QuoteProviderAdapter, ProviderQuoteResponse } from './psxQuoteProvider';

export type QuoteProvenance = HoldingPriceProvenance;

export interface PsxQuoteResult {
  symbol: string;
  companyName: string;
  sector: string;
  instrumentType: InstrumentType;
  price: number | null;
  currency: 'PKR';
  asOf: string;
  fetchedAt?: string;
  marketAsOf?: string | null;
  providerTimestamp?: string;
  providerSource?: string;
  source?: string;
  provenance: QuoteProvenance;
  priceType?: 'provider_quote' | 'regular_market_close' | 'intraday' | 'manual';
  status: 'valid_quote' | 'verified_snapshot' | 'unavailable' | 'manual_override' | 'price_needs_updating';
  statusMessage: string;
  isVerified: boolean;
  isCached?: boolean;
  peRatio?: number | null;
  dividendYield?: number | null;
  changePct?: number | null;
}

/**
 * Formats time in Pakistan Standard Time (PKT / Asia/Karachi).
 * e.g., "12:40 PM"
 */
export function formatPakistanTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Karachi',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

/**
 * Formats date in Pakistan Standard Time (PKT / Asia/Karachi).
 * e.g., "14 Oct"
 */
export function formatPakistanDate(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      timeZone: 'Asia/Karachi',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

/**
 * Checks if the timestamp falls on the same calendar day in Pakistan Standard Time.
 */
export function isSameDayPakistan(isoString?: string, referenceNow = new Date()): boolean {
  if (!isoString) return false;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return false;
    const opt: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    };
    return (
      d.toLocaleDateString('en-US', opt) === referenceNow.toLocaleDateString('en-US', opt)
    );
  } catch {
    return false;
  }
}

/**
 * Generates the clean, non-technical plain pricing state label:
 * - “Fetched at 12:40 PM.” (or “Fetched at 14 Oct, 12:40 PM.” if not today)
 * - “Saved price · fetched at 12:40 PM.”
 * - “Entered by you.”
 * - “Couldn’t update the price.”
 */
export function getPricingStateLabel(options: {
  isManual?: boolean;
  isSavedPrice?: boolean;
  fetchedAt?: string;
  hasError?: boolean;
  referenceNow?: Date;
}): string {
  if (options.hasError) {
    return 'Couldn’t update the price.';
  }
  if (options.isManual) {
    return 'Entered by you.';
  }
  if (!options.fetchedAt) {
    return 'Couldn’t update the price.';
  }

  const timeStr = formatPakistanTime(options.fetchedAt);
  if (!timeStr) {
    return 'Couldn’t update the price.';
  }

  const sameDay = isSameDayPakistan(options.fetchedAt, options.referenceNow);
  const timeFormatted = sameDay ? timeStr : `${formatPakistanDate(options.fetchedAt)}, ${timeStr}`;

  if (options.isSavedPrice) {
    return `Saved price · fetched at ${timeFormatted}.`;
  }
  return `Fetched at ${timeFormatted}.`;
}

/**
 * Legacy formatter maintained for backward compatibility.
 */
export function formatQuoteTime(isoString?: string): string {
  return formatPakistanTime(isoString) || 'Quote time unavailable';
}

export function getQuoteTimestampDisplay(quote: {
  fetchedAt?: string;
  marketAsOf?: string | null;
  priceAsOf?: string;
  provenance?: QuoteProvenance;
  priceStatus?: HoldingPriceStatus;
}): string {
  if (quote.provenance === 'user_manual' || quote.priceStatus === 'manual') {
    return 'Entered by you.';
  }
  if (quote.priceStatus === 'price_needs_updating') {
    return 'Couldn’t update the price.';
  }
  if (quote.fetchedAt) {
    return getPricingStateLabel({
      fetchedAt: quote.fetchedAt,
      isSavedPrice: quote.priceStatus === 'unverified_saved' || quote.provenance !== 'provider_quote',
    });
  }
  if (quote.priceAsOf) {
    return quote.priceAsOf;
  }
  return 'Couldn’t update the price.';
}

/**
 * Searches the PSX company directory by:
 * 1. Exact symbol (case-insensitive, trimmed) -> Ranked first
 * 2. Symbol prefix match -> Ranked second
 * 3. Symbol substring match -> Ranked third
 * 4. Company name word-prefix match -> Ranked fourth
 * 5. Company name substring match -> Ranked fifth
 *
 * Excludes debt instruments and derivatives. Unknown or misspelled inputs
 * never silently select a different company.
 */
export function searchPsxCompanies(
  query: string,
  options?: {
    instrumentType?: 'all' | 'equity' | 'mutual_fund';
    limit?: number;
  }
): PsxCompany[] {
  const clean = query.trim().toUpperCase();
  if (!clean) return [];

  // Exclude debt or derivative symbols from search query
  const filterType = options?.instrumentType || 'all';
  const limit = options?.limit || 15;

  const filtered = PSX_COMPANIES.filter((company) => {
    if (isDebtOrDerivativeInstrument(company.symbol)) return false;
    if (filterType !== 'all' && company.instrumentType !== filterType) {
      return false;
    }
    return true;
  });

  const exactSymbol: PsxCompany[] = [];
  const prefixSymbol: PsxCompany[] = [];
  const containsSymbol: PsxCompany[] = [];
  const nameWordPrefix: PsxCompany[] = [];
  const nameContains: PsxCompany[] = [];

  for (const company of filtered) {
    const symbolUpper = company.symbol.toUpperCase();
    const nameUpper = company.name.toUpperCase();

    if (symbolUpper === clean) {
      exactSymbol.push(company);
    } else if (symbolUpper.startsWith(clean)) {
      prefixSymbol.push(company);
    } else if (symbolUpper.includes(clean)) {
      containsSymbol.push(company);
    } else {
      const words = nameUpper.split(/[\s,()/-]+/);
      const matchesWordPrefix = words.some((w) => w.startsWith(clean));
      if (matchesWordPrefix) {
        nameWordPrefix.push(company);
      } else if (nameUpper.includes(clean)) {
        nameContains.push(company);
      }
    }
  }

  const combined = [
    ...exactSymbol,
    ...prefixSymbol,
    ...containsSymbol,
    ...nameWordPrefix,
    ...nameContains,
  ];

  return combined.slice(0, limit);
}

/**
 * Fetches an automatic quote from the tested psxdata-api provider.
 * Validates the response, handles rate limits and network errors,
 * separates execution timestamp from market trading time, and leaves
 * missing fundamentals as null/undefined without substituting zero.
 */
export async function fetchPsxProviderQuote(
  symbol: string,
  options?: { forceRefresh?: boolean }
): Promise<PsxQuoteResult> {
  const clean = symbol.trim().toUpperCase();
  const company = PSX_COMPANIES.find((c) => c.symbol.toUpperCase() === clean);

  const companyName = company ? company.name : clean;
  const sector = company ? company.sector : 'Unassigned';
  const instrumentType = company ? company.instrumentType : (classifyInstrument(clean) as any);

  try {
    const res = await defaultQuoteProvider.getQuote(clean, options);

    if (res.success && res.price !== null && res.price > 0) {
      const statusMessage = getPricingStateLabel({
        fetchedAt: res.fetchedAt,
        isSavedPrice: res.isCached,
      });

      return {
        symbol: clean,
        companyName,
        sector,
        instrumentType,
        price: res.price,
        currency: 'PKR',
        asOf: statusMessage,
        fetchedAt: res.fetchedAt,
        marketAsOf: null, // psxdata-api does not supply market quote trade execution time
        providerTimestamp: res.providerTimestamp,
        providerSource: 'psxdata-api',
        provenance: 'provider_quote',
        priceType: 'provider_quote',
        status: 'valid_quote',
        statusMessage,
        isVerified: true,
        isCached: res.isCached,
        peRatio: res.peRatio ?? null,
        dividendYield: res.dividendYield ?? null,
        changePct: res.changePct ?? null,
      };
    }

    return {
      symbol: clean,
      companyName,
      sector,
      instrumentType,
      price: null,
      currency: 'PKR',
      asOf: 'Couldn’t update the price.',
      fetchedAt: res.fetchedAt,
      marketAsOf: null,
      providerTimestamp: res.providerTimestamp,
      providerSource: 'psxdata-api',
      provenance: 'missing_price',
      priceType: 'manual',
      status: 'unavailable',
      statusMessage: 'Couldn’t update the price.',
      isVerified: false,
    };
  } catch (err: any) {
    return {
      symbol: clean,
      companyName,
      sector,
      instrumentType,
      price: null,
      currency: 'PKR',
      asOf: 'Couldn’t update the price.',
      fetchedAt: new Date().toISOString(),
      marketAsOf: null,
      providerTimestamp: '',
      providerSource: 'psxdata-api',
      provenance: 'missing_price',
      priceType: 'manual',
      status: 'unavailable',
      statusMessage: 'Couldn’t update the price.',
      isVerified: false,
    };
  }
}

/**
 * Synchronous quote helper (preserves historical snapshot for testing or offline reference).
 * Note: Historical snapshots from 2024 are explicitly labeled as historical and must
 * not be used as current valuation without user confirmation.
 */
export function getPsxQuote(symbol: string): PsxQuoteResult {
  const clean = symbol.trim().toUpperCase();
  const company = PSX_COMPANIES.find((c) => c.symbol.toUpperCase() === clean);

  if (!company) {
    return {
      symbol: clean,
      companyName: clean,
      sector: 'Custom',
      instrumentType: 'equity',
      price: null,
      currency: 'PKR',
      asOf: 'N/A',
      providerSource: 'User Entry',
      provenance: 'user_manual',
      priceType: 'manual',
      status: 'unavailable',
      statusMessage: `No verified quote on record for “${clean}”. Enter your price manually.`,
      isVerified: false,
    };
  }

  if (company.snapshotQuote) {
    return {
      symbol: company.symbol,
      companyName: company.name,
      sector: company.sector,
      instrumentType: company.instrumentType,
      price: company.snapshotQuote.price,
      currency: company.snapshotQuote.currency,
      asOf: company.snapshotQuote.asOf,
      providerSource: company.snapshotQuote.source,
      provenance: 'market_snapshot',
      priceType: 'regular_market_close',
      status: 'verified_snapshot',
      statusMessage: `Historical close snapshot: PKR ${company.snapshotQuote.price.toLocaleString()} (${company.snapshotQuote.asOf}).`,
      isVerified: true,
    };
  }

  return {
    symbol: company.symbol,
    companyName: company.name,
    sector: company.sector,
    instrumentType: company.instrumentType,
    price: null,
    currency: 'PKR',
    asOf: 'N/A',
    providerSource: 'Directory Entry',
    provenance: 'user_manual',
    priceType: 'manual',
    status: 'unavailable',
    statusMessage: `Price unavailable for ${company.name}. Enter your share price manually.`,
    isVerified: false,
  };
}

/**
 * Validates a quote response payload to prevent malformed or invalid prices from corrupting user calculations.
 */
export function validateQuoteResponse(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  if (!raw.symbol || typeof raw.symbol !== 'string' || raw.symbol.trim() === '') return false;
  if (typeof raw.price !== 'number' || isNaN(raw.price) || !isFinite(raw.price) || raw.price <= 0) return false;
  return true;
}

/**
 * Resolves the holding price under failure, refresh, or manual override conditions.
 * Ensures that previous verified quotes are never zeroed out upon refresh failure.
 */
export function resolveHoldingPrice(options: {
  existingQuote?: PsxQuoteResult;
  refreshFailed?: boolean;
  userManualPrice?: number;
  userPreferredMode?: 'provider_quote' | 'market_snapshot' | 'user_manual';
}): {
  price: number | null;
  provenance: QuoteProvenance;
  isRetainedOnFailure: boolean;
  isVerified: boolean;
} {
  const { existingQuote, refreshFailed, userManualPrice, userPreferredMode } = options;

  // Manual override explicitly chosen
  if (userPreferredMode === 'user_manual' && typeof userManualPrice === 'number' && userManualPrice > 0) {
    return {
      price: userManualPrice,
      provenance: 'user_manual',
      isRetainedOnFailure: false,
      isVerified: false,
    };
  }

  // Refresh failed but we have an existing price -> Retain previous price, do not substitute 0
  if (refreshFailed && existingQuote && existingQuote.price !== null && existingQuote.price > 0) {
    return {
      price: existingQuote.price,
      provenance: existingQuote.provenance,
      isRetainedOnFailure: true,
      isVerified: existingQuote.isVerified,
    };
  }

  // Normal quote
  if (existingQuote && existingQuote.price !== null && existingQuote.price > 0) {
    return {
      price: existingQuote.price,
      provenance: existingQuote.provenance,
      isRetainedOnFailure: false,
      isVerified: existingQuote.isVerified,
    };
  }

  // Manual price fallback
  if (typeof userManualPrice === 'number' && userManualPrice > 0) {
    return {
      price: userManualPrice,
      provenance: 'user_manual',
      isRetainedOnFailure: false,
      isVerified: false,
    };
  }

  return {
    price: null,
    provenance: 'missing_price',
    isRetainedOnFailure: false,
    isVerified: false,
  };
}

/**
 * Handles race conditions where a user quickly switches companies while a quote request is in-flight.
 * Returns null if the quote result does not match the currently active selection.
 */
export function handleInFlightQuoteSelection(
  activeSelectedSymbol: string,
  incomingQuote: PsxQuoteResult
): PsxQuoteResult | null {
  if (!activeSelectedSymbol || !incomingQuote) return null;
  if (activeSelectedSymbol.trim().toUpperCase() !== incomingQuote.symbol.trim().toUpperCase()) {
    // Stale in-flight response from a previous selection, discard safely
    return null;
  }
  return incomingQuote;
}

/**
 * Migrates legacy stored holdings without verified metadata into the current schema.
 * - Holdings using the 2024 historical snapshot are marked 'price_needs_updating'
 * - Holdings of unknown legacy origin are marked 'unverified_legacy' with status 'unverified_saved'
 * - User-entered manual prices are preserved as 'user_manual'
 * - Quantities and historical market values are preserved (never set to zero)
 */
export function migrateLegacyHoldings(rawHoldings: any[]): StockHolding[] {
  if (!Array.isArray(rawHoldings)) return [];

  return rawHoldings.map((h, idx) => {
    const marketValue = typeof h.marketValue === 'number' && !isNaN(h.marketValue) ? h.marketValue : 0;
    const shares = typeof h.shares === 'number' && !isNaN(h.shares) ? h.shares : undefined;
    const pricePerShare = typeof h.pricePerShare === 'number' && !isNaN(h.pricePerShare) ? h.pricePerShare : undefined;

    let provenance: HoldingPriceProvenance = 'unverified_legacy';
    let status: HoldingPriceStatus = 'unverified_saved';

    if (h.priceProvenance === 'provider_quote') {
      provenance = 'provider_quote';
      status = 'valid_quote';
    } else if (h.priceProvenance === 'user_manual' || h.isUserManual) {
      provenance = 'user_manual';
      status = 'manual';
    } else if (h.priceProvenance === 'market_snapshot' || h.isVerifiedPsx) {
      // Historical 2024 snapshot needs updating for current valuation
      provenance = 'market_snapshot';
      status = 'price_needs_updating';
    } else if (!h.priceProvenance && (shares && pricePerShare)) {
      provenance = 'unverified_legacy';
      status = 'unverified_saved';
    }

    return {
      id: h.id || `holding-${idx}-${Date.now()}`,
      symbolOrName: h.symbolOrName || h.name || 'Unnamed holding',
      symbol: h.symbol || undefined,
      companyName: h.companyName || undefined,
      sector: h.sector || 'Unassigned',
      instrumentType: h.instrumentType || 'equity',
      isVerifiedPsx: Boolean(h.isVerifiedPsx || h.symbol),
      entryMode: h.entryMode || (shares && pricePerShare ? 'shares_and_price' : 'total_value'),
      shares,
      pricePerShare,
      marketValue,
      averageBuyingPrice: h.averageBuyingPrice,
      purchaseDate: h.purchaseDate,
      quoteError: h.quoteError,
      priceProvenance: provenance,
      priceStatus: status,
      priceAsOf: h.priceAsOf || (provenance === 'market_snapshot' ? 'Oct 11, 2024 (Historical)' : undefined),
      fetchedAt: h.fetchedAt,
      marketAsOf: h.marketAsOf ?? null,
      providerTimestamp: h.providerTimestamp,
      providerSource: h.providerSource || (provenance === 'provider_quote' ? 'psxdata-api' : undefined),
      notes: h.notes,
    };
  });
}

export { PSX_DIRECTORY_METADATA };
