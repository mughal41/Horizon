import React, { useState, useRef, useEffect } from 'react';
import {
  InvestmentStatusChoice,
  StockHolding,
  TrackedWealthItem,
  NonProjectedCategory,
  HoldingEntryMode,
  HoldingPriceProvenance,
  HoldingPriceStatus,
} from '../../types/horizon';
import { formatPKR, parseCleanNumber } from '../../utils/finance';
import {
  Plus,
  Trash2,
  HelpCircle,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Search,
  ShieldCheck,
  Edit2,
  Check,
  AlertCircle,
  Info,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { MARKET_BENCHMARKS } from '../../constants/marketContext';
import {
  searchPsxCompanies,
  getPsxQuote,
  fetchPsxProviderQuote,
  getQuoteTimestampDisplay,
  formatQuoteTime,
  getPricingStateLabel,
  PSX_DIRECTORY_METADATA,
  PsxCompany,
  PsxQuoteResult,
} from '../../utils/psxService';
import { InfoModal } from '../InfoModal';

interface Step1InvestmentsTodayProps {
  investmentChoice: InvestmentStatusChoice | null;
  stockHoldings: StockHolding[];
  totalInvestmentsValue: number;
  cashAvailableToInvest: number;
  trackedWealth: TrackedWealthItem[];
  onChangeChoice: (choice: InvestmentStatusChoice) => void;
  onChangeHoldings: (holdings: StockHolding[]) => void;
  onChangeTotalValue: (val: number) => void;
  onChangeCashToInvest: (val: number) => void;
  onChangeTrackedWealth: (wealth: TrackedWealthItem[]) => void;
  onNext: () => void;
  showLakhFormat: boolean;
}

export const Step1InvestmentsToday: React.FC<Step1InvestmentsTodayProps> = ({
  investmentChoice,
  stockHoldings,
  totalInvestmentsValue,
  cashAvailableToInvest,
  trackedWealth,
  onChangeChoice,
  onChangeHoldings,
  onChangeTotalValue,
  onChangeCashToInvest,
  onChangeTrackedWealth,
  onNext,
  showLakhFormat,
}) => {
  // Holding form draft state
  const [holdingEntryMode, setHoldingEntryMode] = useState<HoldingEntryMode>('shares_and_price');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<PsxCompany | null>(null);
  const [quoteResult, setQuoteResult] = useState<PsxQuoteResult | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteFetchError, setQuoteFetchError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const activeFetchSymbolRef = useRef<string | null>(null);

  // Price choice: 'provider' (use automatic provider quote) or 'manual' (enter own price)
  const [priceChoice, setPriceChoice] = useState<'provider' | 'manual'>('provider');

  // Holding list async action state
  const [updatingHoldingId, setUpdatingHoldingId] = useState<string | null>(null);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);

  const [holdingName, setHoldingName] = useState('');
  const [holdingShares, setHoldingShares] = useState('');
  const [holdingPricePerShare, setHoldingPricePerShare] = useState('');
  const [holdingValue, setHoldingValue] = useState('');
  const [holdingError, setHoldingError] = useState<string | null>(null);

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState<{
    existing: StockHolding;
    proposedSymbol: string;
  } | null>(null);

  // Currently editing holding ID (if user clicked Edit on an existing holding)
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);

  // User feedback states
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const [lastRemoved, setLastRemoved] = useState<StockHolding | null>(null);

  // Unsaved draft modal state
  const [unsavedDraftModalOpen, setUnsavedDraftModalOpen] = useState(false);

  // Optional cash expandable state
  const [cashExpanded, setCashExpanded] = useState<boolean>(cashAvailableToInvest > 0);

  // Optional other assets modal / drawer state
  const [otherAssetsModalOpen, setOtherAssetsModalOpen] = useState(false);

  // Data provenance & why we ask modals
  const [whyWeAskOpen, setWhyWeAskOpen] = useState(false);
  const [provenanceModalOpen, setProvenanceModalOpen] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sharesInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate stocks total
  const stocksTotal =
    investmentChoice === 'stocks_detail'
      ? stockHoldings.reduce((sum, s) => sum + s.marketValue, 0)
      : investmentChoice === 'total_value'
      ? totalInvestmentsValue
      : 0;

  const startingInvestmentTotal = stocksTotal + Math.max(0, cashAvailableToInvest);

  // Validation for Continue
  const isHoldingDraftEmpty =
    holdingEntryMode === 'shares_and_price'
      ? !searchQuery.trim() && !holdingName.trim() && !holdingShares.trim() && !holdingPricePerShare.trim()
      : !holdingName.trim() && !holdingValue.trim();

  let canContinue = false;
  let validationMessage = '';

  if (investmentChoice === null) {
    canContinue = false;
    validationMessage = 'Select an option above to continue.';
  } else if (investmentChoice === 'fresh') {
    canContinue = true;
  } else if (investmentChoice === 'total_value') {
    canContinue = true;
  } else if (investmentChoice === 'stocks_detail') {
    if (stockHoldings.length > 0) {
      canContinue = true;
    } else {
      canContinue = false;
      validationMessage = 'Add at least one holding to continue, or choose “I’m starting fresh”.';
    }
  }

  // Live search results
  const searchResults = searchQuery.trim() ? searchPsxCompanies(searchQuery, { limit: 8 }) : [];

  // Handle company selection from directory
  const handleSelectCompany = async (company: PsxCompany) => {
    setSelectedCompany(company);
    setHoldingName(`${company.symbol} — ${company.name}`);
    setSearchQuery('');
    setIsSearchOpen(false);
    setHoldingError(null);
    setQuoteFetchError(null);
    setHoldingPricePerShare('');
    setIsFetchingQuote(true);
    setPriceChoice('provider');

    activeFetchSymbolRef.current = company.symbol;

    try {
      const quote = await fetchPsxProviderQuote(company.symbol);
      // Guard against race conditions if user switched company while request was in-flight
      if (activeFetchSymbolRef.current !== company.symbol) {
        return;
      }
      setIsFetchingQuote(false);
      setQuoteResult(quote);

      if (quote.status === 'valid_quote' && quote.price !== null && quote.price > 0) {
        setHoldingPricePerShare(quote.price.toString());
        setPriceChoice('provider');
        setCooldownUntil(Date.now() + 5000);
      } else {
        setPriceChoice('manual');
        setQuoteFetchError('Couldn’t update the price.');
      }
    } catch {
      if (activeFetchSymbolRef.current !== company.symbol) return;
      setIsFetchingQuote(false);
      setPriceChoice('manual');
      setQuoteFetchError('Couldn’t update the price.');
    }

    // Check for duplicate
    const existing = stockHoldings.find(
      (h) =>
        (h.symbol && h.symbol.toUpperCase() === company.symbol.toUpperCase()) ||
        h.symbolOrName.toUpperCase().includes(company.symbol.toUpperCase())
    );

    if (existing && existing.id !== editingHoldingId) {
      setDuplicateWarning({
        existing,
        proposedSymbol: company.symbol,
      });
    } else {
      setDuplicateWarning(null);
    }

    // Focus shares input next
    setTimeout(() => {
      sharesInputRef.current?.focus();
    }, 50);
  };

  // Re-fetch price in current draft form (explicit user refresh)
  const handleRefreshDraftPrice = async () => {
    if (!selectedCompany?.symbol || isFetchingQuote) return;
    if (Date.now() < cooldownUntil) return;

    setIsFetchingQuote(true);
    setQuoteFetchError(null);
    activeFetchSymbolRef.current = selectedCompany.symbol;

    try {
      const quote = await fetchPsxProviderQuote(selectedCompany.symbol, { forceRefresh: true });
      if (activeFetchSymbolRef.current !== selectedCompany.symbol) return;
      setIsFetchingQuote(false);

      if (quote.status === 'valid_quote' && quote.price !== null && quote.price > 0) {
        setQuoteResult(quote);
        setHoldingPricePerShare(quote.price.toString());
        setPriceChoice('provider');
        setCooldownUntil(Date.now() + 5000);
      } else {
        // Refresh failed: retain the previous price, never substitute zero
        setQuoteFetchError('Couldn’t update the price.');
      }
    } catch {
      if (activeFetchSymbolRef.current !== selectedCompany.symbol) return;
      setIsFetchingQuote(false);
      setQuoteFetchError('Couldn’t update the price.');
    }
  };

  // Refresh single existing holding price
  const handleUpdateHoldingPrice = async (holding: StockHolding) => {
    const symbol = holding.symbol || (holding.isVerifiedPsx ? holding.symbolOrName.split('—')[0].trim() : null);
    if (!symbol) return;

    setUpdatingHoldingId(holding.id);
    try {
      const quote = await fetchPsxProviderQuote(symbol, { forceRefresh: true });
      if (quote.status === 'valid_quote' && quote.price !== null && quote.price > 0) {
        const newShares = holding.shares || 1;
        const newMarketValue = holding.shares
          ? Math.round(holding.shares * quote.price)
          : Math.round(newShares * quote.price);

        const updated: StockHolding = {
          ...holding,
          pricePerShare: quote.price,
          marketValue: newMarketValue,
          priceProvenance: 'provider_quote',
          priceStatus: 'valid_quote',
          fetchedAt: quote.fetchedAt,
          marketAsOf: null,
          providerTimestamp: quote.providerTimestamp,
          providerSource: 'psxdata-api',
          priceAsOf: quote.statusMessage,
        };

        onChangeHoldings(stockHoldings.map((h) => (h.id === holding.id ? updated : h)));
        setRecentlyAdded(`Updated ${holding.symbolOrName} to PKR ${quote.price}`);
        setTimeout(() => setRecentlyAdded(null), 3500);
      } else {
        setRecentlyAdded(`Price unavailable for ${symbol}. Enter price manually.`);
        setTimeout(() => setRecentlyAdded(null), 3500);
      }
    } catch {
      setRecentlyAdded(`Failed to refresh quote for ${symbol}.`);
      setTimeout(() => setRecentlyAdded(null), 3500);
    } finally {
      setUpdatingHoldingId(null);
    }
  };

  // Refresh all holdings with verified symbols
  const handleUpdateAllPrices = async () => {
    setIsUpdatingAll(true);
    let updatedCount = 0;
    const newHoldings = [...stockHoldings];

    for (let i = 0; i < newHoldings.length; i++) {
      const h = newHoldings[i];
      const symbol = h.symbol || (h.isVerifiedPsx ? h.symbolOrName.split('—')[0].trim() : null);
      if (symbol) {
        try {
          const quote = await fetchPsxProviderQuote(symbol, { forceRefresh: true });
          if (quote.status === 'valid_quote' && quote.price !== null && quote.price > 0) {
            newHoldings[i] = {
              ...h,
              pricePerShare: quote.price,
              marketValue: h.shares ? Math.round(h.shares * quote.price) : h.marketValue,
              priceProvenance: 'provider_quote',
              priceStatus: 'valid_quote',
              fetchedAt: quote.fetchedAt,
              marketAsOf: null,
              providerTimestamp: quote.providerTimestamp,
              providerSource: 'psxdata-api',
              priceAsOf: quote.statusMessage,
            };
            updatedCount++;
          }
        } catch {
          // Keep previous price on failure
        }
      }
    }

    onChangeHoldings(newHoldings);
    setIsUpdatingAll(false);
    setRecentlyAdded(`Updated prices for ${updatedCount} holding${updatedCount === 1 ? '' : 's'}.`);
    setTimeout(() => setRecentlyAdded(null), 3500);
  };

  // Handle custom name entry if not found in PSX directory
  const handleSelectCustomName = (customText: string) => {
    const text = customText.trim();
    if (!text) return;
    setSelectedCompany(null);
    setQuoteResult(null);
    setHoldingName(text);
    setSearchQuery('');
    setIsSearchOpen(false);
    setPriceChoice('manual');
    setDuplicateWarning(null);
    setQuoteFetchError(null);
    setTimeout(() => {
      sharesInputRef.current?.focus();
    }, 50);
  };

  // Reset holding form draft
  const resetFormDraft = () => {
    activeFetchSymbolRef.current = null;
    setSelectedCompany(null);
    setQuoteResult(null);
    setSearchQuery('');
    setIsSearchOpen(false);
    setHoldingName('');
    setHoldingShares('');
    setHoldingPricePerShare('');
    setHoldingValue('');
    setHoldingError(null);
    setQuoteFetchError(null);
    setIsFetchingQuote(false);
    setPriceChoice('provider');
    setDuplicateWarning(null);
    setEditingHoldingId(null);
  };

  // Load existing holding for editing
  const handleStartEditHolding = (holding: StockHolding) => {
    setEditingHoldingId(holding.id);
    setHoldingName(holding.symbolOrName);

    if (holding.entryMode === 'total_value') {
      setHoldingEntryMode('total_value');
      setHoldingValue(holding.marketValue.toString());
      setSelectedCompany(null);
      setQuoteResult(null);
      setPriceChoice('manual');
    } else {
      setHoldingEntryMode('shares_and_price');
      setHoldingShares(holding.shares ? holding.shares.toString() : '');
      setHoldingPricePerShare(holding.pricePerShare ? holding.pricePerShare.toString() : '');

      if (holding.symbol) {
        const matching = searchPsxCompanies(holding.symbol);
        const comp = matching.find((c) => c.symbol.toUpperCase() === holding.symbol?.toUpperCase());
        if (comp) {
          setSelectedCompany(comp);
          setPriceChoice(holding.priceProvenance === 'provider_quote' ? 'provider' : 'manual');
        } else {
          setSelectedCompany(null);
          setQuoteResult(null);
          setPriceChoice('manual');
        }
      } else {
        setSelectedCompany(null);
        setQuoteResult(null);
        setPriceChoice('manual');
      }
    }

    setDuplicateWarning(null);
    setHoldingError(null);
    setQuoteFetchError(null);
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Handle Add or Update Holding
  const handleAddHolding = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHoldingError(null);

    const name = holdingName.trim();
    if (!name) {
      setHoldingError('Search and select a PSX company or enter a name.');
      searchInputRef.current?.focus();
      return false;
    }

    let val = 0;
    let sharesNum: number | undefined;
    let priceNum: number | undefined;
    let provenance: HoldingPriceProvenance = 'user_manual';
    let status: HoldingPriceStatus = 'manual';
    let asOfDate: string | undefined = undefined;

    if (holdingEntryMode === 'shares_and_price') {
      sharesNum = parseCleanNumber(holdingShares);
      if (!sharesNum || sharesNum <= 0) {
        setHoldingError('Enter the number of shares owned.');
        sharesInputRef.current?.focus();
        return false;
      }

      priceNum = parseCleanNumber(holdingPricePerShare);
      if (!priceNum || priceNum <= 0) {
        setHoldingError('Enter a valid price per share in PKR.');
        priceInputRef.current?.focus();
        return false;
      }

      val = Math.round(sharesNum * priceNum);

      if (
        selectedCompany &&
        quoteResult &&
        quoteResult.status === 'valid_quote' &&
        priceChoice === 'provider' &&
        quoteResult.price === priceNum
      ) {
        provenance = 'provider_quote';
        status = 'valid_quote';
        asOfDate = quoteResult.statusMessage;
      } else {
        provenance = 'user_manual';
        status = 'manual';
      }
    } else {
      val = parseCleanNumber(holdingValue);
      if (!val || val <= 0) {
        setHoldingError('Enter a valid current holding value in PKR.');
        return false;
      }
      provenance = 'user_manual';
      status = 'manual';
    }

    const holdingToSave: StockHolding = {
      id: editingHoldingId || `holding-${Date.now()}`,
      symbolOrName: name,
      symbol: selectedCompany?.symbol,
      companyName: selectedCompany?.name,
      sector: selectedCompany?.sector,
      instrumentType: selectedCompany?.instrumentType || 'equity',
      isVerifiedPsx: Boolean(selectedCompany),
      entryMode: holdingEntryMode,
      shares: sharesNum,
      pricePerShare: priceNum,
      marketValue: val,
      priceProvenance: provenance,
      priceStatus: status,
      priceAsOf: asOfDate,
      fetchedAt: quoteResult?.fetchedAt,
      marketAsOf: quoteResult?.marketAsOf ?? null,
      providerTimestamp: quoteResult?.providerTimestamp,
      providerSource: quoteResult?.providerSource,
    };

    if (editingHoldingId) {
      // Update existing
      onChangeHoldings(
        stockHoldings.map((h) => (h.id === editingHoldingId ? holdingToSave : h))
      );
      setRecentlyAdded(`Updated ${name}`);
    } else {
      // Add new
      onChangeHoldings([...stockHoldings, holdingToSave]);
      setRecentlyAdded(`Added ${name}`);
    }

    resetFormDraft();

    setTimeout(() => {
      setRecentlyAdded(null);
    }, 3500);

    return true;
  };

  // Handle Remove Holding with Undo
  const handleRemoveHolding = (id: string) => {
    const target = stockHoldings.find((s) => s.id === id);
    if (target) {
      setLastRemoved(target);
      onChangeHoldings(stockHoldings.filter((s) => s.id !== id));
      if (editingHoldingId === id) {
        resetFormDraft();
      }
      setTimeout(() => {
        setLastRemoved((current) => (current?.id === target.id ? null : current));
      }, 5000);
    }
  };

  const handleUndoRemove = () => {
    if (lastRemoved) {
      onChangeHoldings([...stockHoldings, lastRemoved]);
      setLastRemoved(null);
    }
  };

  // Interceptor for Continue with unsaved draft
  const handleContinueClick = () => {
    if (investmentChoice === 'stocks_detail' && !isHoldingDraftEmpty) {
      setUnsavedDraftModalOpen(true);
      return;
    }
    onNext();
  };

  const handleSaveDraftAndContinue = () => {
    const success = handleAddHolding();
    if (success) {
      setUnsavedDraftModalOpen(false);
      onNext();
    }
  };

  const handleDiscardDraftAndContinue = () => {
    resetFormDraft();
    setUnsavedDraftModalOpen(false);
    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Question Headline */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#172522]">
            Do you already have investments?
          </h1>
          <button
            type="button"
            onClick={() => setWhyWeAskOpen(true)}
            className="shrink-0 text-xs text-[#176B52] hover:text-[#11543F] font-semibold inline-flex items-center gap-1 min-h-[44px] py-2 px-1 focus-visible:ring-2 focus-visible:ring-[#176B52] rounded-md"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Why we ask</span>
          </button>
        </div>
        <p className="mt-1 text-sm text-[#52635D] leading-relaxed">
          Start with your existing portfolio, or begin fresh with regular monthly contributions.
        </p>
      </div>

      {/* Choice Radio Group */}
      <div
        role="radiogroup"
        aria-label="Do you already have investments?"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        {/* Choice 1: Add my stocks */}
        <button
          type="button"
          role="radio"
          aria-checked={investmentChoice === 'stocks_detail'}
          onClick={() => onChangeChoice('stocks_detail')}
          className={`p-4 text-left rounded-xl border transition-all flex flex-col justify-between min-h-[88px] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#176B52] ${
            investmentChoice === 'stocks_detail'
              ? 'bg-[#EAF4EF] border-[#176B52] shadow-xs'
              : 'bg-[#FFFFFF] border-[#D5DFDA] hover:border-[#B8C7C0]'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-base font-bold text-[#172522]">
              Add my stocks
            </span>
            <span
              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                investmentChoice === 'stocks_detail'
                  ? 'border-[#176B52] bg-[#176B52]'
                  : 'border-[#D5DFDA] bg-white'
              }`}
            >
              {investmentChoice === 'stocks_detail' && (
                <span className="w-2 h-2 rounded-full bg-white" />
              )}
            </span>
          </div>
          <span className="text-xs text-[#52635D] mt-1.5 leading-snug">
            PSX company search and verified stock prices.
          </span>
        </button>

        {/* Choice 2: Enter a total */}
        <button
          type="button"
          role="radio"
          aria-checked={investmentChoice === 'total_value'}
          onClick={() => onChangeChoice('total_value')}
          className={`p-4 text-left rounded-xl border transition-all flex flex-col justify-between min-h-[88px] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#176B52] ${
            investmentChoice === 'total_value'
              ? 'bg-[#EAF4EF] border-[#176B52] shadow-xs'
              : 'bg-[#FFFFFF] border-[#D5DFDA] hover:border-[#B8C7C0]'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-base font-bold text-[#172522]">
              Enter a total
            </span>
            <span
              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                investmentChoice === 'total_value'
                  ? 'border-[#176B52] bg-[#176B52]'
                  : 'border-[#D5DFDA] bg-white'
              }`}
            >
              {investmentChoice === 'total_value' && (
                <span className="w-2 h-2 rounded-full bg-white" />
              )}
            </span>
          </div>
          <span className="text-xs text-[#52635D] mt-1.5 leading-snug">
            Enter a single total estimate in PKR.
          </span>
        </button>

        {/* Choice 3: I'm starting fresh */}
        <button
          type="button"
          role="radio"
          aria-checked={investmentChoice === 'fresh'}
          onClick={() => onChangeChoice('fresh')}
          className={`p-4 text-left rounded-xl border transition-all flex flex-col justify-between min-h-[88px] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#176B52] ${
            investmentChoice === 'fresh'
              ? 'bg-[#EAF4EF] border-[#176B52] shadow-xs'
              : 'bg-[#FFFFFF] border-[#D5DFDA] hover:border-[#B8C7C0]'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-base font-bold text-[#172522]">
              I’m starting fresh
            </span>
            <span
              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                investmentChoice === 'fresh'
                  ? 'border-[#176B52] bg-[#176B52]'
                  : 'border-[#D5DFDA] bg-white'
              }`}
            >
              {investmentChoice === 'fresh' && (
                <span className="w-2 h-2 rounded-full bg-white" />
              )}
            </span>
          </div>
          <span className="text-xs text-[#52635D] mt-1.5 leading-snug">
            Begin with Rs. 0 invested today.
          </span>
        </button>
      </div>

      {/* Choice 1 Section: Add my stocks (PSX Search & Provenance) */}
      {investmentChoice === 'stocks_detail' && (
        <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
          {/* Header row */}
          <div className="border-b border-[#D5DFDA] pb-3">
            <h2 className="text-base font-bold text-[#172522]">Your stock holdings</h2>
            <p className="text-xs text-[#52635D] mt-0.5">
              Search verified PSX regular-market companies or enter custom holdings.
            </p>
          </div>

          {/* Toast: Recently added */}
          {recentlyAdded && (
            <div className="p-3 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl text-xs font-semibold text-[#176B52] flex items-center justify-between animate-in fade-in duration-150">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                {recentlyAdded}
              </span>
            </div>
          )}

          {/* Toast: Undo removed */}
          {lastRemoved && (
            <div className="p-3 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs text-[#172522] flex items-center justify-between animate-in fade-in duration-150">
              <span>Removed {lastRemoved.symbolOrName}.</span>
              <button
                type="button"
                onClick={handleUndoRemove}
                className="font-bold text-[#176B52] hover:underline inline-flex items-center gap-1 min-h-[36px] px-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
            </div>
          )}

          {/* Holdings List */}
          {stockHoldings.length > 0 ? (
            <div className="space-y-3">
              {/* Review Banner if any holding needs price updating */}
              {stockHoldings.some(
                (h) => h.priceStatus === 'price_needs_updating' || h.priceStatus === 'unverified_saved'
              ) && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-900 block">
                          Portfolio valuation needs price review
                        </span>
                        <span className="text-amber-800 leading-relaxed block mt-0.5">
                          Holdings using historical 2024 snapshots or unverified saved prices need updating. Tap “Update price” on each holding or update all to fetch current quotes.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleUpdateAllPrices}
                      disabled={isUpdatingAll}
                      className="shrink-0 self-start sm:self-center px-3 py-1.5 bg-[#176B52] hover:bg-[#11543F] text-white font-semibold rounded-lg text-xs inline-flex items-center gap-1.5 min-h-[36px] disabled:opacity-50 transition-colors"
                    >
                      {isUpdatingAll ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Update all prices</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-[#52635D] px-1">
                <span>Holdings ({stockHoldings.length})</span>
                <span>Total: {formatPKR(stocksTotal, { useLakhFormat: showLakhFormat })}</span>
              </div>
              <div className="divide-y divide-[#D5DFDA] border border-[#D5DFDA] rounded-xl overflow-hidden bg-white">
                {stockHoldings.map((stock) => (
                  <div key={stock.id} className="p-3.5 flex items-start sm:items-center justify-between gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-[#172522] break-words">
                          {stock.symbolOrName}
                        </span>
                        {stock.isVerifiedPsx && (
                          <span className="px-1.5 py-0.5 bg-[#EAF4EF] text-[#176B52] text-[10px] font-bold rounded">
                            PSX Equity
                          </span>
                        )}
                        {stock.sector && (
                          <span className="text-[11px] text-[#52635D] hidden sm:inline">
                            · {stock.sector}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#52635D]">
                        {stock.shares && stock.pricePerShare ? (
                          <span>
                            {stock.shares.toLocaleString()} shares @ Rs. {stock.pricePerShare.toLocaleString()}
                          </span>
                        ) : stock.shares ? (
                          <span>{stock.shares.toLocaleString()} shares</span>
                        ) : (
                          <span>Manual position valuation</span>
                        )}

                        {/* Plain pricing state */}
                        {stock.priceProvenance === 'user_manual' || stock.entryMode === 'total_value' ? (
                          <span className="text-[11px] text-[#52635D]">
                            Entered by you.
                          </span>
                        ) : stock.priceStatus === 'price_needs_updating' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-medium">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            Couldn’t update the price.
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#52635D]">
                            {getPricingStateLabel({
                              fetchedAt: stock.fetchedAt,
                              isSavedPrice: stock.priceStatus === 'unverified_saved' || Boolean(stock.priceAsOf && !stock.fetchedAt),
                            })}
                          </span>
                        )}

                        {/* Inline Update Price button for holding if linked to PSX */}
                        {(stock.symbol || stock.isVerifiedPsx) && (
                          <button
                            type="button"
                            onClick={() => handleUpdateHoldingPrice(stock)}
                            disabled={updatingHoldingId === stock.id}
                            className="text-[11px] text-[#176B52] hover:underline font-semibold inline-flex items-center gap-1 min-h-[32px] px-1 disabled:opacity-50"
                          >
                            {updatingHoldingId === stock.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-[#176B52]" />
                            ) : (
                              <RefreshCw className="w-3 h-3 text-[#176B52]" />
                            )}
                            <span>Update price</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-[#172522] tabular-nums text-sm">
                        {formatPKR(stock.marketValue, { useLakhFormat: showLakhFormat })}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartEditHolding(stock)}
                        className="min-h-[44px] min-w-[36px] px-1.5 flex items-center justify-center text-[#52635D] hover:text-[#176B52] transition-colors rounded-lg focus-visible:ring-2 focus-visible:ring-[#176B52]"
                        aria-label={`Edit ${stock.symbolOrName}`}
                        title="Edit holding"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveHolding(stock.id)}
                        className="min-h-[44px] min-w-[36px] px-1.5 flex items-center justify-center text-[#52635D] hover:text-rose-700 transition-colors rounded-lg focus-visible:ring-2 focus-visible:ring-rose-600"
                        aria-label={`Remove ${stock.symbolOrName}`}
                        title="Remove holding"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[#F8FAF9] border border-dashed border-[#D5DFDA] rounded-xl text-center text-xs text-[#52635D]">
              No holdings added yet. Search for a PSX company below to record your shares.
            </div>
          )}

          {/* Holding Form Container */}
          <div className="p-4 sm:p-5 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#D5DFDA] pb-2.5">
              <span className="text-xs font-bold text-[#172522] uppercase tracking-wider">
                {editingHoldingId ? 'Edit holding' : 'Add a holding'}
              </span>
              {editingHoldingId && (
                <button
                  type="button"
                  onClick={resetFormDraft}
                  className="text-xs text-[#52635D] hover:text-[#172522] underline min-h-[36px] px-1"
                >
                  Cancel editing
                </button>
              )}
            </div>

            {/* 1. Entry Method Toggle */}
            <div>
              <label className="text-xs font-semibold text-[#172522] block mb-1.5">
                How would you like to enter this holding?
              </label>
              <div
                role="radiogroup"
                aria-label="How would you like to enter this holding?"
                className="grid grid-cols-2 gap-2"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={holdingEntryMode === 'shares_and_price'}
                  onClick={() => {
                    setHoldingEntryMode('shares_and_price');
                    if (holdingError) setHoldingError(null);
                  }}
                  className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                    holdingEntryMode === 'shares_and_price'
                      ? 'bg-[#EAF4EF] border-[#176B52] text-[#176B52]'
                      : 'bg-white border-[#D5DFDA] text-[#52635D] hover:border-[#B8C7C0]'
                  }`}
                >
                  Shares and price
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={holdingEntryMode === 'total_value'}
                  onClick={() => {
                    setHoldingEntryMode('total_value');
                    if (holdingError) setHoldingError(null);
                  }}
                  className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                    holdingEntryMode === 'total_value'
                      ? 'bg-[#EAF4EF] border-[#176B52] text-[#176B52]'
                      : 'bg-white border-[#D5DFDA] text-[#52635D] hover:border-[#B8C7C0]'
                  }`}
                >
                  Total value
                </button>
              </div>
            </div>

            {/* 2. Company Search or Selected Company */}
            <div ref={searchContainerRef} className="space-y-2">
              <label htmlFor="company-search-input" className="text-xs font-semibold text-[#172522] block">
                Company or stock symbol <span className="text-rose-600">*</span>
              </label>

              {/* Selected company card: Symbol, Name, concise secondary info, clear Change action */}
              {selectedCompany ? (
                <div className="p-3 bg-white border border-[#176B52] rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-[#176B52] text-white font-bold text-xs rounded">
                        {selectedCompany.symbol}
                      </span>
                      <span className="font-bold text-sm text-[#172522] truncate">
                        {selectedCompany.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#52635D] mt-0.5">
                      <span>{selectedCompany.sector}</span>
                      {selectedCompany.isKse100 && <span> · KSE-100</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCompany(null);
                      setQuoteResult(null);
                      setHoldingName('');
                      setSearchQuery('');
                      setHoldingPricePerShare('');
                      setQuoteFetchError(null);
                      setDuplicateWarning(null);
                      setTimeout(() => searchInputRef.current?.focus(), 50);
                    }}
                    className="text-xs font-semibold text-[#176B52] hover:underline min-h-[44px] px-2 shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                /* Search input with live drop-down */
                <div className="relative">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#52635D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      id="company-search-input"
                      type="text"
                      placeholder="Search symbol or name (e.g. FFC, MEBL, Fauji, Meezan, Systems)"
                      value={searchQuery || holdingName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchQuery(val);
                        setHoldingName(val);
                        setIsSearchOpen(true);
                        if (holdingError) setHoldingError(null);
                      }}
                      onFocus={() => {
                        if (searchQuery.trim()) setIsSearchOpen(true);
                      }}
                      className="w-full h-11 pl-10 pr-9 text-sm bg-white border border-[#D5DFDA] rounded-xl text-[#172522] placeholder:text-[#52635D]/60 focus-visible:ring-2 focus-visible:ring-[#176B52]"
                      autoComplete="off"
                    />
                    {(searchQuery || holdingName) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setHoldingName('');
                          setIsSearchOpen(false);
                          searchInputRef.current?.focus();
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#52635D] hover:text-[#172522] p-1"
                        aria-label="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Directory note */}
                  <span className="text-[11px] text-[#52635D] block mt-1">
                    Directory sourced from PSX Regular Equities (110+ vetted companies).
                  </span>

                  {/* Dropdown Results */}
                  {isSearchOpen && searchQuery.trim().length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#D5DFDA] rounded-xl shadow-lg max-h-64 overflow-y-auto divide-y divide-[#D5DFDA]">
                      {searchResults.length > 0 ? (
                        searchResults.map((company) => (
                          <button
                            key={company.symbol}
                            type="button"
                            onClick={() => handleSelectCompany(company)}
                            className="w-full p-3 text-left hover:bg-[#EAF4EF] flex items-center justify-between gap-3 text-xs transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#176B52] bg-[#EAF4EF] px-1.5 py-0.5 rounded">
                                  {company.symbol}
                                </span>
                                <span className="font-semibold text-[#172522] truncate">
                                  {company.name}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#52635D] mt-0.5 flex items-center gap-1.5">
                                <span>{company.sector}</span>
                                {company.isKse100 && <span>· KSE-100</span>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[11px] text-[#176B52] font-semibold bg-[#EAF4EF] px-2 py-0.5 rounded">
                                Select
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-3.5 text-xs text-[#52635D] space-y-2">
                          <p>No verified PSX equity matched “{searchQuery}”.</p>
                          <button
                            type="button"
                            onClick={() => handleSelectCustomName(searchQuery)}
                            className="w-full py-2 px-3 bg-[#EAF4EF] hover:bg-[#dbeee5] text-[#176B52] font-semibold rounded-lg text-left transition-colors min-h-[36px]"
                          >
                            Use “{searchQuery}” with manual pricing
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Duplicate Holding Notification */}
            {duplicateWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2 animate-in fade-in duration-150">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-900 block">
                      You already have {duplicateWarning.proposedSymbol || duplicateWarning.existing.symbol || duplicateWarning.existing.symbolOrName} in your holdings
                    </span>
                    <span className="text-amber-800">
                      Current: {duplicateWarning.existing.shares?.toLocaleString() || 0} shares (
                      {formatPKR(duplicateWarning.existing.marketValue, { useLakhFormat: showLakhFormat })})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleStartEditHolding(duplicateWarning.existing);
                    }}
                    className="px-3 py-1.5 bg-[#176B52] text-white font-semibold rounded-lg min-h-[36px]"
                  >
                    Update existing holding
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(null)}
                    className="px-3 py-1.5 bg-white border border-[#D5DFDA] text-[#52635D] font-semibold rounded-lg min-h-[36px]"
                  >
                    Keep as separate entry
                  </button>
                </div>
              </div>
            )}

            {/* 3. Number of Shares and Current Price */}
            {holdingEntryMode === 'shares_and_price' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  {/* Shares Column */}
                  <div>
                    <label htmlFor="holding-shares-input" className="text-xs font-semibold text-[#172522] block mb-1">
                      Number of shares <span className="text-rose-600">*</span>
                    </label>
                    <input
                      ref={sharesInputRef}
                      id="holding-shares-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 500"
                      value={holdingShares}
                      onChange={(e) => {
                        setHoldingShares(e.target.value);
                        if (holdingError) setHoldingError(null);
                      }}
                      className="w-full h-11 px-3.5 text-base bg-white border border-[#D5DFDA] rounded-xl font-semibold tabular-nums text-[#172522] placeholder:text-[#52635D]/60 focus-visible:ring-2 focus-visible:ring-[#176B52]"
                    />
                  </div>

                  {/* Price Column */}
                  <div>
                    <label htmlFor="holding-price-input" className="text-xs font-semibold text-[#172522] block mb-1">
                      Current price per share (PKR) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#52635D] select-none pointer-events-none">
                        Rs.
                      </span>
                      <input
                        ref={priceInputRef}
                        id="holding-price-input"
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 534.25"
                        value={holdingPricePerShare}
                        onChange={(e) => {
                          setHoldingPricePerShare(e.target.value);
                          setPriceChoice('manual');
                          setQuoteFetchError(null);
                          if (holdingError) setHoldingError(null);
                        }}
                        className="w-full h-11 pl-11 pr-3.5 text-base bg-white border border-[#D5DFDA] rounded-xl font-semibold tabular-nums text-[#172522] placeholder:text-[#52635D]/60 focus-visible:ring-2 focus-visible:ring-[#176B52]"
                      />
                    </div>

                    {/* Price state label & secondary actions */}
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-[#52635D]">
                      {isFetchingQuote ? (
                        <span className="inline-flex items-center gap-1.5 text-[#176B52] font-medium">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Updating price...
                        </span>
                      ) : quoteFetchError ? (
                        <span className="text-rose-700 font-medium">
                          Couldn’t update the price.
                        </span>
                      ) : (
                        <span>
                          {priceChoice === 'manual'
                            ? holdingPricePerShare.trim()
                              ? 'Entered by you.'
                              : ''
                            : quoteResult?.fetchedAt
                            ? getPricingStateLabel({
                                fetchedAt: quoteResult.fetchedAt,
                                isSavedPrice: quoteResult.isCached || quoteResult.status === 'verified_snapshot',
                              })
                            : holdingPricePerShare.trim()
                            ? 'Entered by you.'
                            : ''}
                        </span>
                      )}

                      {/* Secondary actions near price */}
                      <div className="inline-flex items-center gap-2">
                        {selectedCompany && (
                          <button
                            type="button"
                            onClick={handleRefreshDraftPrice}
                            disabled={isFetchingQuote || Date.now() < cooldownUntil}
                            className="text-[#176B52] hover:text-[#11543F] font-semibold inline-flex items-center gap-1 min-h-[28px] disabled:opacity-40 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Update price</span>
                          </button>
                        )}
                        {priceChoice !== 'manual' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPriceChoice('manual');
                              setTimeout(() => priceInputRef.current?.focus(), 50);
                            }}
                            className="text-[#52635D] hover:text-[#172522] underline min-h-[28px]"
                          >
                            Enter manually
                          </button>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] text-[#52635D] block mt-1">
                      Use the latest price shown in your brokerage app, not what you originally paid.
                    </span>
                  </div>
                </div>

                {/* 4. Calculated Holding Value Preview (Compact PKR amount) */}
                {parseCleanNumber(holdingShares) > 0 && parseCleanNumber(holdingPricePerShare) > 0 && (
                  <div className="p-3 bg-white border border-[#D5DFDA] rounded-xl flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-[#52635D] font-medium">Holding value:</span>
                    <span className="font-bold text-[#172522] tabular-nums text-sm sm:text-base">
                      PKR {Math.round(parseCleanNumber(holdingShares) * parseCleanNumber(holdingPricePerShare)).toLocaleString('en-US')}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Total value mode: no invented shares or prices */
              <div className="space-y-3">
                <div>
                  <label htmlFor="holding-value-input" className="text-xs font-semibold text-[#172522] block mb-1">
                    Current holding value in PKR <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#52635D] select-none pointer-events-none">
                      Rs.
                    </span>
                    <input
                      id="holding-value-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 150,000"
                      value={holdingValue}
                      onChange={(e) => {
                        setHoldingValue(e.target.value);
                        if (holdingError) setHoldingError(null);
                      }}
                      className="w-full h-11 pl-11 pr-3.5 text-base bg-white border border-[#D5DFDA] rounded-xl font-semibold tabular-nums text-[#172522] placeholder:text-[#52635D]/60 focus-visible:ring-2 focus-visible:ring-[#176B52]"
                    />
                  </div>
                  <span className="text-[11px] text-[#52635D] mt-1 block">
                    Records the total value directly without requiring share counts or calculating unit prices.
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {holdingError && (
              <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
                {holdingError}
              </p>
            )}

            {/* 5. Add Holding Action Button & Validation Feedback */}
            {(() => {
              const sharesNum = parseCleanNumber(holdingShares);
              const priceNum = parseCleanNumber(holdingPricePerShare);
              const valNum = parseCleanNumber(holdingValue);
              const isValid =
                holdingEntryMode === 'shares_and_price'
                  ? Boolean((selectedCompany || holdingName.trim()) && sharesNum > 0 && priceNum > 0)
                  : Boolean(holdingName.trim() && valNum > 0);

              const validationHint = !isValid
                ? holdingEntryMode === 'shares_and_price'
                  ? !selectedCompany && !holdingName.trim()
                    ? 'Search and select a company above.'
                    : !holdingShares.trim() || sharesNum <= 0
                    ? 'Enter the number of shares owned.'
                    : !holdingPricePerShare.trim() || priceNum <= 0
                    ? 'Enter the current price per share.'
                    : null
                  : !holdingName.trim()
                  ? 'Search or enter a company name.'
                  : !holdingValue.trim() || valNum <= 0
                  ? 'Enter the current holding value.'
                  : null
                : null;

              return (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleAddHolding}
                      disabled={!isValid}
                      className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-[#176B52] hover:bg-[#11543F] text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#176B52] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{editingHoldingId ? 'Update holding' : 'Add holding'}</span>
                    </button>
                    {editingHoldingId && (
                      <button
                        type="button"
                        onClick={resetFormDraft}
                        className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-white border border-[#D5DFDA] text-[#52635D] text-sm font-semibold rounded-xl hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {validationHint && (
                    <span className="text-[11px] text-[#52635D] block">
                      {validationHint}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Choice 2 Section: Enter a total */}
      {investmentChoice === 'total_value' && (
        <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
          <label htmlFor="total-investment-value" className="text-sm font-bold text-[#172522] block">
            Current investment value (PKR)
          </label>
          <p className="text-xs text-[#52635D] leading-relaxed">
            Enter the combined current market value of your shares, mutual fund units, or certificates.
          </p>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-semibold text-[#52635D] select-none pointer-events-none">
              Rs.
            </span>
            <input
              id="total-investment-value"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={totalInvestmentsValue ? totalInvestmentsValue.toLocaleString('en-US') : ''}
              onChange={(e) => onChangeTotalValue(parseCleanNumber(e.target.value))}
              className="w-full h-12 pl-12 pr-4 bg-white border border-[#D5DFDA] rounded-xl text-base font-semibold tabular-nums text-[#172522] focus-visible:ring-2 focus-visible:ring-[#176B52]"
            />
          </div>
        </div>
      )}

      {/* Choice 3 Section: Starting fresh */}
      {investmentChoice === 'fresh' && (
        <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-4 sm:p-5 text-sm text-[#52635D] leading-relaxed">
          <span className="font-semibold text-[#172522] block mb-0.5">
            Starting fresh with Rs. 0 invested today
          </span>
          Your future portfolio will grow through your regular monthly contributions.
        </div>
      )}

      {/* Optional Expandable: Add cash to invest now? */}
      {investmentChoice !== null && (
        <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="expand-cash-toggle"
              className="text-sm font-bold text-[#172522] cursor-pointer flex items-center gap-2.5"
            >
              <input
                id="expand-cash-toggle"
                type="checkbox"
                checked={cashExpanded}
                onChange={(e) => {
                  setCashExpanded(e.target.checked);
                  if (!e.target.checked) onChangeCashToInvest(0);
                }}
                className="w-4 h-4 rounded text-[#176B52] accent-[#176B52] focus-visible:ring-2 focus-visible:ring-[#176B52]"
              />
              <span>Add cash to invest now?</span>
            </label>
            <span className="text-xs text-[#52635D]">Optional lump sum</span>
          </div>

          {cashExpanded && (
            <div className="pt-2 border-t border-[#D5DFDA] space-y-2">
              <label htmlFor="cash-to-invest-input" className="text-xs font-semibold text-[#172522] block">
                Cash to invest immediately (PKR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#52635D] select-none pointer-events-none">
                  Rs.
                </span>
                <input
                  id="cash-to-invest-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={cashAvailableToInvest ? cashAvailableToInvest.toLocaleString('en-US') : ''}
                  onChange={(e) => onChangeCashToInvest(parseCleanNumber(e.target.value))}
                  className="w-full h-11 pl-11 pr-3.5 bg-white border border-[#D5DFDA] rounded-xl text-base font-semibold tabular-nums text-[#172522] focus-visible:ring-2 focus-visible:ring-[#176B52]"
                />
              </div>
              <p className="text-[11px] text-[#52635D] leading-snug">
                Only enter cash you intend to invest right away. Keep your emergency safety reserve separate.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Starting Investment Total Banner */}
      {investmentChoice !== null && (
        <div className="p-3.5 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl flex items-center justify-between">
          <span className="text-xs font-semibold text-[#172522]">
            Starting investment:
          </span>
          <span className="text-base font-bold text-[#176B52] tabular-nums">
            {formatPKR(startingInvestmentTotal, { useLakhFormat: showLakhFormat })}
          </span>
        </div>
      )}

      {/* Primary Action Button */}
      <div className="pt-2 space-y-2">
        <button
          type="button"
          onClick={handleContinueClick}
          disabled={!canContinue}
          className={`w-full min-h-[48px] px-6 py-3 rounded-xl font-bold text-sm sm:text-base transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#176B52] ${
            canContinue
              ? 'bg-[#176B52] hover:bg-[#11543F] text-white cursor-pointer shadow-xs'
              : 'bg-[#D5DFDA] text-[#52635D] cursor-not-allowed opacity-70'
          }`}
        >
          <span>Set my monthly amount</span>
        </button>

        {!canContinue && validationMessage && (
          <p className="text-xs text-rose-700 text-center font-medium mt-1">
            {validationMessage}
          </p>
        )}
      </div>

      {/* Non-Invested Wealth Drawer Link */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setOtherAssetsModalOpen(true)}
          className="text-xs font-semibold text-[#176B52] hover:underline min-h-[44px] py-2 px-3 inline-flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#176B52] rounded-md"
        >
          <span>Track other wealth (Gold, Property, Kameti)</span>
          {trackedWealth.length > 0 && (
            <span className="px-1.5 py-0.2 bg-[#EAF4EF] text-[#176B52] rounded-full text-[10px] font-bold">
              {trackedWealth.length}
            </span>
          )}
        </button>
      </div>

      {/* Modal: PSX Data Provenance & Methodology */}
      <InfoModal
        isOpen={provenanceModalOpen}
        onClose={() => setProvenanceModalOpen(false)}
        title="PSX Company Directory & Quote Methodology"
      >
        <div className="space-y-4 text-xs text-[#52635D] leading-relaxed">
          <div>
            <h4 className="font-bold text-[#172522] text-sm mb-1">Company Directory Sourcing & Limitations</h4>
            <p>
              The directory is sourced from official Pakistan Stock Exchange (PSX) Daily Quotations (as of {PSX_DIRECTORY_METADATA.sourcedDate}), including {PSX_DIRECTORY_METADATA.totalEquities} regular-market equities and KSE-100 benchmark constituents.
            </p>
            <p className="mt-1">
              <strong>Limitations:</strong> Debt instruments (TFCs, Sukuks) and deliverable futures are excluded from the stock picker. Unlisted companies or mutual funds can be recorded manually with unverified identity.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#172522] text-sm mb-1">Automated Quote Provider (psxdata-api)</h4>
            <p>
              Automatic quotes are fetched directly from the tested open-source community service <code>psxdata-api</code> (FastAPI, MIT License; <code>https://psxdata-api.fastapicloud.dev</code>).
            </p>
            <p className="mt-1">
              <strong>Redistribution Terms:</strong> Technical browser access is open and unauthenticated with CORS enabled. Pakistan Stock Exchange does not officially certify third-party endpoints or grant public redistribution licenses.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#172522] text-sm mb-1">Timestamp & Valuation Integrity</h4>
            <p>
              The provider returns server execution timestamps, not verified trading trade execution times. Prices are clearly labeled as <em>“Fetched at [time]”</em> in Pakistan time without false claims of real-time market execution.
            </p>
            <p className="mt-1">
              Historical 2024 snapshots are marked <em>“Price needs updating”</em> and do not feed today’s starting portfolio automatically. You can always override or enter prices directly from your brokerage app.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#172522] text-sm mb-1">Current Price vs. Purchase Cost</h4>
            <p>
              For portfolio valuation today, enter the current price per share from your brokerage app, not what you originally paid. Your purchase cost is historical and does not represent today’s market value.
            </p>
          </div>
        </div>
      </InfoModal>

      {/* Modal: Why We Ask */}
      <InfoModal
        isOpen={whyWeAskOpen}
        onClose={() => setWhyWeAskOpen(false)}
        title="Why we ask about your investments"
      >
        <div className="space-y-3 text-xs text-[#52635D] leading-relaxed">
          <p>
            If you already own stocks or mutual funds, that money is actively compounding. Including your existing holdings lets Horizon calculate your total portfolio timeline from where you stand today.
          </p>
          <p>
            If you are starting fresh, your projection will show how consistent monthly investments compound over your chosen horizon.
          </p>
          <p>
            We strictly separate investable assets from cash cushions and emergency reserves to keep your financial plan honest.
          </p>
        </div>
      </InfoModal>

      {/* Modal: Unsaved Draft Warning */}
      <InfoModal
        isOpen={unsavedDraftModalOpen}
        onClose={() => setUnsavedDraftModalOpen(false)}
        title="You have an unsaved holding"
      >
        <div className="space-y-4 text-xs text-[#52635D]">
          <p>
            You entered details for <strong>{holdingName || searchQuery || 'a holding'}</strong>, but haven’t added it to your list yet.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={handleSaveDraftAndContinue}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#176B52] text-white font-bold rounded-xl min-h-[44px]"
            >
              Add holding & continue
            </button>
            <button
              type="button"
              onClick={handleDiscardDraftAndContinue}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-[#D5DFDA] text-[#52635D] font-bold rounded-xl min-h-[44px]"
            >
              Discard holding & continue
            </button>
          </div>
        </div>
      </InfoModal>

      {/* Modal: Track Non-Invested Wealth */}
      <InfoModal
        isOpen={otherAssetsModalOpen}
        onClose={() => setOtherAssetsModalOpen(false)}
        title="Track Other Assets (Optional)"
      >
        <div className="space-y-4 text-xs text-[#52635D]">
          <p>
            These assets are tracked separately for your net worth, but are excluded from your stock investment projection to avoid assuming equity returns on cash, gold, or property.
          </p>
          <div className="space-y-2">
            {MARKET_BENCHMARKS.nonProjectedCategories.map((cat) => {
              const existingItem = trackedWealth.find((w) => w.category === cat.id);
              const amount = existingItem ? existingItem.amount : 0;

              return (
                <div key={cat.id} className="p-3 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#172522]">{cat.label}</span>
                    <span className="text-[11px] text-[#52635D]">{cat.hint}</span>
                  </div>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#52635D]">
                      Rs.
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={amount ? amount.toLocaleString('en-US') : ''}
                      onChange={(e) => {
                        const val = parseCleanNumber(e.target.value);
                        const filtered = trackedWealth.filter((w) => w.category !== cat.id);
                        if (val > 0) {
                          onChangeTrackedWealth([
                            ...filtered,
                            {
                              id: `wealth-${cat.id}`,
                              category: cat.id as NonProjectedCategory,
                              label: cat.label,
                              amount: val,
                            },
                          ]);
                        } else {
                          onChangeTrackedWealth(filtered);
                        }
                      }}
                      className="w-full h-10 pl-9 pr-3 bg-white border border-[#D5DFDA] rounded-lg text-sm font-semibold text-[#172522]"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 text-right">
            <button
              type="button"
              onClick={() => setOtherAssetsModalOpen(false)}
              className="px-5 py-2.5 bg-[#176B52] text-white font-bold rounded-xl min-h-[44px]"
            >
              Done
            </button>
          </div>
        </div>
      </InfoModal>
    </div>
  );
};
