/**
 * Stock Detail & Edit Holding Modal
 * 
 * Allows viewing and editing holding details including shares, current price,
 * average buying price ("The average amount you paid per share"), and purchase date.
 */

import React, { useState } from 'react';
import { StockHolding } from '../types/horizon';
import { formatPKR, parseCleanNumber } from '../utils/finance';
import { X, ShieldCheck, Edit2, Check, RefreshCw, Loader2, Calendar, DollarSign, PieChart } from 'lucide-react';
import { fetchPsxProviderQuote, getPricingStateLabel } from '../utils/psxService';

interface StockDetailModalProps {
  holding: StockHolding;
  onClose: () => void;
  onUpdateHolding: (updated: StockHolding) => void;
  showLakhFormat: boolean;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  holding,
  onClose,
  onUpdateHolding,
  showLakhFormat,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [shares, setShares] = useState(holding.shares ? holding.shares.toString() : '');
  const [pricePerShare, setPricePerShare] = useState(holding.pricePerShare ? holding.pricePerShare.toString() : '');
  const [avgBuyingPrice, setAvgBuyingPrice] = useState(holding.averageBuyingPrice ? holding.averageBuyingPrice.toString() : '');
  const [purchaseDate, setPurchaseDate] = useState(holding.purchaseDate || '');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const sharesNum = parseCleanNumber(shares);
  const priceNum = parseCleanNumber(pricePerShare);
  const avgBuyNum = parseCleanNumber(avgBuyingPrice);

  const marketVal = sharesNum > 0 && priceNum > 0 ? Math.round(sharesNum * priceNum) : holding.marketValue;
  const costBasis = sharesNum > 0 && avgBuyNum > 0 ? sharesNum * avgBuyNum : undefined;
  const unrealisedPnL = costBasis !== undefined ? marketVal - costBasis : undefined;
  const unrealisedPnLPct = costBasis !== undefined && costBasis > 0 ? (unrealisedPnL! / costBasis) * 100 : undefined;

  const handleRefreshQuote = async () => {
    const symbol = holding.symbol || (holding.isVerifiedPsx ? holding.symbolOrName.split('—')[0].trim() : null);
    if (!symbol) return;

    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const quote = await fetchPsxProviderQuote(symbol, { forceRefresh: true });
      if (quote.status === 'valid_quote' && quote.price !== null && quote.price > 0) {
        setPricePerShare(quote.price.toString());
        const newMarketVal = sharesNum > 0 ? Math.round(sharesNum * quote.price) : marketVal;
        const updated: StockHolding = {
          ...holding,
          pricePerShare: quote.price,
          marketValue: newMarketVal,
          priceProvenance: 'provider_quote',
          priceStatus: 'valid_quote',
          fetchedAt: quote.fetchedAt,
          providerTimestamp: quote.providerTimestamp,
          providerSource: 'psxdata-api',
          priceAsOf: quote.statusMessage,
        };
        onUpdateHolding(updated);
      } else {
        setRefreshError('Couldn’t update the price.');
      }
    } catch {
      setRefreshError('Failed to refresh quote.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: StockHolding = {
      ...holding,
      shares: sharesNum > 0 ? sharesNum : undefined,
      pricePerShare: priceNum > 0 ? priceNum : undefined,
      averageBuyingPrice: avgBuyNum > 0 ? avgBuyNum : undefined,
      purchaseDate: purchaseDate.trim() ? purchaseDate.trim() : undefined,
      marketValue: marketVal,
    };
    onUpdateHolding(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsEditing(false);
    }, 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#FFFFFF] rounded-2xl p-6 shadow-xl border border-[#D5DFDA] space-y-5 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#D5DFDA]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#EAF4EF] text-[#176B52] font-bold text-xs rounded">
                {holding.symbol || 'Holding'}
              </span>
              {holding.sector && <span className="text-xs text-[#52635D]">· {holding.sector}</span>}
            </div>
            <h2 className="text-lg font-bold text-[#172522] mt-1">
              {holding.symbolOrName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-[#52635D] hover:text-[#172522] rounded-lg"
            aria-label="Close detail modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl text-xs font-semibold text-[#176B52] flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Changes saved successfully.</span>
          </div>
        )}

        {/* View Mode vs Edit Mode */}
        {!isEditing ? (
          <div className="space-y-5">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl space-y-1">
                <span className="text-[11px] text-[#52635D] block">Current market value</span>
                <span className="text-lg font-bold text-[#172522] tabular-nums block">
                  {formatPKR(marketVal, { useLakhFormat: showLakhFormat })}
                </span>
                <span className="text-[11px] text-[#52635D] block">
                  {sharesNum ? `${sharesNum.toLocaleString()} shares @ Rs. ${priceNum.toLocaleString()}` : 'Manual value'}
                </span>
              </div>

              <div className="p-4 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl space-y-1">
                <span className="text-[11px] text-[#52635D] block">Gain/loss (Unrealised)</span>
                {costBasis !== undefined && unrealisedPnL !== undefined && unrealisedPnLPct !== undefined ? (
                  <>
                    <span className={`text-lg font-bold tabular-nums block ${unrealisedPnL < 0 ? 'text-rose-700' : 'text-[#176B52]'}`}>
                      {unrealisedPnL >= 0 ? '+' : ''}{formatPKR(unrealisedPnL, { useLakhFormat: showLakhFormat })}
                    </span>
                    <span className={`text-xs font-semibold tabular-nums block ${unrealisedPnL < 0 ? 'text-rose-700' : 'text-[#176B52]'}`}>
                      {unrealisedPnLPct >= 0 ? '+' : ''}{unrealisedPnLPct.toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-[#52635D] block mt-1">
                    Add average buying price to see gain/loss.
                  </span>
                )}
              </div>
            </div>

            {/* Cost Basis & Price Details */}
            <div className="p-4 bg-white border border-[#D5DFDA] rounded-xl space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-[#D5DFDA]/60">
                <span className="text-[#52635D]">Average buying price</span>
                <span className="font-bold text-[#172522] tabular-nums">
                  {holding.averageBuyingPrice ? `Rs. ${holding.averageBuyingPrice.toLocaleString()}` : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#D5DFDA]/60">
                <span className="text-[#52635D]">Total cost basis</span>
                <span className="font-bold text-[#172522] tabular-nums">
                  {costBasis !== undefined ? formatPKR(costBasis, { useLakhFormat: showLakhFormat }) : 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#D5DFDA]/60">
                <span className="text-[#52635D]">Purchase date</span>
                <span className="font-semibold text-[#172522]">
                  {holding.purchaseDate || 'Not specified'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#52635D]">Price freshness</span>
                <span className="text-[#52635D]">
                  {getPricingStateLabel({
                    fetchedAt: holding.fetchedAt,
                    isSavedPrice: holding.priceStatus === 'unverified_saved',
                  })}
                </span>
              </div>
            </div>

            {/* What you paid vs Value now comparison */}
            {costBasis !== undefined && (
              <div className="p-4 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-[#176B52] block">Cost Basis vs. Current Value</span>
                <div className="flex justify-between text-[#172522]">
                  <span>What you paid (Cost Basis):</span>
                  <span className="font-bold tabular-nums">{formatPKR(costBasis)}</span>
                </div>
                <div className="flex justify-between text-[#172522]">
                  <span>Current Value:</span>
                  <span className="font-bold tabular-nums">{formatPKR(marketVal)}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              {(holding.symbol || holding.isVerifiedPsx) && (
                <button
                  type="button"
                  onClick={handleRefreshQuote}
                  disabled={isRefreshing}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-white border border-[#D5DFDA] hover:bg-[#F8FAF9] text-[#172522] font-semibold text-xs rounded-xl transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin text-[#176B52]" /> : <RefreshCw className="w-4 h-4 text-[#176B52]" />}
                  <span>Update price</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto flex-1 min-h-[44px] px-5 py-2.5 bg-[#176B52] hover:bg-[#11543F] text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit holding & buying price</span>
              </button>
            </div>
          </div>
        ) : (
          /* Edit Form */
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-[#172522] block mb-1">Number of shares</label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-[#D5DFDA] rounded-xl text-sm font-semibold text-[#172522]"
                placeholder="e.g. 250"
                min="0"
                step="any"
              />
            </div>

            <div>
              <label className="font-semibold text-[#172522] block mb-1">Current price per share (PKR)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={pricePerShare}
                  onChange={(e) => setPricePerShare(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-[#D5DFDA] rounded-xl text-sm font-semibold text-[#172522]"
                  placeholder="e.g. 541"
                  min="0"
                  step="any"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-1">
                <label className="font-semibold text-[#172522]">Average buying price (PKR)</label>
                <span className="text-[11px] text-[#52635D]">Optional</span>
              </div>
              <input
                type="number"
                value={avgBuyingPrice}
                onChange={(e) => setAvgBuyingPrice(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-[#D5DFDA] rounded-xl text-sm font-semibold text-[#172522]"
                placeholder="e.g. 580"
                min="0"
                step="any"
              />
              <span className="text-[11px] text-[#52635D] block mt-1">
                The average amount you paid per share. Do not reuse current price.
              </span>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-1">
                <label className="font-semibold text-[#172522]">Purchase date</label>
                <span className="text-[11px] text-[#52635D]">Optional</span>
              </div>
              <input
                type="text"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-[#D5DFDA] rounded-xl text-sm text-[#172522]"
                placeholder="e.g. Jan 2025"
              />
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-[#D5DFDA]">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-white border border-[#D5DFDA] text-[#172522] font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-[#176B52] hover:bg-[#11543F] text-white font-bold rounded-xl"
              >
                Save changes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
