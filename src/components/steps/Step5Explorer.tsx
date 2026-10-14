/**
 * Step 5: Saved Plan Overview & Downside Scenario Explorer ("What if things go wrong?")
 */

import React, { useState } from 'react';
import { HorizonPlan, InvestmentStatusChoice, StockHolding, UserAssumptions } from '../../types/horizon';
import { LATEST_OFFICIAL_INFLATION } from '../../data/pakistanInflation';
import {
  formatPKR,
  calculateProjection,
  translateAnnualIncreases,
} from '../../utils/finance';
import {
  calculateScenarioProjection,
  StressScenarioType,
} from '../../utils/scenarios';
import { NumberInputWithSlider } from '../NumberInputWithSlider';
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Download,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  HelpCircle,
  X,
  TrendingDown,
  Calendar,
  PauseCircle,
  RefreshCw,
  Info,
} from 'lucide-react';

interface Step5ExplorerProps {
  plan: HorizonPlan;
  investmentChoice: InvestmentStatusChoice | null;
  stockHoldings: StockHolding[];
  onChangeMonthlyInvestment: (val: number) => void;
  onChangeAnnualStepUp: (val: number) => void;
  onChangeAssumptions: (assumptions: UserAssumptions) => void;
  onNavigateStep: (step: number) => void;
  showLakhFormat: boolean;
  onStartJourney?: () => void;
  hasActiveJourney?: boolean;
}

export const Step5Explorer: React.FC<Step5ExplorerProps> = ({
  plan,
  investmentChoice,
  stockHoldings,
  onChangeMonthlyInvestment,
  onChangeAnnualStepUp,
  onChangeAssumptions,
  onNavigateStep,
  showLakhFormat,
  onStartJourney,
  hasActiveJourney,
}) => {
  const [showAdjustments, setShowAdjustments] = useState<boolean>(false);
  const [showYearlyTable, setShowYearlyTable] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Downside scenario modal / panel state
  const [scenarioOpen, setScenarioOpen] = useState<boolean>(false);
  const [scenarioType, setScenarioType] = useState<StressScenarioType>('market_fall');

  // Scenario specific parameters
  const [marketFallDrop, setMarketFallDrop] = useState<number>(30);
  const [marketFallMonth, setMarketFallMonth] = useState<number>(1);

  const [zeroGrowthStartYear, setZeroGrowthStartYear] = useState<number>(2);
  const [zeroGrowthDuration, setZeroGrowthDuration] = useState<number>(2);

  const [pauseStartMonth, setPauseStartMonth] = useState<number>(13);
  const [pauseDurationMonths, setPauseDurationMonths] = useState<number>(6);

  const [slowerGrowthRate, setSlowerGrowthRate] = useState<number>(5); // 5% p.a.

  const [recoveryDetailsOpen, setRecoveryDetailsOpen] = useState<boolean>(false);

  const projection = calculateProjection(plan);
  const finalPoint = projection.timeline[projection.timeline.length - 1];

  // Calculate scenario comparison
  const scenarioResult = calculateScenarioProjection(plan, {
    type: scenarioType,
    marketFall: { dropPercent: marketFallDrop, targetMonth: marketFallMonth },
    zeroGrowth: { startYear: zeroGrowthStartYear, durationYears: zeroGrowthDuration },
    contributionPause: { startMonth: pauseStartMonth, durationMonths: pauseDurationMonths },
    slowerGrowth: { annualReturnRate: slowerGrowthRate / 100 },
  });

  const translations = translateAnnualIncreases(
    plan.monthlyInvestment,
    plan.annualStepUpPercent,
    plan.assumptions.timeHorizonYears
  );

  const updateAssumption = <K extends keyof UserAssumptions>(
    field: K,
    val: UserAssumptions[K]
  ) => {
    onChangeAssumptions({
      ...plan.assumptions,
      [field]: val,
    });
  };

  const handleCopySummary = () => {
    const text = `Horizon Saved Plan
Starting Investment: ${formatPKR(projection.openingCapital)}
Saved Monthly: ${formatPKR(plan.monthlyInvestment)}/mo
Annual Increase: ${plan.annualStepUpPercent > 0 ? `+${plan.annualStepUpPercent}%/yr` : '0% (Constant)'}
Time Horizon: ${plan.assumptions.timeHorizonYears} years
Assumed Annual Return: ${(plan.assumptions.assumedAnnualReturnRate * 100).toFixed(1)}% p.a.
Assumed Annual Inflation: ${(plan.assumptions.assumedAnnualInflationRate * 100).toFixed(1)}% p.a.
Projected Ending Value: ${formatPKR(finalPoint.nominalPortfolioValue)}
Today's Purchasing Power: ${formatPKR(finalPoint.realPurchasingPower)}
Created with Horizon.`;

    navigator.clipboard?.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  // Determine one relevant next step
  let nextStepTitle = '';
  let nextStepDescription = '';
  let nextStepActionLabel = '';
  let nextStepTarget = 1;

  if (investmentChoice === 'fresh') {
    nextStepTitle = 'Record your actual holdings as you begin';
    nextStepDescription =
      'You are starting fresh. As you purchase your first shares or mutual fund units, you can record them here to track your progress against this plan.';
    nextStepActionLabel = 'Add holding';
    nextStepTarget = 1;
  } else if (investmentChoice === 'total_value') {
    nextStepTitle = 'Break down your portfolio into individual holdings';
    nextStepDescription =
      'You entered a total estimated value. Whenever convenient, you can list your specific stocks or fund units for a clearer picture.';
    nextStepActionLabel = 'List individual holdings';
    nextStepTarget = 1;
  } else {
    nextStepTitle = 'Set an annual review reminder';
    nextStepDescription =
      'Your plan is saved. Review your monthly contribution and assumptions once a year as your earnings grow or circumstances change.';
    nextStepActionLabel = 'Review assumptions';
    nextStepTarget = 3;
  }

  return (
    <div className="space-y-6">
      {/* Saved Plan Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-[#176B52]" />
          <span className="text-xs font-bold text-[#176B52] uppercase tracking-wider">
            Plan Saved on This Device
          </span>
        </div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#172522]">
          Your Plan Overview
        </h1>
        <p className="mt-1 text-sm text-[#52635D] leading-relaxed">
          Here is your saved investing plan. You can adjust your numbers anytime or explore downside scenarios.
        </p>
      </div>

      {/* Main Projection & Saved Monthly Amount Card */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-[#52635D] uppercase tracking-wider block">
              Projected in {plan.assumptions.timeHorizonYears} years
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#172522] tabular-nums mt-1">
              {formatPKR(finalPoint.nominalPortfolioValue, { useLakhFormat: showLakhFormat })}
            </div>
            <span className="text-xs text-[#52635D] mt-0.5 block">
              With {(plan.assumptions.assumedAnnualReturnRate * 100).toFixed(1)}% annual return assumption
            </span>
          </div>

          <div className="bg-[#EAF4EF] p-3 sm:p-4 rounded-xl border border-[#176B52]/30 text-left sm:text-right shrink-0">
            <span className="text-[11px] font-semibold text-[#176B52] uppercase tracking-wider block">
              Saved Monthly Investment
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-[#176B52] tabular-nums block mt-0.5">
              {formatPKR(plan.monthlyInvestment, { useLakhFormat: showLakhFormat })}/mo
            </span>
            <span className="text-[11px] text-[#52635D] block mt-0.5">
              {plan.annualStepUpPercent > 0
                ? `+${plan.annualStepUpPercent}% annual increase`
                : 'Constant monthly amount'}
            </span>
          </div>
        </div>

        {/* 4 Financial Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#D5DFDA] text-xs">
          <div>
            <span className="text-[#52635D] block text-[11px]">Starting capital</span>
            <span className="text-sm sm:text-base font-bold text-[#172522] tabular-nums">
              {formatPKR(projection.openingCapital, { compact: true })}
            </span>
          </div>
          <div>
            <span className="text-[#52635D] block text-[11px]">Money added over time</span>
            <span className="text-sm sm:text-base font-bold text-[#172522] tabular-nums">
              {formatPKR(projection.totalMonthlyDeposits, { compact: true })}
            </span>
          </div>
          <div>
            <span className="text-[#176B52] font-semibold block text-[11px]">Investment growth</span>
            <span className="text-sm sm:text-base font-bold text-[#176B52] tabular-nums">
              +{formatPKR(projection.totalGrowth, { compact: true })}
            </span>
          </div>
          <div>
            <span className="text-[#52635D] block text-[11px]">Today&apos;s buying power</span>
            <span className="text-sm sm:text-base font-bold text-[#172522] tabular-nums">
              {formatPKR(finalPoint.realPurchasingPower, { compact: true })}
            </span>
          </div>
        </div>

        {/* Primary Actions: Start my journey, Adjust my plan & What if things go wrong? */}
        <div className="pt-2 flex flex-col sm:flex-row flex-wrap items-center gap-3">
          {onStartJourney && (
            <button
              type="button"
              onClick={onStartJourney}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-[#176B52] hover:bg-[#11543F] text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99]"
            >
              <Calendar className="w-4 h-4" />
              <span>{hasActiveJourney ? 'View my journey' : 'Start my journey'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAdjustments(!showAdjustments)}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-white border border-[#D5DFDA] hover:bg-[#F8FAF9] text-[#172522] font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{showAdjustments ? 'Hide adjustments' : 'Adjust my plan'}</span>
          </button>

          <button
            type="button"
            onClick={() => setScenarioOpen(true)}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-[#EAF4EF] hover:bg-[#D5EBE2] text-[#176B52] border border-[#176B52]/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 text-[#176B52]" />
            <span>What if things go wrong?</span>
          </button>

          <button
            type="button"
            onClick={handleCopySummary}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-white border border-[#D5DFDA] hover:bg-[#F8FAF9] text-[#172522] font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {copiedNotification ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#176B52]" />
                <span>Copied to clipboard</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-[#52635D]" />
                <span>Copy summary</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* DOWNSIDE SCENARIO PANEL ("What if things go wrong?") */}
      {scenarioOpen && (
        <div className="bg-[#FFFFFF] border-2 border-[#176B52] rounded-2xl p-5 sm:p-7 shadow-lg space-y-6 animate-in fade-in duration-200">
          <div className="flex items-start justify-between pb-3 border-b border-[#D5DFDA]">
            <div>
              <span className="text-xs font-bold text-[#176B52] uppercase tracking-wider block">
                Hypothetical Stress Scenario Explorer
              </span>
              <h3 className="text-lg font-bold text-[#172522] mt-0.5">
                See how a difficult period could affect your plan.
              </h3>
              <p className="text-xs text-[#52635D] mt-0.5">
                These stress scenarios are hypothetical examples for planning resilience—not market predictions or historical backtests.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScenarioOpen(false)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#52635D] hover:text-[#172522] rounded-lg"
              aria-label="Close scenario panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scenario Selector Tabs */}
          <div>
            <label className="text-xs font-semibold text-[#172522] block mb-2">
              Select a scenario to explore:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={scenarioType === 'market_fall'}
                onClick={() => setScenarioType('market_fall')}
                className={`p-3 text-left rounded-xl border text-xs font-semibold transition-all flex flex-col gap-1 min-h-[72px] ${
                  scenarioType === 'market_fall'
                    ? 'bg-[#EAF4EF] border-[#176B52] text-[#176B52]'
                    : 'bg-white border-[#D5DFDA] text-[#52635D] hover:border-[#B8C7C0]'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                <span>Sudden market fall</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={scenarioType === 'zero_growth'}
                onClick={() => setScenarioType('zero_growth')}
                className={`p-3 text-left rounded-xl border text-xs font-semibold transition-all flex flex-col gap-1 min-h-[72px] ${
                  scenarioType === 'zero_growth'
                    ? 'bg-[#EAF4EF] border-[#176B52] text-[#176B52]'
                    : 'bg-white border-[#D5DFDA] text-[#52635D] hover:border-[#B8C7C0]'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Years without growth</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={scenarioType === 'contribution_pause'}
                onClick={() => setScenarioType('contribution_pause')}
                className={`p-3 text-left rounded-xl border text-xs font-semibold transition-all flex flex-col gap-1 min-h-[72px] ${
                  scenarioType === 'contribution_pause'
                    ? 'bg-[#EAF4EF] border-[#176B52] text-[#176B52]'
                    : 'bg-white border-[#D5DFDA] text-[#52635D] hover:border-[#B8C7C0]'
                }`}
              >
                <PauseCircle className="w-4 h-4" />
                <span>Break from investing</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={scenarioType === 'slower_growth'}
                onClick={() => setScenarioType('slower_growth')}
                className={`p-3 text-left rounded-xl border text-xs font-semibold transition-all flex flex-col gap-1 min-h-[72px] ${
                  scenarioType === 'slower_growth'
                    ? 'bg-[#EAF4EF] border-[#176B52] text-[#176B52]'
                    : 'bg-white border-[#D5DFDA] text-[#52635D] hover:border-[#B8C7C0]'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Slower growth rate</span>
              </button>
            </div>
          </div>

          {/* Controls relevant to selected scenario */}
          <div className="p-4 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl space-y-4">
            {scenarioType === 'market_fall' && (
              <div className="space-y-4">
                <NumberInputWithSlider
                  id="market-fall-drop"
                  label="Size of sudden drop"
                  value={marketFallDrop}
                  onChange={setMarketFallDrop}
                  min={10}
                  max={60}
                  step={5}
                  unitSuffix="%"
                  quickPresets={[
                    { label: '20% drop', value: 20 },
                    { label: '30% drop (Example)', value: 30 },
                    { label: '40% drop', value: 40 },
                    { label: '50% drop', value: 50 },
                  ]}
                  helperText="This example assumes a one-time fall applied to your equity balance. Afterwards, growth returns to your chosen assumption. Cash outside equities is protected."
                />

                <NumberInputWithSlider
                  id="market-fall-month"
                  label="When does the fall happen? (Month)"
                  value={marketFallMonth}
                  onChange={setMarketFallMonth}
                  min={1}
                  max={Math.min(60, plan.assumptions.timeHorizonYears * 12)}
                  step={1}
                  unitSuffix=" month"
                  quickPresets={[
                    { label: 'Month 1', value: 1 },
                    { label: 'Month 12', value: 12 },
                    { label: 'Month 24', value: 24 },
                  ]}
                />
              </div>
            )}

            {scenarioType === 'zero_growth' && (
              <div className="space-y-4">
                <NumberInputWithSlider
                  id="zero-growth-start"
                  label="Start year of flat market period"
                  value={zeroGrowthStartYear}
                  onChange={setZeroGrowthStartYear}
                  min={1}
                  max={plan.assumptions.timeHorizonYears}
                  step={1}
                  unitSuffix=" year"
                />

                <NumberInputWithSlider
                  id="zero-growth-duration"
                  label="Duration (years without growth)"
                  value={zeroGrowthDuration}
                  onChange={setZeroGrowthDuration}
                  min={1}
                  max={Math.max(1, plan.assumptions.timeHorizonYears - zeroGrowthStartYear + 1)}
                  step={1}
                  unitSuffix=" years"
                  helperText="During this period, investment return is set to 0% p.a. Regular monthly contributions continue, and inflation remains active."
                />
              </div>
            )}

            {scenarioType === 'contribution_pause' && (
              <div className="space-y-4">
                <NumberInputWithSlider
                  id="pause-start-month"
                  label="Start month of investment pause"
                  value={pauseStartMonth}
                  onChange={setPauseStartMonth}
                  min={1}
                  max={plan.assumptions.timeHorizonYears * 12}
                  step={1}
                  unitSuffix=" month"
                />

                <NumberInputWithSlider
                  id="pause-duration"
                  label="Pause duration (months)"
                  value={pauseDurationMonths}
                  onChange={setPauseDurationMonths}
                  min={1}
                  max={36}
                  step={1}
                  unitSuffix=" months"
                  quickPresets={[
                    { label: '3 mos', value: 3 },
                    { label: '6 mos', value: 6 },
                    { label: '12 mos', value: 12 },
                  ]}
                  helperText="Contributions are paused to zero during this window. Previously invested money continues earning returns. Your annual step-up schedule resumes normally afterwards without automatic catch-up."
                />
              </div>
            )}

            {scenarioType === 'slower_growth' && (
              <div className="space-y-4">
                <NumberInputWithSlider
                  id="slower-growth-rate"
                  label="Scenario effective annual return"
                  value={slowerGrowthRate}
                  onChange={setSlowerGrowthRate}
                  min={-20}
                  max={25}
                  step={0.5}
                  unitSuffix="% p.a."
                  quickPresets={[
                    { label: '-5% (Loss)', value: -5 },
                    { label: '0% (Flat)', value: 0 },
                    { label: '4% p.a.', value: 4 },
                    { label: '8% p.a.', value: 8 },
                  ]}
                  helperText="Applies a lower effective annual return across the entire plan horizon to test sluggish growth or continuous losses."
                />
              </div>
            )}
          </div>

          {/* Comparison Results Card */}
          <div className="p-4 sm:p-5 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-[#176B52] uppercase tracking-wider block">
                  Scenario Comparison
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-[#172522] tabular-nums mt-0.5 block">
                  {formatPKR(scenarioResult.scenarioEndingValue, { useLakhFormat: showLakhFormat })}
                </span>
                <span className="text-xs text-[#52635D] mt-0.5 block">
                  Original plan ending value: {formatPKR(scenarioResult.originalEndingValue, { useLakhFormat: showLakhFormat })}
                </span>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs font-semibold text-[#52635D] block">Difference</span>
                <span className={`text-base sm:text-lg font-extrabold tabular-nums block ${scenarioResult.nominalDifference < 0 ? 'text-rose-700' : 'text-[#176B52]'}`}>
                  {scenarioResult.nominalDifference >= 0 ? '+' : ''}{formatPKR(scenarioResult.nominalDifference, { useLakhFormat: showLakhFormat })}
                </span>
              </div>
            </div>

            {/* Factual Takeaway */}
            <p className="text-xs font-semibold text-[#172522] pt-2 border-t border-[#176B52]/20">
              {scenarioResult.factualTakeaway}
            </p>

            {/* Contribution differences if paused */}
            {scenarioResult.contributionDifference !== 0 && (
              <p className="text-xs text-[#52635D]">
                Total money contributed changes by {formatPKR(scenarioResult.contributionDifference, { useLakhFormat: showLakhFormat })} due to the pause. Note that part of the ending shortfall comes from contributing less, not purely investment loss.
              </p>
            )}

            {/* Recovery info for market fall */}
            {scenarioResult.recoveryInfo && (
              <div className="pt-2 border-t border-[#176B52]/20 text-xs space-y-1">
                <div className="flex items-center justify-between font-semibold text-[#172522]">
                  <span>Market Drawdown & Recovery (In this example)</span>
                  <button
                    type="button"
                    onClick={() => setRecoveryDetailsOpen(!recoveryDetailsOpen)}
                    className="text-[#176B52] hover:underline inline-flex items-center gap-1"
                  >
                    <span>{recoveryDetailsOpen ? 'Hide details' : 'How recovery is calculated'}</span>
                    <Info className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[#52635D]">
                  {scenarioResult.recoveryInfo.recovered
                    ? `Investment series recovered its previous peak by Year ${scenarioResult.recoveryInfo.recoveryYear} (Month ${scenarioResult.recoveryInfo.recoveryMonth}).`
                    : `Did not recover previous peak within this plan horizon.`}
                </p>

                {recoveryDetailsOpen && (
                  <div className="mt-2 p-3 bg-white border border-[#176B52]/20 rounded-lg text-xs text-[#52635D] space-y-1">
                    <p>• <strong>Drawdown:</strong> {scenarioResult.recoveryInfo.drawdownPct}% drop applied at Month {marketFallMonth}.</p>
                    <p>• <strong>Unitized tracking:</strong> Calculated using a return-only performance series that excludes external contributions. New deposits do not mask underlying investment losses.</p>
                    <p>• <strong>Assumption:</strong> Recovery depends entirely on assumed returns after the fall.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setMarketFallDrop(30);
                setMarketFallMonth(1);
                setZeroGrowthStartYear(2);
                setZeroGrowthDuration(2);
                setPauseStartMonth(13);
                setPauseDurationMonths(6);
                setSlowerGrowthRate(5);
              }}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-white border border-[#D5DFDA] hover:bg-[#F8FAF9] text-[#172522] font-semibold text-xs rounded-xl transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset scenario</span>
            </button>

            <button
              type="button"
              onClick={() => setScenarioOpen(false)}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-[#176B52] hover:bg-[#11543F] text-white font-bold text-xs rounded-xl transition-all shadow-xs"
            >
              Back to my plan
            </button>
          </div>
        </div>
      )}

      {/* One Relevant Next Step Card */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-[#176B52] uppercase tracking-wider block">
            Recommended Next Step
          </span>
          <h2 className="text-sm font-bold text-[#172522]">
            {nextStepTitle}
          </h2>
          <p className="text-xs text-[#52635D] leading-relaxed max-w-lg">
            {nextStepDescription}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateStep(nextStepTarget)}
          className="shrink-0 min-h-[44px] px-4 py-2 bg-[#EAF4EF] hover:bg-[#176B52] text-[#176B52] hover:text-white border border-[#176B52]/30 text-xs font-bold rounded-xl transition-all inline-flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-[#176B52]"
        >
          <span>{nextStepActionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Interactive Controls Drawer (Revealed when "Adjust my plan" is clicked) */}
      {showAdjustments && (
        <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-[#D5DFDA]">
            <h3 className="text-base font-bold text-[#172522] flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#176B52]" />
              <span>Adjust Your Numbers</span>
            </h3>
            <span className="text-xs text-[#52635D]">Updates calculate instantly</span>
          </div>

          {/* Monthly Investment */}
          <NumberInputWithSlider
            id="adjust-monthly"
            label="Monthly investment"
            value={plan.monthlyInvestment}
            onChange={onChangeMonthlyInvestment}
            min={0}
            max={Math.max(200000, Math.ceil((plan.monthlyInvestment * 1.25) / 10000) * 10000)}
            step={1000}
            unitPrefix="Rs. "
            formatAsCurrency
            quickPresets={[
              { label: 'Rs. 10k', value: 10000 },
              { label: 'Rs. 25k', value: 25000 },
              { label: 'Rs. 50k', value: 50000 },
              { label: 'Rs. 100k', value: 100000 },
            ]}
          />

          <div className="h-px bg-[#D5DFDA]" />

          {/* Annual Step-Up */}
          <div>
            <NumberInputWithSlider
              id="adjust-stepup"
              label="Increase your monthly investment each year"
              value={plan.annualStepUpPercent}
              onChange={onChangeAnnualStepUp}
              min={0}
              max={25}
              step={1}
              unitSuffix="%"
              quickPresets={[
                { label: '0% (Constant)', value: 0 },
                { label: '5% / yr', value: 5 },
                { label: '10% / yr', value: 10 },
                { label: '15% / yr', value: 15 },
              ]}
            />
            <div className="flex justify-between text-xs text-[#52635D] pt-2 font-mono tabular-nums">
              <span>Now: {formatPKR(translations.monthlyNow)}/mo</span>
              <span>Next yr: {formatPKR(translations.monthlyNextYear)}/mo</span>
              <span>Final yr: {formatPKR(translations.monthlyFinalYear)}/mo</span>
            </div>
          </div>

          <div className="h-px bg-[#D5DFDA]" />

          {/* Horizon */}
          <NumberInputWithSlider
            id="adjust-years"
            label="Time horizon (years)"
            value={plan.assumptions.timeHorizonYears}
            onChange={(val) => updateAssumption('timeHorizonYears', val)}
            min={1}
            max={35}
            step={1}
            unitSuffix=" years"
            quickPresets={[
              { label: '5 yrs', value: 5 },
              { label: '10 yrs', value: 10 },
              { label: '15 yrs', value: 15 },
              { label: '20 yrs', value: 20 },
            ]}
          />

          <div className="h-px bg-[#D5DFDA]" />

          {/* Assumptions */}
          <div className="space-y-4 pt-1">
            <span className="text-xs font-bold text-[#172522] uppercase tracking-wider block">
              Planning Assumptions
            </span>

            <NumberInputWithSlider
              id="adjust-return"
              label="Assumed annual investment return (dividends included)"
              value={Math.round(plan.assumptions.assumedAnnualReturnRate * 1000) / 10}
              onChange={(val) => updateAssumption('assumedAnnualReturnRate', val / 100)}
              min={-5}
              max={25}
              step={0.5}
              unitSuffix="% p.a."
            />

            <NumberInputWithSlider
              id="adjust-inflation"
              label="Assumed future annual inflation"
              value={Math.round(plan.assumptions.assumedAnnualInflationRate * 1000) / 10}
              onChange={(val) => updateAssumption('assumedAnnualInflationRate', val / 100)}
              min={0}
              max={20}
              step={0.5}
              unitSuffix="% p.a."
              quickPresets={[
                { label: '0% (Nominal)', value: 0 },
                { label: '10%', value: 10 },
                { label: '12%', value: 12 },
              ]}
              helperText={`Official reference: on average, prices were ${LATEST_OFFICIAL_INFLATION.publishedPercentage}% higher in ${LATEST_OFFICIAL_INFLATION.referenceMonth} ${LATEST_OFFICIAL_INFLATION.referenceYear} than a year earlier (PBS national headline CPI). Your own expenses may rise at a different rate.`}
            />
          </div>
        </div>
      )}

      {/* Expandable Year-by-Year Table */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 shadow-xs">
        <button
          type="button"
          onClick={() => setShowYearlyTable(!showYearlyTable)}
          className="w-full flex items-center justify-between text-left focus-visible:ring-2 focus-visible:ring-[#176B52] rounded-lg"
        >
          <div>
            <h2 className="text-sm font-bold text-[#172522]">
              Year-by-Year Breakdown
            </h2>
            <p className="text-xs text-[#52635D] mt-0.5">
              Inspect monthly contributions, money added, and compound growth each year.
            </p>
          </div>
          <div className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#52635D]">
            {showYearlyTable ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {showYearlyTable && (
          <div className="mt-4 pt-4 border-t border-[#D5DFDA] overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#D5DFDA] text-[#52635D]">
                  <th className="py-2.5 pr-3 font-semibold">Period</th>
                  <th className="py-2.5 pr-3 font-semibold">Monthly Deposit</th>
                  <th className="py-2.5 pr-3 font-semibold">Money Added</th>
                  <th className="py-2.5 pr-3 font-semibold">Growth</th>
                  <th className="py-2.5 pr-3 font-semibold">Portfolio Value</th>
                  <th className="py-2.5 font-semibold">Purchasing Power</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5DFDA] tabular-nums">
                {projection.timeline.map((row) => (
                  <tr key={row.year} className="hover:bg-[#F8FAF9]">
                    <td className="py-2.5 pr-3 font-bold text-[#172522]">
                      {row.year === 0 ? 'Start' : `Year ${row.year}`}
                    </td>
                    <td className="py-2.5 pr-3 text-[#52635D]">
                      {formatPKR(row.monthlyContributionThisYear, { compact: true })}
                    </td>
                    <td className="py-2.5 pr-3 text-[#52635D]">
                      {formatPKR(row.totalContributions, { compact: true })}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-[#176B52]">
                      +{formatPKR(row.investmentGrowth, { compact: true })}
                    </td>
                    <td className="py-2.5 pr-3 font-bold text-[#172522]">
                      {formatPKR(row.nominalPortfolioValue, { useLakhFormat: showLakhFormat })}
                    </td>
                    <td className="py-2.5 text-[#52635D]">
                      {formatPKR(row.realPurchasingPower, { useLakhFormat: showLakhFormat })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review earlier answers */}
      <div className="pt-2 flex justify-start">
        <button
          type="button"
          onClick={() => onNavigateStep(1)}
          className="text-xs text-[#52635D] hover:text-[#172522] min-h-[44px] flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Review original setup answers</span>
        </button>
      </div>
    </div>
  );
};
