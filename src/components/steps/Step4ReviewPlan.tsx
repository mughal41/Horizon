import React from 'react';
import {
  HorizonPlan,
  InvestmentStatusChoice,
  TrackedWealthItem,
  StockHolding,
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

  // SVG dimensions
  const chartHeight = 160;
  const chartWidth = 360;
  const maxVal = Math.max(1, finalPoint.nominalPortfolioValue);
  const count = projection.timeline.length;
  const getX = (idx: number) => (idx / (count - 1 || 1)) * (chartWidth - 40) + 20;
  const getY = (val: number) => chartHeight - (val / maxVal) * (chartHeight - 35) - 15;

  const nominalPath = projection.timeline
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.nominalPortfolioValue)}`)
    .join(' ');
  const investedPath = projection.timeline
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.totalContributions)}`)
    .join(' ');
  const realPath = projection.timeline
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.realPurchasingPower)}`)
    .join(' ');

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

          <div className="w-full bg-[#F8FAF9] rounded-xl border border-[#D5DFDA] p-2.5 overflow-hidden">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-40 sm:h-48 overflow-visible"
            >
              <line x1="20" y1="20" x2={chartWidth - 20} y2="20" stroke="#EAEAEA" strokeWidth="1" />
              <line x1="20" y1={chartHeight / 2} x2={chartWidth - 20} y2={chartHeight / 2} stroke="#EAEAEA" strokeWidth="1" />
              <line x1="20" y1={chartHeight - 15} x2={chartWidth - 20} y2={chartHeight - 15} stroke="#D5DFDA" strokeWidth="1" />

              <path d={investedPath} fill="none" stroke="#8A9A93" strokeWidth="2" strokeLinecap="round" />
              <path d={realPath} fill="none" stroke="#52635D" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
              <path d={nominalPath} fill="none" stroke="#176B52" strokeWidth="2.5" strokeLinecap="round" />

              <circle cx={getX(count - 1)} cy={getY(finalPoint.nominalPortfolioValue)} r="4" fill="#176B52" />
            </svg>
            <div className="flex justify-between text-[11px] text-[#52635D] px-3 pt-1 font-mono">
              <span>Start</span>
              <span>Year {Math.round(plan.assumptions.timeHorizonYears / 2)}</span>
              <span>Year {plan.assumptions.timeHorizonYears}</span>
            </div>
          </div>
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
