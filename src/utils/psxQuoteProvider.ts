/**
 * PSX Quote Provider Adapter
 *
 * Dedicated adapter architecture for fetching quotes and listed instruments
 * from the tested psxdata-api service (https://psxdata-api.fastapicloud.dev).
 *
 * Usage Terms & Redistribution Disclosure:
 * - psxdata-api is an open-source community FastAPI deployment (MIT License).
 * - It queries/proxies data from Pakistan Stock Exchange public portals.
 * - Technical access is unauthenticated with CORS headers enabled.
 * - Pakistan Stock Exchange (PSX) does not officially certify this third-party
 *   deployment or grant redistribution rights.
 * - This provider is designed as an optional helper source; user-entered manual
 *   pricing remains available as an authoritative fallback.
 */

export interface ProviderQuoteData {
  symbol: string;
  price: number;
  peRatio?: number | null;
  dividendYield?: number | null;
  changePct?: number | null;
  volumeAvg30d?: number | null;
  change1yPct?: number | null;
}

export interface ProviderQuoteResponse {
  success: boolean;
  symbol: string;
  price: number | null;
  currency: 'PKR';
  fetchedAt: string;               // ISO timestamp when client received response
  marketAsOf: string | null;       // Market quote trading time (null if provider does not supply)
  providerTimestamp: string;       // meta.timestamp from server execution
  providerSource: string;          // Provider name and endpoint
  isCached: boolean;               // Whether returned from client-side cache
  error?: string;
  peRatio?: number | null;
  dividendYield?: number | null;
  changePct?: number | null;
}

export interface QuoteProviderAdapter {
  name: string;
  baseUrl: string;
  getQuote(symbol: string, options?: { forceRefresh?: boolean }): Promise<ProviderQuoteResponse>;
  getListedTickers(): Promise<string[]>;
  isConfigured(): boolean;
  getMetadata(): {
    providerName: string;
    license: string;
    redistributionStatus: string;
    marketQuoteTimeSupported: boolean;
  };
}

/**
 * Known debt instrument patterns to filter out from equity pickers.
 * PSX debt market instruments include:
 * - TFCs (Term Finance Certificates): e.g., BAFLTFC6, BOPTFC2, AKBLTFC6
 * - SCs (Subordinated Sukuk Certificates): e.g., BIPLSC, FABLSC
 * - T-Bills & PIBs (Government securities)
 */
export function isDebtOrDerivativeInstrument(symbol: string): boolean {
  const upper = symbol.trim().toUpperCase();
  // Check common debt instrument substrings
  if (upper.includes('TFC')) return true; // Term Finance Certificates
  if (upper.includes('SUKUK')) return true;
  if (/^[A-Z]{3,5}SC\d*$/.test(upper)) return true; // Subordinated Sukuk e.g. BIPLSC, FABLSC
  if (upper.startsWith('TBILL') || upper.startsWith('PIB')) return true;
  // Deliverable futures usually have -F or month suffixes
  if (upper.includes('-F') || upper.includes('-NOV') || upper.includes('-DEC') || upper.includes('-OCT')) return true;
  return false;
}

/**
 * Classifies an instrument symbol based on known directory metadata and ticker characteristics.
 */
export function classifyInstrument(symbol: string): 'equity' | 'reit' | 'etf' | 'debt' | 'unclassified' {
  const upper = symbol.trim().toUpperCase();
  if (isDebtOrDerivativeInstrument(upper)) {
    return 'debt';
  }
  if (upper === 'DCR') {
    return 'reit'; // Dolmen City REIT
  }
  if (upper.endsWith('ETF') || upper.includes('ETF')) {
    return 'etf'; // E.g., MIIETF, UBLPETF, JSGETF
  }
  return 'equity';
}

export const QUOTE_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours TTL
export const CACHE_SCHEMA_VERSION = 1;
export const DEFAULT_PROVIDER_NAME = 'psxdata-api';
export const DEFAULT_EXCHANGE = 'PSX';
export const DEFAULT_MARKET_SEGMENT = 'REG';
export const REFRESH_COOLDOWN_MS = 5000; // 5-second cooldown for explicit refresh

const REQUEST_TIMEOUT_MS = 8000; // 8 seconds timeout

/**
 * Builds a versioned session cache key adhering to:
 * Provider identity · Exchange · Market segment · Normalized symbol
 * e.g., psx_quote_v1:psxdata-api:PSX:REG:FFC
 */
export function buildQuoteSessionCacheKey(
  symbol: string,
  provider = DEFAULT_PROVIDER_NAME,
  exchange = DEFAULT_EXCHANGE,
  marketSegment = DEFAULT_MARKET_SEGMENT
): string {
  const clean = symbol.trim().toUpperCase();
  return `psx_quote_v${CACHE_SCHEMA_VERSION}:${provider}:${exchange}:${marketSegment}:${clean}`;
}

/**
 * Stored session cache entry schema
 */
export interface StoredQuoteCacheEntry {
  schemaVersion: number;
  provider: string;
  exchange: string;
  marketSegment: string;
  symbol: string;
  price: number;
  currency: 'PKR';
  fetchedAt: string;               // ISO timestamp of retrieval
  expiresAt: number;               // Epoch ms timestamp when cache expires
  providerTimestamp?: string;      // Server meta timestamp
  marketTimestamp?: string | null; // Actual market quote timestamp when available
  priceType: 'provider_quote';
  provenance: 'provider_quote';
  peRatio?: number | null;
  dividendYield?: number | null;
  changePct?: number | null;
}

/**
 * Safe sessionStorage accessor with robust in-memory fallback.
 * Gracefully handles sandbox restrictions, SecurityError, QuotaExceededError,
 * and environments where window.sessionStorage is undefined or blocked.
 */
export class SafeSessionStore {
  private memoryFallback = new Map<string, string>();

  public getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch {
      // Storage access blocked or restricted
    }
    return this.memoryFallback.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
        // Also keep memory fallback in sync
        this.memoryFallback.set(key, value);
        return;
      }
    } catch {
      // Storage quota failure or security exception
    }
    this.memoryFallback.set(key, value);
  }

  public removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
    this.memoryFallback.delete(key);
  }

  public clearQuotes(): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const toRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k && k.startsWith('psx_quote_')) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => window.sessionStorage.removeItem(k));
      }
    } catch {
      // Ignore
    }
    this.memoryFallback.clear();
  }
}

export const defaultSessionStore = new SafeSessionStore();

/**
 * Validates and parses a raw cached JSON string against strict schema requirements:
 * - Valid JSON object
 * - Current schema version
 * - Matching instrument identity (symbol)
 * - Positive, finite price & PKR currency
 * - Valid fetchedAt (rejects future timestamps beyond 60s tolerance)
 * - Valid numeric expiresAt & unexpired against current time
 *
 * NOTE: Reading a valid cache entry MUST NOT extend its expiresAt!
 */
export function validateAndParseCachedQuote(
  rawJson: string | null,
  expectedSymbol: string,
  nowMs: number
): { valid: boolean; entry?: StoredQuoteCacheEntry; reason?: string } {
  if (!rawJson) {
    return { valid: false, reason: 'No cache entry' };
  }

  let data: any;
  try {
    data = JSON.parse(rawJson);
  } catch {
    return { valid: false, reason: 'Malformed cache JSON' };
  }

  if (!data || typeof data !== 'object') {
    return { valid: false, reason: 'Cache entry is not an object' };
  }

  if (data.schemaVersion !== CACHE_SCHEMA_VERSION) {
    return { valid: false, reason: `Unsupported schema version: ${data.schemaVersion}` };
  }

  const cleanExpected = expectedSymbol.trim().toUpperCase();
  if (
    typeof data.symbol !== 'string' ||
    data.symbol.trim().toUpperCase() !== cleanExpected
  ) {
    return { valid: false, reason: `Symbol mismatch in cache: expected ${cleanExpected}, got ${data.symbol}` };
  }

  if (
    typeof data.price !== 'number' ||
    isNaN(data.price) ||
    !isFinite(data.price) ||
    data.price <= 0
  ) {
    return { valid: false, reason: `Invalid non-positive price in cache: ${data.price}` };
  }

  if (data.currency !== 'PKR') {
    return { valid: false, reason: `Unsupported currency in cache: ${data.currency}` };
  }

  if (typeof data.fetchedAt !== 'string') {
    return { valid: false, reason: 'Missing fetchedAt timestamp' };
  }

  const fetchedAtMs = new Date(data.fetchedAt).getTime();
  if (isNaN(fetchedAtMs)) {
    return { valid: false, reason: 'Invalid fetchedAt timestamp' };
  }

  // Reject future timestamps beyond 60s clock skew
  if (fetchedAtMs > nowMs + 60000) {
    return { valid: false, reason: 'Future fetchedAt timestamp detected' };
  }

  if (typeof data.expiresAt !== 'number' || isNaN(data.expiresAt) || !isFinite(data.expiresAt)) {
    return { valid: false, reason: 'Invalid expiresAt timestamp' };
  }

  if (nowMs >= data.expiresAt) {
    return { valid: false, reason: 'Cache entry expired' };
  }

  return {
    valid: true,
    entry: data as StoredQuoteCacheEntry,
  };
}

export interface PsxAdapterOptions {
  baseUrl?: string;
  cacheTtlMs?: number;
  getNow?: () => number;
  sessionStore?: SafeSessionStore;
}

export class PsxDataApiAdapter implements QuoteProviderAdapter {
  public readonly name = DEFAULT_PROVIDER_NAME;
  public readonly baseUrl: string;
  private inFlightRequests: Map<string, Promise<ProviderQuoteResponse>> = new Map();
  private lastRefreshTimestamp: Map<string, number> = new Map();
  private tickersCache: { tickers: string[]; expiresAt: number } | null = null;
  private cacheTtlMs: number;
  private getNow: () => number;
  private store: SafeSessionStore;

  constructor(options?: PsxAdapterOptions) {
    this.baseUrl = (options?.baseUrl || 'https://psxdata-api.fastapicloud.dev').replace(/\/+$/, '');
    this.cacheTtlMs = options?.cacheTtlMs ?? QUOTE_CACHE_TTL_MS;
    this.getNow = options?.getNow ?? (() => Date.now());
    this.store = options?.sessionStore ?? defaultSessionStore;
  }

  public isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  public getMetadata() {
    return {
      providerName: 'psxdata-api (FastAPI Community Deployment)',
      license: 'MIT (Service implementation)',
      redistributionStatus: 'Public unauthenticated endpoint; underlying PSX market data redistribution uncertified.',
      marketQuoteTimeSupported: false, // Provider returns server execution time, not quote trading timestamp
    };
  }

  /**
   * Sets or updates the clock provider (useful for testing cache expiry without waiting 2 hours).
   */
  public setClock(clock: () => number): void {
    this.getNow = clock;
  }

  /**
   * Validates raw JSON quote payload from provider.
   */
  public validateRawQuote(raw: any, expectedSymbol: string): { isValid: boolean; error?: string } {
    if (!raw || typeof raw !== 'object') {
      return { isValid: false, error: 'Empty or invalid response object' };
    }
    if (raw.error) {
      return { isValid: false, error: raw.error.message || 'Provider returned error status' };
    }
    const data = raw.data;
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'Response missing data field' };
    }
    if (!data.symbol || typeof data.symbol !== 'string') {
      return { isValid: false, error: 'Missing or invalid symbol in quote' };
    }
    if (data.symbol.trim().toUpperCase() !== expectedSymbol.trim().toUpperCase()) {
      return { isValid: false, error: `Symbol mismatch: expected ${expectedSymbol}, got ${data.symbol}` };
    }
    if (typeof data.price !== 'number' || isNaN(data.price) || !isFinite(data.price) || data.price <= 0) {
      return { isValid: false, error: `Invalid non-positive price: ${data.price}` };
    }
    return { isValid: true };
  }

  /**
   * Sets or records the refresh timestamp for cooldown tracking.
   */
  public recordRefresh(symbol: string, timestamp?: number): void {
    this.lastRefreshTimestamp.set(symbol.trim().toUpperCase(), timestamp ?? this.getNow());
  }

  /**
   * Retrieves a quote for a stock symbol with two-hour session caching,
   * deduplication of simultaneous in-flight requests, and cooldown-protected refreshes.
   */
  public getQuote(
    symbol: string,
    options?: { forceRefresh?: boolean; bypassCooldown?: boolean }
  ): Promise<ProviderQuoteResponse> {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) {
      return Promise.resolve({
        success: false,
        symbol: '',
        price: null,
        currency: 'PKR',
        fetchedAt: new Date(this.getNow()).toISOString(),
        marketAsOf: null,
        providerTimestamp: '',
        providerSource: this.name,
        isCached: false,
        error: 'Empty symbol provided',
      });
    }

    const now = this.getNow();
    const cacheKey = buildQuoteSessionCacheKey(cleanSymbol, this.name, DEFAULT_EXCHANGE, DEFAULT_MARKET_SEGMENT);

    // 1. Check session cache if not forceRefresh
    if (!options?.forceRefresh) {
      const rawCached = this.store.getItem(cacheKey);
      const parsed = validateAndParseCachedQuote(rawCached, cleanSymbol, now);
      if (parsed.valid && parsed.entry) {
        // Return valid cached response. NOTE: Do not extend expiry on read!
        return Promise.resolve({
          success: true,
          symbol: parsed.entry.symbol,
          price: parsed.entry.price,
          currency: parsed.entry.currency,
          fetchedAt: parsed.entry.fetchedAt,
          marketAsOf: parsed.entry.marketTimestamp ?? null,
          providerTimestamp: parsed.entry.providerTimestamp || '',
          providerSource: parsed.entry.provider,
          isCached: true,
          peRatio: parsed.entry.peRatio ?? null,
          dividendYield: parsed.entry.dividendYield ?? null,
          changePct: parsed.entry.changePct ?? null,
        });
      }
    } else {
      // Explicit refresh: enforce short cooldown to prevent accidental repeated clicks
      if (!options?.bypassCooldown) {
        const lastRefresh = this.lastRefreshTimestamp.get(cleanSymbol) || 0;
        if (now - lastRefresh < REFRESH_COOLDOWN_MS) {
          // If in cooldown, check if we have a valid unexpired cache entry to return
          const rawCached = this.store.getItem(cacheKey);
          const parsed = validateAndParseCachedQuote(rawCached, cleanSymbol, now);
          if (parsed.valid && parsed.entry) {
            return Promise.resolve({
              success: true,
              symbol: parsed.entry.symbol,
              price: parsed.entry.price,
              currency: parsed.entry.currency,
              fetchedAt: parsed.entry.fetchedAt,
              marketAsOf: parsed.entry.marketTimestamp ?? null,
              providerTimestamp: parsed.entry.providerTimestamp || '',
              providerSource: parsed.entry.provider,
              isCached: true,
              peRatio: parsed.entry.peRatio ?? null,
              dividendYield: parsed.entry.dividendYield ?? null,
              changePct: parsed.entry.changePct ?? null,
            });
          }
        }
      }
    }

    // 2. Deduplicate in-flight requests for the same symbol
    const inFlight = this.inFlightRequests.get(cleanSymbol);
    if (inFlight) {
      return inFlight;
    }

    const fetchPromise = this.executeFetchAndCache(cleanSymbol, cacheKey);
    this.inFlightRequests.set(cleanSymbol, fetchPromise);
    fetchPromise.finally(() => {
      this.inFlightRequests.delete(cleanSymbol);
    });

    return fetchPromise;
  }

  private async executeFetchAndCache(cleanSymbol: string, cacheKey: string): Promise<ProviderQuoteResponse> {
    const result = await this.executeFetchQuoteWithRetry(cleanSymbol);
    if (result.success && result.price !== null && result.price > 0) {
      // Cache only successful, validated responses
      const entry: StoredQuoteCacheEntry = {
        schemaVersion: CACHE_SCHEMA_VERSION,
        provider: this.name,
        exchange: DEFAULT_EXCHANGE,
        marketSegment: DEFAULT_MARKET_SEGMENT,
        symbol: cleanSymbol,
        price: result.price,
        currency: 'PKR',
        fetchedAt: result.fetchedAt,
        expiresAt: this.getNow() + this.cacheTtlMs,
        providerTimestamp: result.providerTimestamp,
        marketTimestamp: result.marketAsOf,
        priceType: 'provider_quote',
        provenance: 'provider_quote',
        peRatio: result.peRatio ?? null,
        dividendYield: result.dividendYield ?? null,
        changePct: result.changePct ?? null,
      };
      this.store.setItem(cacheKey, JSON.stringify(entry));
      this.lastRefreshTimestamp.set(cleanSymbol, this.getNow());
    }
    return result;
  }

  /**
   * Internal fetch with 1 bounded retry on transient network failures.
   */
  private async executeFetchQuoteWithRetry(symbol: string): Promise<ProviderQuoteResponse> {
    const maxAttempts = 2;
    let lastError = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const url = `${this.baseUrl}/stocks/${encodeURIComponent(symbol)}/quote`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Handle HTTP status
        if (res.status === 404) {
          return {
            success: false,
            symbol,
            price: null,
            currency: 'PKR',
            fetchedAt: new Date().toISOString(),
            marketAsOf: null,
            providerTimestamp: '',
            providerSource: this.name,
            isCached: false,
            error: `Symbol “${symbol}” not found on quote provider.`,
          };
        }

        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          return {
            success: false,
            symbol,
            price: null,
            currency: 'PKR',
            fetchedAt: new Date().toISOString(),
            marketAsOf: null,
            providerTimestamp: '',
            providerSource: this.name,
            isCached: false,
            error: retryAfter
              ? `Rate limit reached. Please wait ${retryAfter}s before retrying.`
              : 'Rate limit reached (60/min). Please try again in a moment.',
          };
        }

        if (!res.ok) {
          lastError = `HTTP ${res.status}: ${res.statusText || 'Provider error'}`;
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          break;
        }

        const raw = await res.json();
        const validation = this.validateRawQuote(raw, symbol);
        if (!validation.isValid) {
          return {
            success: false,
            symbol,
            price: null,
            currency: 'PKR',
            fetchedAt: new Date().toISOString(),
            marketAsOf: null,
            providerTimestamp: raw?.meta?.timestamp || '',
            providerSource: this.name,
            isCached: false,
            error: validation.error || 'Invalid quote data structure',
          };
        }

        const quoteData = raw.data;
        const meta = raw.meta || {};

        return {
          success: true,
          symbol: quoteData.symbol,
          price: quoteData.price,
          currency: 'PKR',
          fetchedAt: new Date().toISOString(),
          marketAsOf: null, // psxdata-api meta.timestamp is request execution time, not market trade time
          providerTimestamp: meta.timestamp || '',
          providerSource: 'psxdata-api',
          isCached: false,
          peRatio: typeof quoteData.pe_ratio === 'number' ? quoteData.pe_ratio : null,
          dividendYield: typeof quoteData.dividend_yield === 'number' ? quoteData.dividend_yield : null,
          changePct: typeof quoteData.change_pct === 'number' ? quoteData.change_pct : null,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          lastError = 'Request timed out after 8 seconds.';
        } else {
          lastError = err.message || 'Network request failed';
        }
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }

    return {
      success: false,
      symbol,
      price: null,
      currency: 'PKR',
      fetchedAt: new Date().toISOString(),
      marketAsOf: null,
      providerTimestamp: '',
      providerSource: this.name,
      isCached: false,
      error: lastError || 'Unable to fetch quote from provider.',
    };
  }

  /**
   * Fetches the list of all tickers from the provider and filters out debt instruments.
   */
  public async getListedTickers(): Promise<string[]> {
    const now = Date.now();
    if (this.tickersCache && this.tickersCache.expiresAt > now) {
      return this.tickersCache.tickers;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(`${this.baseUrl}/stocks`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return [];
      }

      const json = await res.json();
      if (Array.isArray(json?.data)) {
        // Exclude debt instruments (TFCs, Sukuks, etc.)
        const filteredTickers = (json.data as string[])
          .map((s) => s.trim().toUpperCase())
          .filter((s) => !isDebtOrDerivativeInstrument(s));

        this.tickersCache = {
          tickers: filteredTickers,
          expiresAt: now + 30 * 60 * 1000, // 30 min cache
        };
        return filteredTickers;
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Clears in-memory and session storage quote caches.
   */
  public clearCache(): void {
    this.store.clearQuotes();
    this.lastRefreshTimestamp.clear();
    this.tickersCache = null;
  }
}

// Singleton default instance
export const defaultQuoteProvider = new PsxDataApiAdapter();
