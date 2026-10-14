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

interface PortfolioHistoryChartProps {
  snapshots: PortfolioSnapshot[];
  view: 'value' | 'pnl';
  showLakhFormat: boolean;
}

interface PriceComparisonChartProps {
  holdings: StockHolding[];
  showLakhFormat: boolean;
}

const PriceComparisonChart: React.FC<PriceComparisonChartProps> = ({ holdings, showLakhFormat }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const comparable = holdings.filter((holding) =>
    typeof holding.pricePerShare === 'number' && holding.pricePerShare > 0 &&
    typeof holding.averageBuyingPrice === 'number' && holding.averageBuyingPrice > 0
  );

  if (comparable.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#D5DFDA] bg-[#F8FAF9] p-6 text-center">
        <TrendingUp className="mx-auto h-7 w-7 text-[#52635D]/60" />
        <p className="mt-2 text-sm font-semibold text-[#172522]">Add average buying prices to compare your positions.</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#52635D]">
          Open each holding below and enter the average amount you paid per share. Horizon will compare it with the current saved price here.
        </p>
      </div>
    );
  }

  const maxPrice = Math.max(...comparable.flatMap((holding) => [holding.pricePerShare!, holding.averageBuyingPrice!]), 1) * 1.1;
  const ticks = Array.from({ length: 5 }, (_, index) => (maxPrice / 4) * index);
  const selected = activeIndex === null ? null : comparable[activeIndex];

  const moveSelection = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setActiveIndex((current) => {
      if (event.key === 'Home') return 0;
      if (event.key === 'End') return comparable.length - 1;
      const start = current ?? 0;
      return Math.max(0, Math.min(comparable.length - 1, start + (event.key === 'ArrowDown' ? 1 : -1)));
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#52635D]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#8A9A93]" />Average buying price</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#176B52]" />Current price above buy</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-600" />Current price below buy</span>
      </div>
      <div
        className="relative rounded-xl border border-[#D5DFDA] bg-[#F8FAF9] p-2 outline-none focus-visible:ring-2 focus-visible:ring-[#176B52] focus-visible:ring-offset-2"
        tabIndex={0}
        onFocus={() => setActiveIndex((current) => current ?? 0)}
        onBlur={() => setActiveIndex(null)}
        onKeyDown={moveSelection}
        aria-label="Interactive current price versus average buying price chart. Use up and down arrow keys to inspect holdings."
        data-testid="price-comparison-chart"
      >
        <div
          className="px-2 pb-2 pt-3"
          role="img"
          aria-label={`Current price compared with average buying price for ${comparable.length} holdings`}
          data-testid="price-comparison-plot"
          onPointerLeave={() => setActiveIndex(null)}
        >
          {comparable.map((holding, index) => {
            const buyPercent = (holding.averageBuyingPrice! / maxPrice) * 100;
            const currentPercent = (holding.pricePerShare! / maxPrice) * 100;
            const isGain = holding.pricePerShare! >= holding.averageBuyingPrice!;
            const color = isGain ? '#176B52' : '#BE123C';
            return (
              <div
                key={holding.id}
                className={`grid grid-cols-[52px_1fr] items-center gap-2 rounded-lg py-3 transition-opacity ${activeIndex === null || activeIndex === index ? 'opacity-100' : 'opacity-45'}`}
                onPointerEnter={() => setActiveIndex(index)}
              >
                <span className="truncate text-right text-xs font-bold text-[#172522]">{holding.symbol || holding.symbolOrName.slice(0, 8)}</span>
                <span className="relative block h-7 border-x border-[#D5DFDA] bg-[linear-gradient(to_right,#D5DFDA_1px,transparent_1px)] bg-[length:25%_100%]">
                  <span
                    className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
                    style={{ left: `${Math.min(buyPercent, currentPercent)}%`, width: `${Math.abs(currentPercent - buyPercent)}%`, backgroundColor: color }}
                  />
                  <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#8A9A93] bg-white" style={{ left: `${buyPercent}%` }} />
                  <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white" style={{ left: `${currentPercent}%`, borderColor: color }} />
                </span>
              </div>
            );
          })}
          <div className="ml-[60px] mt-1 grid grid-cols-5 text-[10px] tabular-nums text-[#52635D]">
            {ticks.map((tick, index) => (
              <span key={tick} className={index === 0 ? 'text-left' : index === ticks.length - 1 ? 'text-right' : 'text-center'}>{formatPKR(tick, { compact: true })}</span>
            ))}
          </div>
          <p className="ml-[60px] mt-1 text-center text-[11px] font-semibold text-[#52635D]">Price per share (PKR)</p>
        </div>
        {selected && (
          <div
            className="pointer-events-none absolute left-1/2 top-4 z-10 w-[220px] -translate-x-1/2 rounded-xl border border-[#B8CCC4] bg-white p-3 text-[11px] shadow-lg"
            role="status"
            data-testid="price-comparison-tooltip"
          >
            <div className="font-bold text-[#172522]">{selected.symbol || selected.symbolOrName}</div>
            <div className="mt-2 space-y-1.5 tabular-nums">
              <div className="flex justify-between gap-4 text-[#52635D]"><span>Average buy</span><strong className="text-[#172522]">{formatPKR(selected.averageBuyingPrice!, { useLakhFormat: showLakhFormat })}</strong></div>
              <div className="flex justify-between gap-4 text-[#52635D]"><span>Current price</span><strong className="text-[#172522]">{formatPKR(selected.pricePerShare!, { useLakhFormat: showLakhFormat })}</strong></div>
              <div className="flex justify-between gap-4 text-[#52635D]"><span>Difference</span><strong className={selected.pricePerShare! >= selected.averageBuyingPrice! ? 'text-[#176B52]' : 'text-rose-700'}>{selected.pricePerShare! >= selected.averageBuyingPrice! ? '+' : ''}{formatPKR(selected.pricePerShare! - selected.averageBuyingPrice!, { useLakhFormat: showLakhFormat })}</strong></div>
            </div>
          </div>
        )}
      </div>
      {comparable.length < holdings.length && (
        <p className="text-[11px] text-amber-800">Showing {comparable.length} of {holdings.length} holdings. Add buying prices to include the rest.</p>
      )}
    </div>
  );
};

const PortfolioHistoryChart: React.FC<PortfolioHistoryChartProps> = ({ snapshots, view, showLakhFormat }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 640;
  const height = 270;
  const margin = { top: 18, right: 18, bottom: 48, left: 82 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = snapshots.map((snapshot) => view === 'value' ? snapshot.totalMarketValue : snapshot.totalUnrealisedPnL);
  const latestValue = values[values.length - 1];
  const lineColor = view === 'pnl' && latestValue < 0 ? '#BE123C' : '#176B52';
  const fillColor = view === 'pnl' && latestValue < 0 ? '#E11D48' : '#176B52';

  let minValue = view === 'pnl' ? Math.min(0, ...values) : 0;
  let maxValue = Math.max(0, ...values);
  if (minValue === maxValue) {
    const fallback = Math.max(1, snapshots[snapshots.length - 1].totalCostBasis * 0.05);
    minValue = view === 'pnl' ? -fallback : 0;
    maxValue = fallback;
  } else {
    if (minValue < 0) minValue *= 1.1;
    if (maxValue > 0) maxValue *= 1.1;
  }
  const range = maxValue - minValue;
  const getX = (index: number) => snapshots.length === 1
    ? margin.left + plotWidth / 2
    : margin.left + (index / (snapshots.length - 1)) * plotWidth;
  const getY = (value: number) => margin.top + ((maxValue - value) / range) * plotHeight;
  const path = values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(value)}`).join(' ');
  const baselineY = getY(view === 'pnl' ? 0 : minValue);
  const yTicks = Array.from({ length: 5 }, (_, index) => minValue + (range / 4) * index);
  const xTickIndexes = Array.from(new Set([0, Math.round((snapshots.length - 1) / 2), snapshots.length - 1]));
  const hasRepeatedDates = snapshots.some((snapshot, index) => snapshots.slice(0, index).some(
    (previous) => new Date(previous.timestamp).toDateString() === new Date(snapshot.timestamp).toDateString()
  ));
  const formatTime = (timestamp: string) => hasRepeatedDates
    ? new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    : new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const selected = activeIndex === null ? null : snapshots[activeIndex];
  const selectedValue = activeIndex === null ? null : values[activeIndex];
  const selectedX = activeIndex === null ? 0 : getX(activeIndex);
  const tooltipLeft = (selectedX / width) * 100;

  const selectFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * width;
    if (snapshots.length === 1) {
      setActiveIndex(0);
      return;
    }
    const ratio = Math.max(0, Math.min(1, (x - margin.left) / plotWidth));
    setActiveIndex(Math.round(ratio * (snapshots.length - 1)));
  };

  const moveSelection = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setActiveIndex((current) => {
      if (event.key === 'Home') return 0;
      if (event.key === 'End') return snapshots.length - 1;
      const start = current ?? snapshots.length - 1;
      return Math.max(0, Math.min(snapshots.length - 1, start + (event.key === 'ArrowRight' ? 1 : -1)));
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-[#52635D]">
        <span>{view === 'value' ? 'Total Portfolio Value' : 'Unrealised Gain / Loss'}</span>
        <span className={`font-bold tabular-nums ${view === 'pnl' && latestValue < 0 ? 'text-rose-700' : 'text-[#176B52]'}`}>
          {view === 'pnl' && latestValue >= 0 ? '+' : ''}{formatPKR(latestValue, { useLakhFormat: showLakhFormat })}
        </span>
      </div>
      <div
        className="relative rounded-xl border border-[#D5DFDA] bg-[#F8FAF9] px-2 pb-2 pt-3 outline-none focus-visible:ring-2 focus-visible:ring-[#176B52] focus-visible:ring-offset-2"
        tabIndex={0}
        onFocus={() => setActiveIndex((current) => current ?? snapshots.length - 1)}
        onBlur={() => setActiveIndex(null)}
        onKeyDown={moveSelection}
        aria-label={`Interactive ${view === 'value' ? 'portfolio value' : 'gain and loss'} history chart. Use left and right arrow keys to inspect observations.`}
        data-testid="portfolio-history-chart"
      >
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[240px] min-w-[540px] w-full touch-pan-x"
            role="img"
            aria-label={`${view === 'value' ? 'Portfolio value' : 'Unrealised gain and loss'} over ${snapshots.length} observations`}
            onPointerMove={selectFromPointer}
            onPointerLeave={() => setActiveIndex(null)}
          >
            <defs>
              <linearGradient id={`portfolio-history-area-${view}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fillColor} stopOpacity="0.22" />
                <stop offset="100%" stopColor={fillColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {yTicks.map((tick, index) => {
              const y = getY(tick);
              return (
                <g key={index}>
                  <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="#D5DFDA" strokeWidth="1" />
                  <text x={margin.left - 10} y={y + 4} textAnchor="end" fill="#52635D" fontSize="11">
                    {formatPKR(tick, { compact: true })}
                  </text>
                </g>
              );
            })}
            {xTickIndexes.map((index) => (
              <text key={index} x={getX(index)} y={height - 17} textAnchor="middle" fill="#52635D" fontSize="11">
                {formatTime(snapshots[index].timestamp)}
              </text>
            ))}
            <text x={15} y={margin.top + plotHeight / 2} transform={`rotate(-90 15 ${margin.top + plotHeight / 2})`} textAnchor="middle" fill="#52635D" fontSize="11" fontWeight="600">
              {view === 'value' ? 'Portfolio value (PKR)' : 'Gain / loss (PKR)'}
            </text>
            <text x={margin.left + plotWidth / 2} y={height - 1} textAnchor="middle" fill="#52635D" fontSize="11" fontWeight="600">
              Observation time
            </text>
            {view === 'pnl' && (
              <line x1={margin.left} y1={baselineY} x2={width - margin.right} y2={baselineY} stroke="#52635D" strokeWidth="1.5" strokeDasharray="5 4" />
            )}
            <path
              d={`${path} L ${getX(snapshots.length - 1)} ${baselineY} L ${getX(0)} ${baselineY} Z`}
              fill={`url(#portfolio-history-area-${view})`}
              pointerEvents="none"
            />
            {snapshots.length > 1 && (
              <path d={path} fill="none" stroke={lineColor} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
            )}
            {snapshots.map((snapshot, index) => (
              <circle key={`${snapshot.timestamp}-${index}`} cx={getX(index)} cy={getY(values[index])} r={activeIndex === index ? 6 : 4.5} fill="#FFFFFF" stroke={lineColor} strokeWidth="3" pointerEvents="none" />
            ))}
            {selected && selectedValue !== null && activeIndex !== null && (
              <line x1={selectedX} y1={margin.top} x2={selectedX} y2={margin.top + plotHeight} stroke={lineColor} strokeWidth="1" strokeDasharray="3 3" pointerEvents="none" />
            )}
          </svg>
        </div>
        {selected && selectedValue !== null && (
          <div
            className={`pointer-events-none absolute top-5 z-10 min-w-[205px] rounded-xl border border-[#B8CCC4] bg-white p-3 text-[11px] shadow-lg ${tooltipLeft > 67 ? '-translate-x-full' : tooltipLeft < 33 ? '' : '-translate-x-1/2'}`}
            style={{ left: `${Math.max(3, Math.min(97, tooltipLeft))}%` }}
            role="status"
            data-testid="portfolio-history-tooltip"
          >
            <div className="font-bold text-[#172522]">{new Date(selected.timestamp).toLocaleString()}</div>
            <div className={`mt-1 text-sm font-extrabold tabular-nums ${view === 'pnl' && selectedValue < 0 ? 'text-rose-700' : 'text-[#176B52]'}`}>
              {view === 'pnl' && selectedValue >= 0 ? '+' : ''}{formatPKR(selectedValue, { useLakhFormat: showLakhFormat })}
            </div>
            <div className="mt-1 text-[#52635D]">{selected.changeNote || 'Portfolio observation'}</div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 text-[11px] text-[#52635D] sm:flex-row sm:justify-between">
        <span>{snapshots.length} {snapshots.length === 1 ? 'observation' : 'observations'}</span>
        <span>{snapshots.length === 1 ? 'Update a price or position to build the trend.' : 'Hover, tap, or use arrow keys to inspect history.'}</span>
      </div>
    </div>
  );
};

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
  const chartSnapshots = chartView === 'pnl'
    ? snapshots.filter((snapshot) => snapshot.holdingsWithCostBasisCount > 0)
    : snapshots;

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
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-4">
        <div className="border-b border-[#D5DFDA] pb-3">
          <h2 className="text-base font-bold text-[#172522]">Current price vs average buy</h2>
          <p className="mt-0.5 text-xs text-[#52635D]">Compare your saved price per share with the average price you paid for each holding.</p>
        </div>
        <PriceComparisonChart holdings={stockHoldings} showLakhFormat={showLakhFormat} />
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

        {chartSnapshots.length === 0 ? (
          <div className="p-8 text-center bg-[#F8FAF9] border border-dashed border-[#D5DFDA] rounded-xl space-y-2">
            <PieChart className="w-8 h-8 text-[#52635D]/60 mx-auto" />
            <span className="text-sm font-semibold text-[#172522] block">
              {chartView === 'pnl' && snapshots.length > 0
                ? 'Add a buying price to track gain/loss.'
                : 'Your chart will start after your first portfolio check.'}
            </span>
            <p className="text-xs text-[#52635D] max-w-sm mx-auto">
              {chartView === 'pnl' && snapshots.length > 0
                ? 'Gain/loss requires shares and an average buying price. Open a holding to add the average amount paid per share.'
                : 'Horizon records portfolio snapshots on this device as you review holdings with a current value.'}
            </p>
          </div>
        ) : (
          <PortfolioHistoryChart snapshots={chartSnapshots} view={chartView} showLakhFormat={showLakhFormat} />
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
