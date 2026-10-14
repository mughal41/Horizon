/**
 * My Portfolio Component
 * 
 * Actual portfolio tracking screen separating current holdings, cost basis,
 * unrealised gain/loss, allocation bar, historical snapshots chart, and stock detail inspection.
 */

import React, { useState, useEffect } from 'react';
import { StockHolding } from '../types/horizon';
import { formatPKR } from '../utils/finance';
import {
  loadPortfolioSnapshots,
  savePortfolioSnapshot,
  PortfolioSnapshot,
} from '../utils/portfolioStorage';
import { StockDetailModal } from './StockDetailModal';
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  Plus,
  ShieldCheck,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  HelpCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface PortfolioViewProps {
  stockHoldings: StockHolding[];
  onChangeHoldings: (holdings: StockHolding[]) => void;
  showLakhFormat: boolean;
  onNavigateStep: (step: number) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  stockHoldings,
  onChangeHoldings,
  showLakhFormat,
  onNavigateStep,
}) => {
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [chartView, setChartView] = useState<'value' | 'pnl'>('value');
  const [selectedHolding, setSelectedHolding] = useState<StockHolding | null>(null);
  const [gainLossHelpOpen, setGainLossHelpOpen] = useState(false);

  // Load and save snapshot on mount / holdings change
  useEffect(() => {
    const updated = savePortfolioSnapshot(stockHoldings);
    setSnapshots(updated);
  }, [stockHoldings]);

  // Calculations
  let totalMarketValue = 0;
  let totalCostBasisKnown = 0;
  let eligibleMarketValueKnown = 0;
  let holdingsWithCostBasisCount = 0;
  let holdingsMissingPriceCount = 0;

  stockHoldings.forEach((h) => {
    const mVal = h.marketValue || 0;
    totalMarketValue += mVal;

    if (!h.pricePerShare || h.pricePerShare <= 0) {
      holdingsMissingPriceCount++;
    }

    if (
      typeof h.shares === 'number' &&
      h.shares > 0 &&
      typeof h.averageBuyingPrice === 'number' &&
      h.averageBuyingPrice > 0
    ) {
      const basis = h.shares * h.averageBuyingPrice;
      totalCostBasisKnown += basis;
      eligibleMarketValueKnown += mVal;
      holdingsWithCostBasisCount++;
    }
  });

  const totalUnrealisedPnL = eligibleMarketValueKnown - totalCostBasisKnown;
  const totalUnrealisedPnLPct =
    totalCostBasisKnown > 0 ? (totalUnrealisedPnL / totalCostBasisKnown) * 100 : undefined;

  const isPartialPnL = holdingsWithCostBasisCount < stockHoldings.length;

  // First snapshot date for "Tracked since [date]"
  const trackedSinceDate =
    snapshots.length > 0
      ? new Date(snapshots[0].timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'Today';

  const handleUpdateHolding = (updated: StockHolding) => {
    const newHoldings = stockHoldings.map((h) => (h.id === updated.id ? updated : h));
    onChangeHoldings(newHoldings);
    setSelectedHolding(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-[#176B52]" />
          <span className="text-xs font-bold text-[#176B52] uppercase tracking-wider">
            Actual Portfolio Tracking
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#172522]">
            My Portfolio
          </h1>
          <button
            type="button"
            onClick={() => onNavigateStep(1)}
            className="shrink-0 min-h-[40px] px-3 py-1.5 bg-[#176B52] hover:bg-[#11543F] text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add holding</span>
          </button>
        </div>
        <p className="mt-1 text-sm text-[#52635D] leading-relaxed">
          Track what your investments are worth now, compare against what you paid, and observe changes over time.
        </p>
      </div>

      {/* Main Portfolio Summary Card */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Total Value Now */}
          <div className="p-4 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl space-y-1">
            <span className="text-xs font-semibold text-[#52635D] uppercase tracking-wider block">
              Total value now
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#172522] tabular-nums mt-1">
              {formatPKR(totalMarketValue, { useLakhFormat: showLakhFormat })}
            </div>
            {holdingsMissingPriceCount > 0 && (
              <span className="text-[11px] text-amber-800 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Incomplete valuation ({holdingsMissingPriceCount} missing price)</span>
              </span>
            )}
          </div>

          {/* 2. Money Spent (Cost Basis) */}
          <div className="p-4 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl space-y-1">
            <span className="text-xs font-semibold text-[#52635D] uppercase tracking-wider block">
              Money spent (Cost basis)
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#172522] tabular-nums mt-1">
              {holdingsWithCostBasisCount > 0
                ? formatPKR(totalCostBasisKnown, { useLakhFormat: showLakhFormat })
                : 'Not set'}
            </div>
            <span className="text-[11px] text-[#52635D] block mt-1">
              {holdingsWithCostBasisCount} of {stockHoldings.length} holdings with buying price
            </span>
          </div>

          {/* 3. Gain/Loss on current holdings */}
          <div className="p-4 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#176B52] uppercase tracking-wider">
                {isPartialPnL ? 'Partial gain/loss' : 'Gain/loss'}
              </span>
              <button
                type="button"
                onClick={() => setGainLossHelpOpen(!gainLossHelpOpen)}
                className="text-[#176B52] hover:text-[#11543F]"
                title="Gain/loss explanation"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>

            {holdingsWithCostBasisCount > 0 ? (
              <>
                <div className={`text-2xl sm:text-3xl font-extrabold tabular-nums mt-1 ${totalUnrealisedPnL < 0 ? 'text-rose-700' : 'text-[#176B52]'}`}>
                  {totalUnrealisedPnL >= 0 ? '+' : ''}{formatPKR(totalUnrealisedPnL, { useLakhFormat: showLakhFormat })}
                </div>
                <div className={`text-xs font-bold tabular-nums mt-0.5 flex items-center gap-1 ${totalUnrealisedPnL < 0 ? 'text-rose-700' : 'text-[#176B52]'}`}>
                  {totalUnrealisedPnL >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span>{totalUnrealisedPnLPct! >= 0 ? '+' : ''}{totalUnrealisedPnLPct!.toFixed(2)}% overall return</span>
                </div>
              </>
            ) : (
              <span className="text-xs text-[#52635D] block mt-2">
                Add average buying price to see gain/loss.
              </span>
            )}
          </div>
        </div>

        {/* Gain/Loss Help Drawer */}
        {gainLossHelpOpen && (
          <div className="p-3.5 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs text-[#52635D] space-y-1.5 leading-relaxed animate-in fade-in duration-150">
            <p>
              • <strong>Gain/Loss:</strong> This is the change in value of shares you still own. It excludes dividends, fees and taxes unless recorded.
            </p>
            <p>
              • <strong>Portfolio Percentage:</strong> Calculated as sum of eligible unrealised P&L divided by sum of eligible cost basis. Individual stock percentages are never simply averaged.
            </p>
            {isPartialPnL && (
              <p className="text-amber-800 font-medium">
                • Note: Total is partial because {stockHoldings.length - holdingsWithCostBasisCount} holding(s) lack a recorded average buying price.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Portfolio Chart Section */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D5DFDA]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#172522]">
                Portfolio History
              </h2>
              <span className="px-2 py-0.5 bg-[#EAF4EF] text-[#176B52] text-[11px] font-bold rounded">
                Tracked since {trackedSinceDate}
              </span>
            </div>
            <p className="text-xs text-[#52635D] mt-0.5">
              Recorded as you check your portfolio over time.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#F8FAF9] p-1 border border-[#D5DFDA] rounded-xl self-start sm:self-center">
            <button
              type="button"
              onClick={() => setChartView('value')}
              className={`min-h-[36px] px-3 text-xs font-semibold rounded-lg transition-all ${
                chartView === 'value'
                  ? 'bg-[#176B52] text-white shadow-xs'
                  : 'text-[#52635D] hover:text-[#172522]'
              }`}
            >
              Portfolio value
            </button>
            <button
              type="button"
              onClick={() => setChartView('pnl')}
              className={`min-h-[36px] px-3 text-xs font-semibold rounded-lg transition-all ${
                chartView === 'pnl'
                  ? 'bg-[#176B52] text-white shadow-xs'
                  : 'text-[#52635D] hover:text-[#172522]'
              }`}
            >
              Gain/loss
            </button>
          </div>
        </div>

        {snapshots.length < 2 ? (
          <div className="p-8 text-center bg-[#F8FAF9] border border-dashed border-[#D5DFDA] rounded-xl space-y-2">
            <PieChart className="w-8 h-8 text-[#52635D]/60 mx-auto" />
            <span className="text-sm font-semibold text-[#172522] block">
              Your chart will grow as you check your portfolio over time.
            </span>
            <p className="text-xs text-[#52635D] max-w-sm mx-auto">
              Horizon records portfolio snapshots on your device as you review your holdings. Check back after updating prices or adding positions.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Simple SVG Trend Visualizer */}
            <div className="h-48 w-full bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex justify-between text-xs text-[#52635D]">
                <span>{chartView === 'value' ? 'Total Portfolio Value' : 'Unrealised Gain / Loss'}</span>
                <span>{snapshots.length} observation(s)</span>
              </div>

              <div className="flex items-end h-28 gap-2 px-2 pt-4 border-b border-[#D5DFDA]">
                {snapshots.map((snap, idx) => {
                  const val = chartView === 'value' ? snap.totalMarketValue : snap.totalUnrealisedPnL;
                  const maxVal = Math.max(...snapshots.map((s) => Math.abs(chartView === 'value' ? s.totalMarketValue : s.totalUnrealisedPnL)), 1);
                  const heightPct = Math.max(15, Math.min(100, (Math.abs(val) / maxVal) * 100));
                  const dateLabel = new Date(snap.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[32px] rounded-t transition-all ${
                          chartView === 'pnl' && val < 0 ? 'bg-rose-600' : 'bg-[#176B52]'
                        }`}
                        title={`${dateLabel}: ${formatPKR(val)}`}
                      />
                      <span className="text-[10px] text-[#52635D] mt-1 truncate w-full text-center">
                        {dateLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-[11px] text-[#52635D]">
                <span>First: {new Date(snapshots[0].timestamp).toLocaleDateString()}</span>
                <span>Latest: {new Date(snapshots[snapshots.length - 1].timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Holdings List & Allocation */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#D5DFDA]">
          <div>
            <h2 className="text-base font-bold text-[#172522]">
              Holdings List ({stockHoldings.length})
            </h2>
            <p className="text-xs text-[#52635D] mt-0.5">
              Tap any holding to inspect details or update its average buying price.
            </p>
          </div>
        </div>

        {/* Allocation Bar */}
        {totalMarketValue > 0 && stockHoldings.length > 0 && (
          <div className="space-y-2 p-3.5 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl">
            <div className="flex justify-between text-xs font-semibold text-[#172522]">
              <span>Where your money is invested (Allocation)</span>
              <span>100% Total</span>
            </div>
            <div className="h-3 w-full bg-[#D5DFDA] rounded-full overflow-hidden flex">
              {stockHoldings.map((h, i) => {
                const sharePct = Math.max(2, (h.marketValue / totalMarketValue) * 100);
                const colors = ['bg-[#176B52]', 'bg-[#11543F]', 'bg-[#2E8B57]', 'bg-[#3CB371]', 'bg-[#20B2AA]', 'bg-[#4682B4]'];
                return (
                  <div
                    key={h.id}
                    style={{ width: `${sharePct}%` }}
                    className={`h-full ${colors[i % colors.length]} border-r border-white`}
                    title={`${h.symbolOrName}: ${sharePct.toFixed(1)}%`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#52635D]">
              {stockHoldings.map((h) => {
                const sharePct = (h.marketValue / totalMarketValue) * 100;
                return (
                  <span key={h.id}>
                    <strong>{h.symbol || h.symbolOrName}:</strong> {sharePct.toFixed(1)}%
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Holdings Rows / Cards */}
        {stockHoldings.length > 0 ? (
          <div className="divide-y divide-[#D5DFDA] border border-[#D5DFDA] rounded-xl overflow-hidden bg-white">
            {stockHoldings.map((holding) => {
              const hVal = holding.marketValue || 0;
              const hasBuyPrice =
                typeof holding.shares === 'number' &&
                holding.shares > 0 &&
                typeof holding.averageBuyingPrice === 'number' &&
                holding.averageBuyingPrice > 0;

              const cBasis = hasBuyPrice ? holding.shares! * holding.averageBuyingPrice! : undefined;
              const uPnL = cBasis !== undefined ? hVal - cBasis : undefined;
              const uPnLPct = cBasis !== undefined && cBasis > 0 ? (uPnL! / cBasis) * 100 : undefined;

              return (
                <button
                  key={holding.id}
                  type="button"
                  onClick={() => setSelectedHolding(holding)}
                  className="w-full p-4 text-left hover:bg-[#F8FAF9] transition-colors flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#172522] text-sm truncate">
                        {holding.symbolOrName}
                      </span>
                      {holding.isVerifiedPsx && (
                        <span className="px-1.5 py-0.5 bg-[#EAF4EF] text-[#176B52] text-[10px] font-bold rounded">
                          PSX
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#52635D]">
                      {holding.shares && holding.pricePerShare ? (
                        <span>{holding.shares.toLocaleString()} shares @ Rs. {holding.pricePerShare.toLocaleString()}</span>
                      ) : (
                        <span>Manual holding value</span>
                      )}

                      {hasBuyPrice ? (
                        <span className={`font-semibold inline-flex items-center gap-0.5 ${uPnL! < 0 ? 'text-rose-700' : 'text-[#176B52]'}`}>
                          {uPnL! >= 0 ? '+' : ''}{formatPKR(uPnL!, { compact: true })} ({uPnLPct! >= 0 ? '+' : ''}{uPnLPct!.toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="text-amber-800 text-[11px] font-medium">
                          Add buying price to see gain/loss
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="font-bold text-[#172522] tabular-nums block text-sm">
                        {formatPKR(hVal, { useLakhFormat: showLakhFormat })}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#52635D]" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center bg-[#F8FAF9] border border-dashed border-[#D5DFDA] rounded-xl text-xs text-[#52635D]">
            No holdings added yet. Tap &ldquo;Add holding&rdquo; above to record your shares.
          </div>
        )}
      </div>

      {/* Stock Detail Modal */}
      {selectedHolding && (
        <StockDetailModal
          holding={selectedHolding}
          onClose={() => setSelectedHolding(null)}
          onUpdateHolding={handleUpdateHolding}
          showLakhFormat={showLakhFormat}
        />
      )}
    </div>
  );
};
