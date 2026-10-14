import React, { useState } from 'react';
import {
  HorizonPlan,
  InvestmentStatusChoice,
  TrackedWealthItem,
  StockHolding,
  YearProjectionPoint,
} from '../../types/horizon';
import { formatPKR, calculateProjection } from '../../utils/finance';
import { Check, ShieldCheck, Edit3, AlertCircle } from 'lucide-react';

interface Step4ReviewPlanProps {
  plan: HorizonPlan;
  investmentChoice: InvestmentStatusChoice | null;
  stockHoldings?: StockHolding[];
  trackedWealth: TrackedWealthItem[];
  onSavePlan: () => void;
  onBack: () => void;
  onNavigateStep: (step: number) => void;
  showLakhFormat: boolean;
}

interface ProjectionChartProps {
  timeline: YearProjectionPoint[];
  showLakhFormat: boolean;
}

const ProjectionChart: React.FC<ProjectionChartProps> = ({ timeline, showLakhFormat }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 640;
  const height = 300;
  const margin = { top: 20, right: 20, bottom: 48, left: 78 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(
    1,
    ...timeline.flatMap((point) => [
      point.nominalPortfolioValue,
      point.totalContributions,
      point.realPurchasingPower,
    ])
  );
  const axisMax = Math.ceil(maxValue / 4 / 100_000) * 4 * 100_000 || maxValue;
  const getX = (index: number) => margin.left + (index / Math.max(1, timeline.length - 1)) * plotWidth;
  const getY = (value: number) => margin.top + plotHeight - (value / axisMax) * plotHeight;
  const makePath = (key: keyof Pick<YearProjectionPoint, 'nominalPortfolioValue' | 'totalContributions' | 'realPurchasingPower'>) =>
    timeline.map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point[key])}`).join(' ');
  const yTicks = Array.from({ length: 5 }, (_, index) => (axisMax / 4) * index);
  const xTickIndexes = Array.from(new Set([0, Math.round((timeline.length - 1) / 4), Math.round((timeline.length - 1) / 2), Math.round(((timeline.length - 1) * 3) / 4), timeline.length - 1]));
  const selected = activeIndex === null ? null : timeline[activeIndex];
  const selectedX = activeIndex === null ? 0 : getX(activeIndex);
  const tooltipLeft = activeIndex === null ? 0 : (selectedX / width) * 100;

  const selectFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
    const ratio = Math.max(0, Math.min(1, (pointerX - margin.left) / plotWidth));
    setActiveIndex(Math.round(ratio * (timeline.length - 1)));
  };

  const moveSelection = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    setActiveIndex((current) => {
      if (event.key === 'Home') return 0;
      if (event.key === 'End') return timeline.length - 1;
      const start = current ?? 0;
      return Math.max(0, Math.min(timeline.length - 1, start + (event.key === 'ArrowRight' ? 1 : -1)));
    });
  };

  return (
    <div
      className="relative w-full rounded-xl border border-[#D5DFDA] bg-[#F8FAF9] px-2 pb-2 pt-3 outline-none focus-visible:ring-2 focus-visible:ring-[#176B52] focus-visible:ring-offset-2"
      tabIndex={0}
      onFocus={() => setActiveIndex((current) => current ?? timeline.length - 1)}
      onBlur={() => setActiveIndex(null)}
      onKeyDown={moveSelection}
      aria-label="Interactive growth projection chart. Use the left and right arrow keys to inspect each year."
      data-testid="projection-chart"
    >
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[260px] min-w-[560px] w-full touch-pan-x"
          role="img"
          aria-labelledby="projection-chart-title projection-chart-description"
          onPointerMove={selectFromPointer}
          onPointerLeave={() => setActiveIndex(null)}
        >
          <title id="projection-chart-title">Projected portfolio growth over time</title>
          <desc id="projection-chart-description">Future portfolio, total money invested, and inflation-adjusted buying power by year.</desc>
          <defs>
            <linearGradient id="portfolio-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#176B52" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#176B52" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="#D5DFDA" strokeWidth="1" />
                <text x={margin.left - 10} y={y + 4} textAnchor="end" fill="#52635D" fontSize="11">
                  {formatPKR(tick, { compact: true })}
                </text>
              </g>
            );
          })}

          {xTickIndexes.map((index) => {
            const x = getX(index);
            return (
              <g key={index}>
                <line x1={x} y1={margin.top} x2={x} y2={margin.top + plotHeight} stroke="#E5EBE8" strokeWidth="1" />
                <text x={x} y={height - 20} textAnchor="middle" fill="#52635D" fontSize="11">
                  {index === 0 ? 'Start' : `Year ${timeline[index].year}`}
                </text>
              </g>
            );
          })}

          <text x={14} y={margin.top + plotHeight / 2} transform={`rotate(-90 14 ${margin.top + plotHeight / 2})`} textAnchor="middle" fill="#52635D" fontSize="11" fontWeight="600">
            Portfolio value (PKR)
          </text>
          <text x={margin.left + plotWidth / 2} y={height - 2} textAnchor="middle" fill="#52635D" fontSize="11" fontWeight="600">
            Investment timeline
          </text>

          <path
            d={`${makePath('nominalPortfolioValue')} L ${getX(timeline.length - 1)} ${margin.top + plotHeight} L ${getX(0)} ${margin.top + plotHeight} Z`}
            fill="url(#portfolio-area)"
            pointerEvents="none"
          />
          <path d={makePath('totalContributions')} fill="none" stroke="#8A9A93" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
          <path d={makePath('realPurchasingPower')} fill="none" stroke="#52635D" strokeWidth="2" strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
          <path d={makePath('nominalPortfolioValue')} fill="none" stroke="#176B52" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />

          {selected && activeIndex !== null && (
            <g pointerEvents="none">
              <line x1={selectedX} y1={margin.top} x2={selectedX} y2={margin.top + plotHeight} stroke="#176B52" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={selectedX} cy={getY(selected.nominalPortfolioValue)} r="5" fill="#FFFFFF" stroke="#176B52" strokeWidth="3" />
              <circle cx={selectedX} cy={getY(selected.totalContributions)} r="4" fill="#FFFFFF" stroke="#8A9A93" strokeWidth="2.5" />
              <circle cx={selectedX} cy={getY(selected.realPurchasingPower)} r="4" fill="#FFFFFF" stroke="#52635D" strokeWidth="2" />
            </g>
          )}
        </svg>
      </div>

      {selected && (
        <div
          className={`pointer-events-none absolute top-5 z-10 min-w-[190px] rounded-xl border border-[#B8CCC4] bg-white p-3 text-[11px] shadow-lg ${tooltipLeft > 67 ? '-translate-x-full' : tooltipLeft < 33 ? '' : '-translate-x-1/2'}`}
          style={{ left: `${Math.max(3, Math.min(97, tooltipLeft))}%` }}
          role="status"
          data-testid="projection-tooltip"
        >
          <div className="mb-2 font-bold text-[#172522]">{selected.year === 0 ? 'Starting point' : `End of year ${selected.year}`}</div>
          <div className="space-y-1.5 tabular-nums">
            <div className="flex items-center justify-between gap-4"><span className="text-[#176B52]">Future portfolio</span><strong>{formatPKR(selected.nominalPortfolioValue, { useLakhFormat: showLakhFormat })}</strong></div>
            <div className="flex items-center justify-between gap-4"><span className="text-[#66756F]">Money invested</span><strong>{formatPKR(selected.totalContributions, { useLakhFormat: showLakhFormat })}</strong></div>
            <div className="flex items-center justify-between gap-4"><span className="text-[#52635D]">Buying power</span><strong>{formatPKR(selected.realPurchasingPower, { useLakhFormat: showLakhFormat })}</strong></div>
          </div>
        </div>
      )}
      <p className="px-2 pt-1 text-[10px] text-[#52635D] sm:hidden">Swipe the chart to see later years. Tap or drag to inspect values.</p>
    </div>
  );
};

export const Step4ReviewPlan: React.FC<Step4ReviewPlanProps> = ({
  plan,
  investmentChoice,
  stockHoldings = [],
  trackedWealth,
  onSavePlan,
  onBack,
  onNavigateStep,
  showLakhFormat,
}) => {
  const projection = calculateProjection(plan);
  const finalPoint = projection.timeline[projection.timeline.length - 1];

  // Cash kept outside investment
  const cashRemainingOutside = trackedWealth
    .filter((w) => w.category === 'emergency_cash')
    .reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#172522]">
          Here’s your starting plan.
        </h1>
        <p className="mt-1 text-sm text-[#52635D] leading-relaxed">
          Review your entered numbers, commitments, and mathematical outcome before saving your plan.
        </p>
      </div>

      {/* Compact Plan Summary with Edit Actions for Each Section */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-[#172522] border-b border-[#D5DFDA] pb-2">
          Your Plan Summary
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* 1. Investments today */}
          <div className="bg-[#F8FAF9] p-3 rounded-xl border border-[#D5DFDA] flex items-start justify-between">
            <div>
              <span className="text-[#52635D] block">Investments today</span>
              <span className="font-bold text-[#172522] tabular-nums text-sm">
                {formatPKR(plan.existingInvestmentsToProject, { useLakhFormat: showLakhFormat })}
              </span>
              <span className="text-[11px] text-[#52635D] block mt-0.5">
                {investmentChoice === 'fresh'
                  ? 'Starting fresh'
                  : stockHoldings.length > 0
                  ? `${stockHoldings.length} ${stockHoldings.length === 1 ? 'holding' : 'holdings'} entered`
                  : 'Current portfolio value'}
              </span>
              {stockHoldings.some(
                (h) => h.priceStatus === 'price_needs_updating' || h.priceStatus === 'unverified_saved'
              ) && (
                <span className="text-[10px] text-amber-800 font-semibold inline-flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 text-amber-700" />
                  Prices need review
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigateStep(1)}
              className="text-[#176B52] hover:underline font-semibold flex items-center gap-1 min-h-[36px] px-1"
              aria-label="Edit investments today"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>

          {/* 2. Extra cash being invested now */}
          <div className="bg-[#F8FAF9] p-3 rounded-xl border border-[#D5DFDA] flex items-start justify-between">
            <div>
              <span className="text-[#52635D] block">Extra cash invested now</span>
              <span className="font-bold text-[#172522] tabular-nums text-sm">
                {formatPKR(plan.cashAvailableToInvest, { useLakhFormat: showLakhFormat })}
              </span>
              <span className="text-[11px] text-[#52635D] block mt-0.5">
                Initial lump-sum deployment
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateStep(1)}
              className="text-[#176B52] hover:underline font-semibold flex items-center gap-1 min-h-[36px] px-1"
              aria-label="Edit cash invested now"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>

          {/* 3. Cash remaining outside investment */}
          <div className="bg-[#F8FAF9] p-3 rounded-xl border border-[#D5DFDA] flex items-start justify-between">
            <div>
              <span className="text-[#52635D] block">Cash outside investment</span>
              <span className="font-bold text-[#172522] tabular-nums text-sm">
                {cashRemainingOutside > 0
                  ? formatPKR(cashRemainingOutside, { useLakhFormat: showLakhFormat })
                  : 'Kept separate'}
              </span>
              <span className="text-[11px] text-[#52635D] block mt-0.5">
                Emergency cushion / bank savings
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateStep(1)}
              className="text-[#176B52] hover:underline font-semibold flex items-center gap-1 min-h-[36px] px-1"
              aria-label="Edit cash outside investment"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>

          {/* 4. Monthly investment */}
          <div className="bg-[#F8FAF9] p-3 rounded-xl border border-[#D5DFDA] flex items-start justify-between">
            <div>
              <span className="text-[#52635D] block">Monthly investment</span>
              <span className="font-bold text-[#172522] tabular-nums text-sm">
                {formatPKR(plan.monthlyInvestment, { useLakhFormat: showLakhFormat })}/mo
              </span>
              <span className="text-[11px] text-[#52635D] block mt-0.5">
                Committed monthly regular SIP
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateStep(2)}
              className="text-[#176B52] hover:underline font-semibold flex items-center gap-1 min-h-[36px] px-1"
              aria-label="Edit monthly investment"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>

          {/* 5. Annual increase */}
          <div className="bg-[#F8FAF9] p-3 rounded-xl border border-[#D5DFDA] flex items-start justify-between">
            <div>
              <span className="text-[#52635D] block">Annual increase</span>
              <span className="font-bold text-[#172522] tabular-nums text-sm">
                {plan.annualStepUpPercent > 0
                  ? `+${plan.annualStepUpPercent}% / year`
                  : 'Keep it the same (0%)'}
              </span>
              <span className="text-[11px] text-[#52635D] block mt-0.5">
                {plan.annualStepUpPercent > 0 ? 'Starts month 13' : 'Constant monthly contribution'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateStep(2)}
              className="text-[#176B52] hover:underline font-semibold flex items-center gap-1 min-h-[36px] px-1"
              aria-label="Edit annual increase"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>

          {/* 6. Time period */}
          <div className="bg-[#F8FAF9] p-3 rounded-xl border border-[#D5DFDA] flex items-start justify-between">
            <div>
              <span className="text-[#52635D] block">Time period & assumptions</span>
              <span className="font-bold text-[#172522] tabular-nums text-sm">
                {plan.assumptions.timeHorizonYears} years
              </span>
              <span className="text-[11px] text-[#52635D] block mt-0.5">
                {(plan.assumptions.assumedAnnualReturnRate * 100).toFixed(1)}% return · {(plan.assumptions.assumedAnnualInflationRate * 100).toFixed(1)}% inflation
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigateStep(3)}
              className="text-[#176B52] hover:underline font-semibold flex items-center gap-1 min-h-[36px] px-1"
              aria-label="Edit time period and assumptions"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Outcome Section with Clear Assumption Label */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-6">
        <div>
          <span className="text-xs font-semibold text-[#52635D] block">
            With these assumptions, your investments could reach…
          </span>
          <div className="text-3xl sm:text-4xl font-extrabold text-[#172522] tabular-nums mt-1.5">
            {formatPKR(finalPoint.nominalPortfolioValue, { useLakhFormat: showLakhFormat })}
          </div>
          <span className="text-xs text-[#52635D] mt-1 block">
            Nominal future portfolio value in {plan.assumptions.timeHorizonYears} years.
          </span>
        </div>

        {/* 5 Distinct Financial Dimensions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#D5DFDA] text-xs">
          {/* Starting investment */}
          <div className="p-3 bg-[#F8FAF9] rounded-xl border border-[#D5DFDA]">
            <span className="text-[#52635D] block text-[11px]">Starting investment</span>
            <span className="text-base font-bold text-[#172522] tabular-nums mt-0.5 block">
              {formatPKR(projection.openingCapital, { useLakhFormat: showLakhFormat })}
            </span>
            <span className="text-[11px] text-[#52635D]">
              Existing holdings + deployable cash
            </span>
          </div>

          {/* Money added over time */}
          <div className="p-3 bg-[#F8FAF9] rounded-xl border border-[#D5DFDA]">
            <span className="text-[#52635D] block text-[11px]">Money added over time</span>
            <span className="text-base font-bold text-[#172522] tabular-nums mt-0.5 block">
              {formatPKR(projection.totalMonthlyDeposits, { useLakhFormat: showLakhFormat })}
            </span>
            <span className="text-[11px] text-[#52635D]">
              Total monthly contributions added
            </span>
          </div>

          {/* Investment growth */}
          <div className="p-3 bg-[#F8FAF9] rounded-xl border border-[#D5DFDA]">
            <span className="text-[#176B52] font-semibold block text-[11px]">Investment growth</span>
            <span className="text-base font-bold text-[#176B52] tabular-nums mt-0.5 block">
              +{formatPKR(projection.totalGrowth, { useLakhFormat: showLakhFormat })}
            </span>
            <span className="text-[11px] text-[#52635D]">
              Hypothetical compound gains
            </span>
          </div>
        </div>

        {/* Buying power in today's money banner */}
        <div className="p-3.5 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div>
            <span className="font-bold text-[#172522] block">
              Buying power in today’s money
            </span>
            <span className="text-[#52635D] text-[11px]">
              {plan.assumptions.assumedAnnualInflationRate > 0
                ? `Estimated purchasing power after discounting for ${(plan.assumptions.assumedAnnualInflationRate * 100).toFixed(0)}% annual inflation.`
                : 'Unadjusted for inflation (0% inflation assumption).'}
            </span>
          </div>
          <span className="text-lg font-extrabold text-[#176B52] tabular-nums shrink-0">
            {formatPKR(finalPoint.realPurchasingPower, { useLakhFormat: showLakhFormat })}
          </span>
        </div>

        {/* Clean, readable chart */}
        <div className="space-y-2 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#52635D] gap-2">
            <span className="font-semibold text-[#172522]">Growth trajectory</span>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#176B52]" />
                Future portfolio
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-[#52635D]" />
                Total money invested
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 border-t border-dashed border-[#52635D]" />
                Buying power
              </span>
            </div>
          </div>

          <ProjectionChart timeline={projection.timeline} showLakhFormat={showLakhFormat} />
        </div>
      </div>

      {/* Primary Action Button: Save my plan */}
      <div className="pt-2 space-y-2">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 bg-[#FFFFFF] border border-[#D5DFDA] text-[#172522] font-semibold text-sm rounded-xl hover:bg-[#F8FAF9] transition-colors text-center"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onSavePlan}
            className="w-full sm:w-auto flex-1 min-h-[48px] px-6 py-2.5 bg-[#176B52] hover:bg-[#11543F] text-white font-bold text-base rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99]"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Save my plan</span>
          </button>
        </div>

        {/* Reassurance note */}
        <p className="text-xs text-[#52635D] text-center pt-1">
          Saving stores this plan on your device. Saving does not place trades or move money.
        </p>
      </div>
    </div>
  );
};
