import React, { useState } from 'react';
import { MonthlyMethodChoice, AffordabilityBudget } from '../../types/horizon';
import {
  formatPKR,
  parseCleanNumber,
  calculateAvailableMonthlyMoney,
  translateAnnualIncreases,
} from '../../utils/finance';
import { NumberInputWithSlider } from '../NumberInputWithSlider';
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { InfoModal } from '../InfoModal';

interface Step2MonthlyInvestmentProps {
  monthlyChoice: MonthlyMethodChoice;
  budget: AffordabilityBudget;
  monthlyInvestment: number;
  annualStepUpPercent: number;
  timeHorizonYears: number;
  onChangeChoice: (choice: MonthlyMethodChoice) => void;
  onChangeBudget: (budget: AffordabilityBudget) => void;
  onChangeMonthlyInvestment: (val: number) => void;
  onChangeAnnualStepUp: (val: number) => void;
  onNext: () => void;
  onBack: () => void;
  showLakhFormat: boolean;
}

export const Step2MonthlyInvestment: React.FC<Step2MonthlyInvestmentProps> = ({
  monthlyChoice,
  budget,
  monthlyInvestment,
  annualStepUpPercent,
  timeHorizonYears,
  onChangeChoice,
  onChangeBudget,
  onChangeMonthlyInvestment,
  onChangeAnnualStepUp,
  onNext,
  onBack,
  showLakhFormat,
}) => {
  const [modalOpen, setModalOpen] = useState<'affordability' | 'stepup' | null>(null);

  // Explicit annual increase mode: preserved if restoring an existing plan with step-up > 0
  const [stepUpMode, setStepUpMode] = useState<'keep_same' | 'choose_increase'>(() =>
    annualStepUpPercent > 0 ? 'choose_increase' : 'keep_same'
  );

  const { income, expenses, cashSavingsCommitment, availableSurplus } =
    calculateAvailableMonthlyMoney(budget);

  const translations = translateAnnualIncreases(
    monthlyInvestment,
    annualStepUpPercent,
    timeHorizonYears
  );

  const updateBudgetField = <K extends keyof AffordabilityBudget>(
    field: K,
    val: number
  ) => {
    onChangeBudget({
      ...budget,
      [field]: val,
    });
  };

  const handleStepUpModeChange = (mode: 'keep_same' | 'choose_increase') => {
    setStepUpMode(mode);
    if (mode === 'keep_same') {
      onChangeAnnualStepUp(0);
    } else if (annualStepUpPercent === 0) {
      // Provide a clean starting percentage when user explicitly chooses to increase
      onChangeAnnualStepUp(10);
    }
  };

  // Only evaluate surplus comparison if user explicitly chose "Help me work it out"
  const isExceedingSurplus =
    monthlyChoice === 'help_me_work_it_out' &&
    income > 0 &&
    monthlyInvestment > availableSurplus &&
    availableSurplus > 0;

  const isNegativeSurplus =
    monthlyChoice === 'help_me_work_it_out' && income > 0 && availableSurplus <= 0;

  // Dynamic slider max: Standard convenient scale up to 200,000.
  // Gracefully expands if user enters a larger amount without losing the entered value.
  // Completely decoupled from budget surplus to keep routes independent.
  const sliderMax = Math.max(200000, Math.ceil((monthlyInvestment * 1.25) / 10000) * 10000);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#172522]">
          Do you know how much you want to invest each month?
        </h1>
        <p className="mt-1 text-sm text-[#52635D] leading-relaxed">
          Investing regularly creates long-term compounding. You can enter an amount directly or work out your monthly budget.
        </p>
      </div>

      {/* Choice Radio Group */}
      <div
        role="radiogroup"
        aria-label="Do you know how much you want to invest each month?"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <button
          type="button"
          role="radio"
          aria-checked={monthlyChoice === 'enter_amount'}
          onClick={() => onChangeChoice('enter_amount')}
          className={`p-4 text-left rounded-xl border transition-all flex flex-col justify-between min-h-[88px] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#176B52] ${
            monthlyChoice === 'enter_amount'
              ? 'bg-[#EAF4EF] border-[#176B52] shadow-xs'
              : 'bg-[#FFFFFF] border-[#D5DFDA] hover:border-[#B8C7C0]'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-base font-bold text-[#172522]">
              I’ll enter an amount
            </span>
            <span
              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                monthlyChoice === 'enter_amount'
                  ? 'border-[#176B52] bg-[#176B52]'
                  : 'border-[#D5DFDA] bg-white'
              }`}
            >
              {monthlyChoice === 'enter_amount' && (
                <span className="w-2 h-2 rounded-full bg-white" />
              )}
            </span>
          </div>
          <span className="text-xs text-[#52635D] mt-1.5 leading-snug">
            I already have a monthly target in mind.
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={monthlyChoice === 'help_me_work_it_out'}
          onClick={() => onChangeChoice('help_me_work_it_out')}
          className={`p-4 text-left rounded-xl border transition-all flex flex-col justify-between min-h-[88px] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#176B52] ${
            monthlyChoice === 'help_me_work_it_out'
              ? 'bg-[#EAF4EF] border-[#176B52] shadow-xs'
              : 'bg-[#FFFFFF] border-[#D5DFDA] hover:border-[#B8C7C0]'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-base font-bold text-[#172522]">
              Help me work it out
            </span>
            <span
              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                monthlyChoice === 'help_me_work_it_out'
                  ? 'border-[#176B52] bg-[#176B52]'
                  : 'border-[#D5DFDA] bg-white'
              }`}
            >
              {monthlyChoice === 'help_me_work_it_out' && (
                <span className="w-2 h-2 rounded-full bg-white" />
              )}
            </span>
          </div>
          <span className="text-xs text-[#52635D] mt-1.5 leading-snug">
            Review income, living costs, and money you’re setting aside.
          </span>
        </button>
      </div>

      {/* If "Help me work it out": Budget Breakdown */}
      {monthlyChoice === 'help_me_work_it_out' && (
        <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-[#D5DFDA]">
            <div>
              <h2 className="text-base font-bold text-[#172522]">
                Your monthly budget
              </h2>
              <p className="text-xs text-[#52635D] mt-0.5">
                We calculate what remains after your living expenses and savings commitments.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen('affordability')}
              className="text-xs text-[#176B52] hover:text-[#11543F] font-semibold inline-flex items-center gap-1 min-h-[44px] py-1 px-1 focus-visible:ring-2 focus-visible:ring-[#176B52] rounded-md"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>How this works</span>
            </button>
          </div>

          {/* Income */}
          <div>
            <label htmlFor="budget-income" className="text-xs font-semibold text-[#172522] block mb-1">
              Monthly take-home income
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#52635D] select-none pointer-events-none">
                Rs.
              </span>
              <input
                id="budget-income"
                type="text"
                inputMode="numeric"
                value={budget.monthlyIncome ? budget.monthlyIncome.toLocaleString('en-US') : ''}
                onChange={(e) => updateBudgetField('monthlyIncome', parseCleanNumber(e.target.value))}
                placeholder="e.g. 150,000"
                className="w-full h-11 pl-11 pr-4 bg-white border border-[#D5DFDA] rounded-xl text-base font-semibold tabular-nums text-[#172522] focus-visible:ring-2 focus-visible:ring-[#176B52]"
              />
            </div>
          </div>

          {/* Expenses */}
          <div>
            <label htmlFor="budget-expenses" className="text-xs font-semibold text-[#172522] block mb-1">
              Monthly essential living expenses
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#52635D] select-none pointer-events-none">
                Rs.
              </span>
              <input
                id="budget-expenses"
                type="text"
                inputMode="numeric"
                value={budget.monthlyExpenses ? budget.monthlyExpenses.toLocaleString('en-US') : ''}
                onChange={(e) => updateBudgetField('monthlyExpenses', parseCleanNumber(e.target.value))}
                placeholder="e.g. 110,000"
                className="w-full h-11 pl-11 pr-4 bg-white border border-[#D5DFDA] rounded-xl text-base font-semibold tabular-nums text-[#172522] focus-visible:ring-2 focus-visible:ring-[#176B52]"
              />
            </div>
            <p className="text-[11px] text-[#52635D] mt-1">Rent, utilities, groceries, and regular family commitments.</p>
          </div>

          {/* Money you’re setting aside */}
          <div>
            <label htmlFor="budget-cash-saving" className="text-xs font-semibold text-[#172522] block mb-1">
              Money you’re setting aside (optional)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#52635D] select-none pointer-events-none">
                Rs.
              </span>
              <input
                id="budget-cash-saving"
                type="text"
                inputMode="numeric"
                value={budget.monthlyCashSavingsCommitment ? budget.monthlyCashSavingsCommitment.toLocaleString('en-US') : ''}
                onChange={(e) => updateBudgetField('monthlyCashSavingsCommitment', parseCleanNumber(e.target.value))}
                placeholder="0"
                className="w-full h-11 pl-11 pr-4 bg-white border border-[#D5DFDA] rounded-xl text-base font-semibold tabular-nums text-[#172522] focus-visible:ring-2 focus-visible:ring-[#176B52]"
              />
            </div>
            <p className="text-[11px] text-[#52635D] mt-1">
              Money set aside separately (such as cash savings or kameti). Not invested in equities.
            </p>
          </div>

          {/* Money left each month context box */}
          <div className="p-3.5 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-[#172522] block">
                Money left each month
              </span>
              <span className="text-[11px] text-[#52635D]">
                Income minus expenses minus money you’re setting aside
              </span>
            </div>
            <span className="text-base font-bold text-[#172522] tabular-nums">
              {formatPKR(availableSurplus, { useLakhFormat: showLakhFormat })}/mo
            </span>
          </div>
        </div>
      )}

      {/* Primary Question: How much would you like to invest? */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
        <div>
          <label htmlFor="monthly-invest-input" className="text-base font-bold text-[#172522] block">
            {monthlyChoice === 'help_me_work_it_out'
              ? 'How much of this would you like to invest?'
              : 'Monthly investment amount'}
          </label>
          <p className="text-xs text-[#52635D] mt-1 leading-relaxed">
            Choose an amount you can sustain each month. The numeric field accepts any valid amount.
          </p>
        </div>

        <NumberInputWithSlider
          id="monthly-invest-input"
          label=""
          value={monthlyInvestment}
          onChange={onChangeMonthlyInvestment}
          min={0}
          max={sliderMax}
          step={1000}
          unitPrefix="Rs. "
          formatAsCurrency
          quickPresets={[
            { label: 'Rs. 5,000', value: 5000 },
            { label: 'Rs. 15,000', value: 15000 },
            { label: 'Rs. 25,000', value: 25000 },
            { label: 'Rs. 50,000', value: 50000 },
          ]}
        />

        {/* Budget feedback: ONLY shown when "Help me work it out" is active */}
        {monthlyChoice === 'help_me_work_it_out' && isExceedingSurplus && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Notice:</span> Your intended investment of {formatPKR(monthlyInvestment, { useLakhFormat: showLakhFormat })} is more than the PKR {formatPKR(availableSurplus, { showPrefix: false, useLakhFormat: showLakhFormat })} left in the budget you entered. You can keep this amount, adjust your investment, or update your budget numbers.
            </div>
          </div>
        )}

        {monthlyChoice === 'help_me_work_it_out' && isNegativeSurplus && (
          <div className="p-3.5 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs text-[#52635D] leading-relaxed">
            Expenses and savings equal or exceed income in the numbers you entered. You can continue with PKR 0 or any amount you choose while working on your monthly budget.
          </div>
        )}

        {monthlyChoice === 'help_me_work_it_out' && !isExceedingSurplus && !isNegativeSurplus && availableSurplus > 0 && (
          <div className="p-3 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl flex items-start gap-2 text-xs text-[#176B52]">
            <CheckCircle2 className="w-4 h-4 text-[#176B52] shrink-0 mt-0.5" />
            <div>
              PKR {formatPKR(availableSurplus - monthlyInvestment, { showPrefix: false, useLakhFormat: showLakhFormat })} remains after the expenses, savings and investment you entered.
            </div>
          </div>
        )}

        <div className="h-px bg-[#D5DFDA]" />

        {/* Annual Step-Up: Explicit Choice */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-base font-bold text-[#172522] block">
                Would you like to increase this amount each year?
              </span>
              <p className="text-xs text-[#52635D] mt-0.5 leading-relaxed">
                Increase your monthly investment each year to expand long-term compounding.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen('stepup')}
              className="text-[#52635D] hover:text-[#172522] min-h-[36px] min-w-[36px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#176B52] rounded-md shrink-0"
              aria-label="Learn about annual increase"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          {/* Segmented radio choice */}
          <div
            role="radiogroup"
            aria-label="Would you like to increase this amount each year?"
            className="grid grid-cols-2 gap-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={stepUpMode === 'keep_same'}
              onClick={() => handleStepUpModeChange('keep_same')}
              className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                stepUpMode === 'keep_same'
                  ? 'bg-[#EAF4EF] border-[#176B52] text-[#176B52]'
                  : 'bg-white border-[#D5DFDA] text-[#52635D] hover:border-[#B8C7C0]'
              }`}
            >
              Keep it the same
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={stepUpMode === 'choose_increase'}
              onClick={() => handleStepUpModeChange('choose_increase')}
              className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                stepUpMode === 'choose_increase'
                  ? 'bg-[#EAF4EF] border-[#176B52] text-[#176B52]'
                  : 'bg-white border-[#D5DFDA] text-[#52635D] hover:border-[#B8C7C0]'
              }`}
            >
              Choose an increase
            </button>
          </div>

          {stepUpMode === 'choose_increase' ? (
            <div className="space-y-4 pt-1">
              <NumberInputWithSlider
                id="annual-stepup-input"
                label="Annual increase rate"
                value={annualStepUpPercent}
                onChange={onChangeAnnualStepUp}
                min={1}
                max={25}
                step={1}
                unitSuffix="%"
                quickPresets={[
                  { label: '5% / yr', value: 5 },
                  { label: '10% / yr', value: 10 },
                  { label: '15% / yr', value: 15 },
                  { label: '20% / yr', value: 20 },
                ]}
              />

              {/* Translated Actual Rupee Amounts Across Key Years */}
              <div className="bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl p-3.5 space-y-2 text-xs">
                <span className="font-bold text-[#172522] block">
                  What this means in actual rupees:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-white p-2.5 rounded-lg border border-[#D5DFDA]">
                    <span className="text-[#52635D] block text-[11px]">Monthly now:</span>
                    <span className="font-bold text-[#172522] tabular-nums">
                      {formatPKR(translations.monthlyNow)}/mo
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#D5DFDA]">
                    <span className="text-[#52635D] block text-[11px]">Next year (Month 13):</span>
                    <span className="font-bold text-[#172522] tabular-nums">
                      {formatPKR(translations.monthlyNextYear)}/mo
                    </span>
                  </div>
                  {/* Final-year amount made prominent enough to notice */}
                  <div className="bg-[#EAF4EF] p-2.5 rounded-lg border border-[#176B52]/30">
                    <span className="text-[#176B52] font-semibold block text-[11px]">
                      Final year (Year {timeHorizonYears}):
                    </span>
                    <span className="font-extrabold text-[#176B52] tabular-nums text-sm block">
                      {formatPKR(translations.monthlyFinalYear)}/mo
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#52635D] pt-1">
                  Note: This assumes your income will support larger contributions in future years.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs text-[#52635D]">
              Your monthly investment will remain constant at{' '}
              <strong className="text-[#172522]">{formatPKR(monthlyInvestment)}/mo</strong> across all {timeHorizonYears} years.
            </div>
          )}
        </div>
      </div>

      {/* Action Row */}
      <div className="pt-2">
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
            onClick={onNext}
            className="w-full sm:w-auto flex-1 min-h-[48px] px-6 py-2.5 bg-[#176B52] hover:bg-[#11543F] text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99]"
          >
            <span>Review plan assumptions</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <InfoModal
        isOpen={modalOpen === 'affordability'}
        onClose={() => setModalOpen(null)}
        title="Understanding money left each month"
      >
        <p>
          We deduct your essential living expenses and money you’re setting aside from your monthly take-home earnings to calculate money left each month.
        </p>
        <p>
          You decide how much of this money you want to invest. We never assume you should invest all of it.
        </p>
      </InfoModal>

      <InfoModal
        isOpen={modalOpen === 'stepup'}
        onClose={() => setModalOpen(null)}
        title="How annual increases work"
      >
        <p>
          An annual increase raises your monthly investment at the start of each 12-month period (beginning in month 13).
        </p>
        <p>
          Gradual adjustments over time significantly expand your future wealth, assuming your future income supports higher contributions.
        </p>
      </InfoModal>
    </div>
  );
};
