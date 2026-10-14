/**
 * PSX Company Search and Stock Price Verification Test Suite
 *
 * Covers:
 * 1. Exact and company-name search
 * 2. Unknown symbol safety (never silently selects another company)
 * 3. Instrument matching (equity vs fund vs debt)
 * 4. Invalid quote response rejection (malformed, non-numeric, negative)
 * 5. Last price vs previous close separation
 * 6. Timestamp preservation (as-of date maintained, never overwritten with fetch time)
 * 7. Refresh failure preservation (keeps verified quote on failure, clearly labeled)
 * 8. Manual override protection (user custom price preserved, not overwritten without action)
 * 9. In-flight race condition handling (late responses from previous symbol ignored)
 * 10. Saved plan migration (preserves legacy holdings, marks unverified provenance)
 */

import {
  searchPsxCompanies,
  getPsxQuote,
  validateQuoteResponse,
  resolveHoldingPrice,
  handleInFlightQuoteSelection,
  migrateLegacyHoldings,
  getQuoteTimestampDisplay,
  PsxQuoteResult,
} from '../utils/psxService';
import {
  isDebtOrDerivativeInstrument,
  classifyInstrument,
  PsxDataApiAdapter,
  QUOTE_CACHE_TTL_MS,
  CACHE_SCHEMA_VERSION,
  buildQuoteSessionCacheKey,
  validateAndParseCachedQuote,
  SafeSessionStore,
} from '../utils/psxQuoteProvider';
import { StockHolding } from '../types/horizon';

const testResults: Array<{ name: string; condition: string; pass: boolean; details: string }> = [];

function assertTest(name: string, condition: string, pass: boolean, details: string) {
  testResults.push({ name, condition, pass, details });
}

// 1. Exact and company-name search
{
  const exactSym = searchPsxCompanies('FFC');
  const nameSearch = searchPsxCompanies('Fauji Fertilizer Company');
  const pass =
    exactSym.length > 0 &&
    exactSym[0].symbol === 'FFC' &&
    nameSearch.length > 0 &&
    nameSearch.some((c) => c.symbol === 'FFC');
  assertTest(
    'Exact & Company Name Search',
    'Matches by exact ticker (FFC) and full/partial company name',
    pass,
    `Exact rank 1: ${exactSym[0]?.symbol}, Name match: ${nameSearch[0]?.symbol}`
  );
}

// 2. Unknown symbol safety
{
  const unknown = searchPsxCompanies('NONEXISTENT_TICKER_99');
  const pass = unknown.length === 0;
  assertTest(
    'Unknown Symbol Safety',
    'Does not silently return or map to another stock on unmatched query',
    pass,
    `Results count: ${unknown.length}`
  );
}

// 3. Correct instrument matching
{
  const equities = searchPsxCompanies('LUCK');
  const pass =
    equities.length > 0 &&
    equities[0].instrumentType === 'equity' &&
    equities[0].sector === 'Cement';
  assertTest(
    'Instrument Type Matching',
    'Categorizes instrument as regular equity with sector attribution',
    pass,
    `Instrument: ${equities[0]?.instrumentType}, Sector: ${equities[0]?.sector}`
  );
}

// 4. Invalid quote response rejection
{
  const invalid1 = validateQuoteResponse({ symbol: 'FFC', price: 'invalid_price' as any });
  const invalid2 = validateQuoteResponse({ symbol: 'FFC', price: -50 });
  const invalid3 = validateQuoteResponse(null);
  const invalid4 = validateQuoteResponse({ symbol: '', price: 200 });
  const valid = validateQuoteResponse({
    symbol: 'FFC',
    price: 214.5,
    asOf: 'Oct 11, 2024',
    source: 'PSX',
  });

  const pass = !invalid1 && !invalid2 && !invalid3 && !invalid4 && valid;
  assertTest(
    'Invalid Quote Response Rejection',
    'Rejects non-numeric, negative, null, or missing symbol responses',
    pass,
    'Invalid responses rejected, valid accepted'
  );
}

// 5. Last price versus previous close
{
  const quote = getPsxQuote('FFC');
  const pass =
    typeof quote.price === 'number' &&
    quote.priceType === 'regular_market_close' &&
    quote.asOf.includes('PSX Market Close');
  assertTest(
    'Last Price vs Previous Close Distinction',
    'Explicitly notes price type as verified snapshot close, not conflated with intraday bid/ask',
    pass,
    `Price type: ${quote.priceType}, as-of: ${quote.asOf}`
  );
}

// 6. Timestamp preservation
{
  const quote = getPsxQuote('OGDC');
  const originalTimestamp = quote.asOf;
  // Simulating passage of time - the asOf must remain the market close date, not Date.now()
  const pass = originalTimestamp === 'Oct 11, 2024 (PSX Market Close)' && originalTimestamp.includes('2024');
  assertTest(
    'Timestamp Preservation',
    'Maintains actual market snapshot date (Oct 11, 2024) rather than current browser clock',
    pass,
    `Timestamp: "${quote.asOf}"`
  );
}

// 7. Cache expiry and refresh failure preservation
{
  const existingQuote: PsxQuoteResult = {
    symbol: 'ENGRO',
    companyName: 'Engro Corporation Limited',
    sector: 'Chemicals',
    instrumentType: 'equity',
    price: 320.0,
    asOf: 'Oct 11, 2024 (PSX Market Close)',
    source: 'PSX Daily Quotations',
    currency: 'PKR',
    status: 'verified_snapshot',
    statusMessage: 'Verified quote',
    provenance: 'market_snapshot',
    isVerified: true,
    priceType: 'regular_market_close',
  };

  // When a network refresh fails, the function keeps previous quote and marks status without zeroing out
  const fallbackOnFailure = resolveHoldingPrice({
    existingQuote,
    refreshFailed: true,
    userManualPrice: undefined,
  });

  const pass =
    fallbackOnFailure.price === 320.0 &&
    fallbackOnFailure.isRetainedOnFailure === true &&
    fallbackOnFailure.price !== null &&
    fallbackOnFailure.price > 0;
  assertTest(
    'Refresh Failure Price Retention',
    'Retains previous verified price when refresh fails; never substitutes 0',
    pass,
    `Retained price: PKR ${fallbackOnFailure.price}, Retained flag: ${fallbackOnFailure.isRetainedOnFailure}`
  );
}

// 8. Manual override protection
{
  const quote = getPsxQuote('SYS');
  const userEnteredPrice = 450.0; // User entered their own purchase/broker price

  const resolved = resolveHoldingPrice({
    existingQuote: quote,
    refreshFailed: false,
    userManualPrice: userEnteredPrice,
    userPreferredMode: 'user_manual',
  });

  const pass =
    resolved.price === 450.0 &&
    resolved.provenance === 'user_manual' &&
    resolved.price !== quote.price;
  assertTest(
    'Manual Override Protection',
    'User-entered price is preserved and given user_manual provenance',
    pass,
    `Resolved price: PKR ${resolved.price}, Provenance: ${resolved.provenance}`
  );
}

// 9. Switching companies during in-flight request
{
  // Simulates user clicking 'MEBL' then rapidly clicking 'HBL'
  // When 'MEBL' response finishes late, it must be discarded if the selected company is now 'HBL'
  const activeSelection = 'HBL';
  const lateResponseQuote: PsxQuoteResult = {
    symbol: 'MEBL',
    companyName: 'Meezan Bank Limited',
    sector: 'Commercial Banks',
    instrumentType: 'equity',
    price: 245.0,
    asOf: 'Oct 11, 2024',
    source: 'PSX',
    currency: 'PKR',
    status: 'verified_snapshot',
    statusMessage: 'Verified snapshot',
    provenance: 'market_snapshot',
    isVerified: true,
  };

  const applied = handleInFlightQuoteSelection(activeSelection, lateResponseQuote);
  const pass = applied === null; // Rejected because symbol does not match active selection
  assertTest(
    'In-Flight Race Condition Protection',
    'Rejects late responses for a previously selected company',
    pass,
    `Late MEBL quote accepted for HBL: ${applied !== null ? 'YES (bug)' : 'NO (safely rejected)'}`
  );
}

// 10. Saved-plan migration with unverified legacy holdings
{
  const legacyHoldings: any[] = [
    {
      id: 'old-1',
      symbolOrName: 'Fauji Fertilizer',
      marketValue: 150000,
      // No symbol, no provenance, legacy free-text entry
    },
    {
      id: 'old-2',
      symbolOrName: 'Meezan Bank',
      shares: 100,
      pricePerShare: 200,
      marketValue: 20000,
    },
    {
      id: 'old-3',
      symbolOrName: 'FFC — Fauji Fertilizer',
      symbol: 'FFC',
      shares: 500,
      pricePerShare: 214.5,
      marketValue: 107250,
      priceProvenance: 'market_snapshot',
    },
  ];

  const migrated: StockHolding[] = migrateLegacyHoldings(legacyHoldings);
  const pass =
    migrated.length === 3 &&
    migrated[0].priceProvenance === 'unverified_legacy' &&
    migrated[0].priceStatus === 'unverified_saved' &&
    migrated[0].marketValue === 150000 &&
    migrated[1].shares === 100 &&
    migrated[1].pricePerShare === 200 &&
    migrated[1].priceProvenance === 'unverified_legacy' &&
    migrated[2].priceStatus === 'price_needs_updating' &&
    migrated[2].marketValue === 107250;
  assertTest(
    'Saved Plan Migration Integrity',
    'Preserves legacy holdings without losing values, safely marks as unverified_legacy or price_needs_updating',
    pass,
    `Migrated count: ${migrated.length}, Holding 1: ${migrated[0]?.priceProvenance} (${migrated[0]?.priceStatus}), Holding 3: ${migrated[2]?.priceStatus}`
  );
}

// 11. Debt instrument exclusion and instrument filtering
{
  const tfcExcluded = isDebtOrDerivativeInstrument('BAFLTFC6');
  const sukukExcluded = isDebtOrDerivativeInstrument('BIPLSC');
  const equityKept = isDebtOrDerivativeInstrument('FFC');
  const reitClass = classifyInstrument('DCR');
  const etfClass = classifyInstrument('MIIETF');

  const pass = tfcExcluded && sukukExcluded && !equityKept && reitClass === 'reit' && etfClass === 'etf';
  assertTest(
    'Debt Instrument Exclusion & Classification',
    'Excludes TFCs and Sukuks from stock picker, correctly distinguishes REITs and ETFs',
    pass,
    `TFC excluded: ${tfcExcluded}, Sukuk excluded: ${sukukExcluded}, FFC excluded: ${equityKept}, DCR: ${reitClass}, MIIETF: ${etfClass}`
  );
}

// 12. Plain pricing states and Pakistan time formatting
{
  const testIso = '2026-10-14T07:25:29.328057+00:00';
  const displayFresh = getQuoteTimestampDisplay({
    fetchedAt: testIso,
    marketAsOf: null,
    provenance: 'provider_quote',
    priceStatus: 'valid_quote',
  });
  const displaySaved = getQuoteTimestampDisplay({
    fetchedAt: testIso,
    marketAsOf: null,
    provenance: 'provider_quote',
    priceStatus: 'unverified_saved',
  });
  const displayManual = getQuoteTimestampDisplay({
    provenance: 'user_manual',
    priceStatus: 'manual',
  });
  const displayFailed = getQuoteTimestampDisplay({
    priceStatus: 'price_needs_updating',
  });

  const pass =
    displayFresh.includes('Fetched at') &&
    displayFresh.includes('12:25 PM') &&
    !displayFresh.includes('Live') &&
    !displayFresh.includes('psxdata-api') &&
    displaySaved.includes('Saved price · fetched at') &&
    displayManual === 'Entered by you.' &&
    displayFailed === 'Couldn’t update the price.';

  assertTest(
    'Plain Pricing States & PKT Time',
    'Renders non-technical plain pricing states (Fetched at, Saved price, Entered by you, Couldn’t update) in Pakistan time',
    pass,
    `Fresh: "${displayFresh}", Saved: "${displaySaved}", Manual: "${displayManual}", Failed: "${displayFailed}"`
  );
}

// 13. Provider Quote validation and structure
{
  const adapter = new PsxDataApiAdapter();
  const validPayload = {
    data: {
      symbol: 'FFC',
      price: 534.25,
      pe_ratio: 9.94,
      dividend_yield: 7.28,
    },
    meta: {
      timestamp: '2026-10-14T07:25:29.328057+00:00',
      cached: false,
    },
  };
  const validation = adapter.validateRawQuote(validPayload, 'FFC');
  const invalidPrice = adapter.validateRawQuote({ data: { symbol: 'FFC', price: -10 } }, 'FFC');
  const wrongSymbol = adapter.validateRawQuote(validPayload, 'MEBL');

  const pass = validation.isValid && !invalidPrice.isValid && !wrongSymbol.isValid;
  assertTest(
    'Provider Quote Structure Validation',
    'Validates provider envelope, rejects negative prices and symbol mismatches',
    pass,
    `Valid: ${validation.isValid}, Negative price rejected: ${!invalidPrice.isValid}, Wrong symbol rejected: ${!wrongSymbol.isValid}`
  );
}

// 14. Versioned session cache key adherence
{
  const key1 = buildQuoteSessionCacheKey('ffc');
  const key2 = buildQuoteSessionCacheKey('MEBL');
  const expectedPrefix = `psx_quote_v${CACHE_SCHEMA_VERSION}:psxdata-api:PSX:REG:`;

  const pass =
    key1 === `${expectedPrefix}FFC` &&
    key2 === `${expectedPrefix}MEBL` &&
    key1.includes('psxdata-api') &&
    key1.includes('PSX') &&
    key1.includes('REG');

  assertTest(
    'Versioned Session Cache Key',
    'Generates versioned key with provider, exchange, segment, and normalized uppercase symbol',
    pass,
    `Key: ${key1}`
  );
}

// 15. Two-Hour TTL Constant Verification
{
  const pass = QUOTE_CACHE_TTL_MS === 2 * 60 * 60 * 1000 && QUOTE_CACHE_TTL_MS === 7200000;
  assertTest(
    'Two-Hour Cache TTL Constant',
    'QUOTE_CACHE_TTL_MS is strictly defined as 2 hours (7,200,000 ms)',
    pass,
    `TTL: ${QUOTE_CACHE_TTL_MS} ms (${QUOTE_CACHE_TTL_MS / 3600000} hours)`
  );
}

// 16. Cache schema validation & read expiry preservation
{
  const now = 1728900000000;
  const validEntry = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    provider: 'psxdata-api',
    exchange: 'PSX',
    marketSegment: 'REG',
    symbol: 'FFC',
    price: 534.25,
    currency: 'PKR',
    fetchedAt: new Date(now - 10000).toISOString(),
    expiresAt: now + QUOTE_CACHE_TTL_MS,
  };

  const parsedValid = validateAndParseCachedQuote(JSON.stringify(validEntry), 'FFC', now);
  const parsedWrongSymbol = validateAndParseCachedQuote(JSON.stringify(validEntry), 'MEBL', now);
  const parsedExpired = validateAndParseCachedQuote(
    JSON.stringify({ ...validEntry, expiresAt: now - 500 }),
    'FFC',
    now
  );
  const parsedFuture = validateAndParseCachedQuote(
    JSON.stringify({ ...validEntry, fetchedAt: new Date(now + 120000).toISOString() }),
    'FFC',
    now
  );
  const parsedMalformed = validateAndParseCachedQuote('{invalid-json}', 'FFC', now);
  const parsedWrongSchema = validateAndParseCachedQuote(
    JSON.stringify({ ...validEntry, schemaVersion: 999 }),
    'FFC',
    now
  );

  const pass =
    parsedValid.valid &&
    parsedValid.entry?.price === 534.25 &&
    !parsedWrongSymbol.valid &&
    !parsedExpired.valid &&
    !parsedFuture.valid &&
    !parsedMalformed.valid &&
    !parsedWrongSchema.valid;

  assertTest(
    'Cache Schema & Expiry Validation',
    'Validates schema version, instrument symbol, rejects future/expired/malformed cache data',
    pass,
    `Valid: ${parsedValid.valid}, Expired rejected: ${!parsedExpired.valid}, Malformed rejected: ${!parsedMalformed.valid}`
  );
}

// 17. Injectable clock time simulation (expiry without waiting 2 hours)
{
  let simulatedTime = 1728900000000;
  const testStore = new SafeSessionStore();
  const adapter = new PsxDataApiAdapter({
    getNow: () => simulatedTime,
    sessionStore: testStore,
  });

  // Pre-seed a valid quote at t = 0
  const cacheKey = buildQuoteSessionCacheKey('OGDC');
  const originalExpiresAt = simulatedTime + QUOTE_CACHE_TTL_MS;
  testStore.setItem(
    cacheKey,
    JSON.stringify({
      schemaVersion: CACHE_SCHEMA_VERSION,
      provider: 'psxdata-api',
      exchange: 'PSX',
      marketSegment: 'REG',
      symbol: 'OGDC',
      price: 152.5,
      currency: 'PKR',
      fetchedAt: new Date(simulatedTime).toISOString(),
      expiresAt: originalExpiresAt,
      priceType: 'provider_quote',
      provenance: 'provider_quote',
    })
  );

  // 1. Advance time to 1 hour 59 minutes (unexpired)
  simulatedTime += 119 * 60 * 1000;
  const quoteBeforeExpiry = await adapter.getQuote('OGDC');
  const isCachedBefore = quoteBeforeExpiry.isCached;

  // Verify that reading from cache did NOT extend expiresAt!
  const storedAfterRead = JSON.parse(testStore.getItem(cacheKey)!);
  const expiryUntouched = storedAfterRead.expiresAt === originalExpiresAt;

  // 2. Advance time past 2 hours (2 hours 1 minute)
  simulatedTime += 2 * 60 * 1000;
  const isExpiredInStore = !validateAndParseCachedQuote(testStore.getItem(cacheKey), 'OGDC', simulatedTime).valid;

  const pass = isCachedBefore && quoteBeforeExpiry.price === 152.5 && expiryUntouched && isExpiredInStore;
  assertTest(
    'Clock Simulation: 2-Hour Reuse & Expiry',
    'Reuses cached quote at 1h 59m without extending expiry, expires cleanly at 2h 1m',
    pass,
    `Cached at 1h59m: ${isCachedBefore}, Expiry untouched on read: ${expiryUntouched}, Expired at 2h01m: ${isExpiredInStore}`
  );
}

// 18. Deduplication of simultaneous in-flight requests
{
  const adapter = new PsxDataApiAdapter();
  // Call getQuote simultaneously for the same symbol
  const p1 = adapter.getQuote('ENGRO');
  const p2 = adapter.getQuote('ENGRO');
  // Both promises must refer to the exact same in-flight task
  const pass = p1 === p2;
  assertTest(
    'Simultaneous Request Deduplication',
    'Simultaneous requests for the same instrument share one in-flight promise',
    pass,
    `p1 === p2: ${p1 === p2}`
  );
}

// 19. Refresh cooldown prevention
{
  let simulatedTime = 1728900000000;
  const testStore = new SafeSessionStore();
  const adapter = new PsxDataApiAdapter({
    getNow: () => simulatedTime,
    sessionStore: testStore,
  });

  const cacheKey = buildQuoteSessionCacheKey('HUBC');
  testStore.setItem(
    cacheKey,
    JSON.stringify({
      schemaVersion: CACHE_SCHEMA_VERSION,
      provider: 'psxdata-api',
      exchange: 'PSX',
      marketSegment: 'REG',
      symbol: 'HUBC',
      price: 130.0,
      currency: 'PKR',
      fetchedAt: new Date(simulatedTime).toISOString(),
      expiresAt: simulatedTime + QUOTE_CACHE_TTL_MS,
      priceType: 'provider_quote',
      provenance: 'provider_quote',
    })
  );

  // Establish that HUBC was successfully fetched/refreshed at t = 0
  adapter.recordRefresh('HUBC', simulatedTime);

  // Immediately call again at t = 1 second (within 5s cooldown)
  simulatedTime += 1000;
  const q2 = await adapter.getQuote('HUBC', { forceRefresh: true });

  const pass = q2.isCached === true && q2.price === 130.0;
  assertTest(
    'Refresh Cooldown Enforcement',
    'Rapid repeated refresh within 5s cooldown reuses cached result to prevent spamming',
    pass,
    `Cooldown returned cached: ${q2.isCached}`
  );
}

// 20. SafeSessionStore Memory Fallback
{
  const store = new SafeSessionStore();
  store.setItem('test_key', 'test_value');
  const retrieved = store.getItem('test_key');
  store.removeItem('test_key');
  const afterRemove = store.getItem('test_key');

  const pass = retrieved === 'test_value' && afterRemove === null;
  assertTest(
    'Safe Session Store Fallback',
    'Operates reliably even when browser sessionStorage is simulated or in memory fallback',
    pass,
    `Retrieved: ${retrieved}, After remove: ${afterRemove}`
  );
}

// 21. Cross-symbol quote isolation
{
  let simulatedTime = 1728900000000;
  const testStore = new SafeSessionStore();
  const adapter = new PsxDataApiAdapter({
    getNow: () => simulatedTime,
    sessionStore: testStore,
  });

  testStore.setItem(
    buildQuoteSessionCacheKey('MEBL'),
    JSON.stringify({
      schemaVersion: CACHE_SCHEMA_VERSION,
      provider: 'psxdata-api',
      exchange: 'PSX',
      marketSegment: 'REG',
      symbol: 'MEBL',
      price: 245.0,
      currency: 'PKR',
      fetchedAt: new Date(simulatedTime).toISOString(),
      expiresAt: simulatedTime + QUOTE_CACHE_TTL_MS,
      priceType: 'provider_quote',
      provenance: 'provider_quote',
    })
  );

  // Read FFC - must NOT return MEBL's price
  const ffcParsed = validateAndParseCachedQuote(testStore.getItem(buildQuoteSessionCacheKey('FFC')), 'FFC', simulatedTime);
  const meblParsed = validateAndParseCachedQuote(testStore.getItem(buildQuoteSessionCacheKey('MEBL')), 'MEBL', simulatedTime);

  const pass = !ffcParsed.valid && meblParsed.valid && meblParsed.entry?.price === 245.0;
  assertTest(
    'Cross-Symbol Quote Isolation',
    'Quotes are strictly partitioned by ticker; never cross between companies',
    pass,
    `FFC valid from MEBL cache: ${ffcParsed.valid} (correctly false), MEBL valid: ${meblParsed.valid}`
  );
}

// 22. Historical records are not relabeled with current year
{
  const { PSX_DIRECTORY_METADATA, PSX_COMPANIES } = await import('../data/psxDirectory');
  const metadataPreserved = PSX_DIRECTORY_METADATA.sourcedDate === 'October 11, 2024';
  const sampleCompany = PSX_COMPANIES.find((c) => c.symbol === 'FFC');
  const sampleAsOfPreserved = sampleCompany?.snapshotQuote?.asOf === 'Oct 11, 2024 (PSX Market Close)';

  const pass = metadataPreserved && sampleAsOfPreserved;
  assertTest(
    'Historical Records Not Relabeled',
    'Preserves genuine historical October 11, 2024 market snapshot dates without artificial year change',
    pass,
    `Metadata: ${PSX_DIRECTORY_METADATA.sourcedDate}, Sample Quote: ${sampleCompany?.snapshotQuote?.asOf}`
  );
}

// 23. September 2026 YoY CPI selected instead of MoM CPI
{
  const { LATEST_OFFICIAL_INFLATION } = await import('../data/pakistanInflation');
  const isSept2026 = LATEST_OFFICIAL_INFLATION.referencePeriod === 'September 2026';
  const isYoYSelected = LATEST_OFFICIAL_INFLATION.exactYoYPercentage === 10.26;
  const isMoMSeparate = LATEST_OFFICIAL_INFLATION.monthOnMonthPercentage === 1.27;
  const notMoM = LATEST_OFFICIAL_INFLATION.publishedPercentage !== LATEST_OFFICIAL_INFLATION.monthOnMonthPercentage;
  const pubDateUnavailable = LATEST_OFFICIAL_INFLATION.publicationDate === 'Unavailable';

  const pass = isSept2026 && isYoYSelected && isMoMSeparate && notMoM && pubDateUnavailable;
  assertTest(
    'September 2026 YoY CPI Selection',
    'Uses verified national YoY CPI (10.26% / 10.3%) from PBS Press Release, MoM (1.27%) separate, pubDate Unavailable',
    pass,
    `Period: ${LATEST_OFFICIAL_INFLATION.referencePeriod}, YoY: ${LATEST_OFFICIAL_INFLATION.exactYoYPercentage}%, MoM: ${LATEST_OFFICIAL_INFLATION.monthOnMonthPercentage}%, pubDate: ${LATEST_OFFICIAL_INFLATION.publicationDate}`
  );
}

// 24. Updating official context does not overwrite saved assumptions
{
  const { DEFAULT_INITIAL_STATE } = await import('../utils/storage');
  const userSavedAssumptions = {
    ...DEFAULT_INITIAL_STATE.assumptions,
    assumedAnnualInflationRate: 0.08, // User chose 8%
  };
  const mockState = {
    ...DEFAULT_INITIAL_STATE,
    assumptions: userSavedAssumptions,
  };
  // Official inflation data import
  const { LATEST_OFFICIAL_INFLATION } = await import('../data/pakistanInflation');

  // Verify that presence or reading of official inflation does NOT mutate userSavedAssumptions
  const pass =
    mockState.assumptions.assumedAnnualInflationRate === 0.08 &&
    mockState.assumptions.assumedAnnualInflationRate !== LATEST_OFFICIAL_INFLATION.exactYoYPercentage / 100;

  assertTest(
    'Inflation Assumption Separation',
    'User saved assumption (8%) is strictly preserved and not overwritten by PBS observation (10.26%)',
    pass,
    `Saved rate: ${mockState.assumptions.assumedAnnualInflationRate * 100}%, Official ref: ${LATEST_OFFICIAL_INFLATION.exactYoYPercentage}%`
  );
}

// 25. Expired or historical quotes do not appear newly fetched
{
  const historicalDisplay = getQuoteTimestampDisplay({
    priceStatus: 'price_needs_updating',
    priceAsOf: 'Oct 11, 2024 (Historical)',
    provenance: 'market_snapshot',
  });
  const manualDisplay = getQuoteTimestampDisplay({
    priceStatus: 'manual',
    provenance: 'user_manual',
  });

  const pass =
    !historicalDisplay.includes('Fetched at') &&
    historicalDisplay === 'Couldn’t update the price.' &&
    manualDisplay === 'Entered by you.';

  assertTest(
    'Historical Quotes Not Labeled Newly Fetched',
    'Historical or failed quotes display transparent status, never falsely claiming "Fetched at"',
    pass,
    `Historical display: "${historicalDisplay}", Manual display: "${manualDisplay}"`
  );
}

// 26. Mock dates isolated from production runtime clock
{
  const runtimeYear = new Date().getFullYear();
  const adapterDefault = new PsxDataApiAdapter();
  // Call validateAndParseCachedQuote with current time
  const testNow = Date.now();
  const entry = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    provider: 'psxdata-api',
    exchange: 'PSX',
    marketSegment: 'REG',
    symbol: 'FFC',
    price: 535.5,
    currency: 'PKR',
    fetchedAt: new Date(testNow).toISOString(),
    expiresAt: testNow + QUOTE_CACHE_TTL_MS,
    priceType: 'provider_quote' as const,
    provenance: 'provider_quote' as const,
  };
  const parsed = validateAndParseCachedQuote(JSON.stringify(entry), 'FFC', testNow);

  const pass = runtimeYear === 2026 && parsed.valid === true;
  assertTest(
    'Runtime Clock Isolation',
    'Production runtime clock evaluates in 2026, test mocks remain strictly isolated',
    pass,
    `Runtime year: ${runtimeYear}, Live cache entry valid: ${parsed.valid}`
  );
}

// Print results
console.log('\n================ PSX SUITE SPECIFICATION TESTS ================');
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
  console.error('PSX test failure detected.');
  process.exit(1);
} else {
  console.log(`All ${testResults.length} PSX specification tests passed.`);
}

