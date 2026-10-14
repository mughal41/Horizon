import React, { useState } from 'react';
import { UserAssumptions } from '../../types/horizon';
import { NumberInputWithSlider } from '../NumberInputWithSlider';
import { ChevronDown, ChevronUp, HelpCircle, Info, ExternalLink } from 'lucide-react';
import { LATEST_OFFICIAL_INFLATION } from '../../data/pakistanInflation';

interface Step3AssumptionsProps {
  assumptions: UserAssumptions;
  onChangeAssumptions: (assumptions: UserAssumptions) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step3Assumptions: React.FC<Step3AssumptionsProps> = ({
  assumptions,
  onChangeAssumptions,
  onNext,
  onBack,
}) => {
  const [returnDetailsOpen, setReturnDetailsOpen] = useState(false);
  const [inflationDetailsOpen, setInflationDetailsOpen] = useState(false);
  const [helpChoosingOpen, setHelpChoosingOpen] = useState(false);

  const updateField = <K extends keyof UserAssumptions>(
    field: K,
    val: UserAssumptions[K]
  ) => {
    onChangeAssumptions({
      ...assumptions,
      [field]: val,
    });
  };

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#172522]">
          What should we use for this example?
        </h1>
        <p className="mt-1 text-sm text-[#52635D] leading-relaxed">
          These planning assumptions are separate from your actual financial information. They help calculate mathematical long-term projections without predicting market movements.
        </p>
      </div>

      {/* Neutral guidance acknowledging difficulty for beginners */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
        <button
          type="button"
          onClick={() => setHelpChoosingOpen(!helpChoosingOpen)}
          className="w-full flex items-center justify-between text-left text-xs font-semibold text-[#172522] focus-visible:ring-2 focus-visible:ring-[#176B52] rounded-lg"
        >
          <span className="flex items-center gap-1.5 text-[#176B52]">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>Not sure what rates to choose?</span>
          </span>
          <span className="text-[#52635D] flex items-center gap-1">
            <span>{helpChoosingOpen ? 'Hide' : 'Explain what this does'}</span>
            {helpChoosingOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {helpChoosingOpen && (
          <div className="text-xs text-[#52635D] leading-relaxed pt-2 border-t border-[#D5DFDA] space-y-1.5 animate-in fade-in duration-150">
            <p>
              Choosing a return assumption can be difficult because future financial markets are never guaranteed or constant.
            </p>
            <p>
              Changing the investment return changes the compounding rate in the formula. A higher rate illustrates what happens if equities grow strongly; a lower or zero rate models sluggish growth; a negative rate models capital loss.
            </p>
            <p>
              We do not provide a &ldquo;recommended&rdquo; return rate. We encourage testing different values to observe how sensitive your plan is.
            </p>
          </div>
        )}
      </div>

      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
        {/* 1. Number of years */}
        <div>
          <NumberInputWithSlider
            id="assumed-horizon"
            label="Number of years"
            value={assumptions.timeHorizonYears}
            onChange={(val) => updateField('timeHorizonYears', val)}
            min={1}
            max={35}
            step={1}
            unitSuffix=" years"
            quickPresets={[
              { label: '3 years', value: 3 },
              { label: '5 years', value: 5 },
              { label: '10 years', value: 10 },
              { label: '15 years', value: 15 },
              { label: '20 years', value: 20 },
            ]}
            helperText="How many years you plan to leave this money invested."
          />
        </div>

        <div className="h-px bg-[#D5DFDA]" />

        {/* 2. Assumed annual investment return */}
        <div className="space-y-3">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-[#172522] block">
                Assumed annual investment return
              </span>
              <span className="text-xs font-mono font-bold text-[#172522]">
                {(assumptions.assumedAnnualReturnRate * 100).toFixed(1)}% p.a.
              </span>
            </div>
            <p className="text-xs text-[#52635D] mt-0.5 leading-relaxed">
              Investment return: how much the invested money might grow in a year.
            </p>
          </div>

          <NumberInputWithSlider
            id="assumed-return-rate"
            label=""
            value={Math.round(assumptions.assumedAnnualReturnRate * 1000) / 10}
            onChange={(val) => updateField('assumedAnnualReturnRate', val / 100)}
            min={-5}
            max={25}
            step={0.5}
            unitSuffix="% p.a."
            quickPresets={[
              { label: '-2% (Loss)', value: -2 },
              { label: '0% (Flat)', value: 0 },
              { label: '8% (Illustrative)', value: 8 },
              { label: '12% (Illustrative)', value: 12 },
              { label: '15% (Illustrative)', value: 15 },
            ]}
          />

          {/* Expandable details for return */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setReturnDetailsOpen(!returnDetailsOpen)}
              className="text-xs text-[#176B52] hover:text-[#11543F] font-semibold inline-flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-[#176B52] rounded py-1"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{returnDetailsOpen ? 'Hide return details' : 'Important details about this return assumption'}</span>
              {returnDetailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {returnDetailsOpen && (
              <div className="mt-2 p-3.5 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs text-[#52635D] space-y-1.5 leading-relaxed animate-in fade-in duration-150">
                <p>• <strong>Effective annual total return:</strong> This rate assumes monthly compounding over the 12-month period.</p>
                <p>• <strong>Dividends included:</strong> Dividends are assumed to be reinvested into compounding; they are not calculated or added separately.</p>
                <p>• <strong>Taxes and fees:</strong> Capital gains taxes, dividend withholding taxes, and broker commissions are not calculated separately.</p>
                <p>• <strong>No live quote feed:</strong> Current market and inflation feeds are not connected.</p>
                <p>• <strong>Not a forecast:</strong> This is an illustrative planning input chosen by you, not a guaranteed return or verified historical average.</p>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-[#D5DFDA]" />

        {/* 3. Assumed future inflation */}
        <div className="space-y-3">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-[#172522] block">
                Inflation assumed for your plan
              </span>
              <span className="text-xs font-mono font-bold text-[#172522]">
                {(assumptions.assumedAnnualInflationRate * 100).toFixed(1)}% p.a.
              </span>
            </div>
            <p className="text-xs text-[#52635D] mt-0.5 leading-relaxed">
              Inflation: how much prices might rise in a year.
            </p>
          </div>

          <NumberInputWithSlider
            id="assumed-inflation-rate"
            label=""
            value={Math.round(assumptions.assumedAnnualInflationRate * 1000) / 10}
            onChange={(val) => updateField('assumedAnnualInflationRate', val / 100)}
            min={0}
            max={20}
            step={0.5}
            unitSuffix="% p.a."
            quickPresets={[
              { label: '0% (Unadjusted)', value: 0 },
              { label: '8% (Illustrative)', value: 8 },
              { label: '10% (Illustrative)', value: 10 },
              { label: '12% (Illustrative)', value: 12 },
            ]}
          />

          {/* Official Pakistan Inflation Context (Dated observation separate from plan assumption) */}
          <div className="p-3.5 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between text-[#172522]">
              <span className="font-semibold text-[#172522]">Prices in Pakistan ({LATEST_OFFICIAL_INFLATION.referencePeriod})</span>
              <span className="text-[11px] text-[#52635D]">Official national observation</span>
            </div>
            <p className="text-[#172522] leading-relaxed">
              Prices were about <span className="font-semibold">{LATEST_OFFICIAL_INFLATION.publishedPercentage}% higher</span> in {LATEST_OFFICIAL_INFLATION.referencePeriod} than a year earlier.
            </p>
            <p className="text-[#52635D] leading-relaxed">
              Your own expenses may rise at a different rate.
            </p>

            <div className="pt-2 border-t border-[#D5DFDA]/60 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => updateField('assumedAnnualInflationRate', LATEST_OFFICIAL_INFLATION.exactYoYPercentage / 100)}
                  className="px-2.5 py-1 bg-white border border-[#176B52] text-[#176B52] hover:bg-[#EAF4EF] font-semibold rounded-lg text-xs transition-colors inline-flex items-center gap-1 min-h-[32px] focus-visible:ring-2 focus-visible:ring-[#176B52]"
                >
                  <span>Use as an example ({LATEST_OFFICIAL_INFLATION.publishedPercentage}%)</span>
                </button>
              </div>
              <p className="text-[11px] text-[#52635D] leading-relaxed">
                This applies the same rate to future years. Actual inflation will vary.
              </p>
            </div>

            <div className="pt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#52635D] border-t border-[#D5DFDA]/60">
              <a
                href={LATEST_OFFICIAL_INFLATION.officialDocumentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#176B52] hover:text-[#11543F] hover:underline font-medium inline-flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-[#176B52] rounded"
              >
                <span>Pakistan Bureau of Statistics (PBS) — Press Release</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span>Checked: {LATEST_OFFICIAL_INFLATION.dateChecked}</span>
            </div>
          </div>

          {/* Expandable details for inflation */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setInflationDetailsOpen(!inflationDetailsOpen)}
              className="text-xs text-[#176B52] hover:text-[#11543F] font-semibold inline-flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-[#176B52] rounded py-1"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{inflationDetailsOpen ? 'Hide inflation details' : 'Important details about inflation adjustment'}</span>
              {inflationDetailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {inflationDetailsOpen && (
              <div className="mt-2 p-3.5 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs text-[#52635D] space-y-1.5 leading-relaxed animate-in fade-in duration-150">
                <p>• <strong>Planning assumption:</strong> Future inflation is entered as an assumption to estimate what future rupees might buy in today&apos;s purchasing power.</p>
                <p>• <strong>Official reference:</strong> National headline Consumer Price Index (CPI General, 2015-16=100) Year-on-Year from the PBS Press Release for {LATEST_OFFICIAL_INFLATION.referencePeriod} ({LATEST_OFFICIAL_INFLATION.exactYoYPercentage}% YoY, MoM change: {LATEST_OFFICIAL_INFLATION.monthOnMonthPercentage}%). Official publication date: {LATEST_OFFICIAL_INFLATION.publicationDate} (not stated in document). Verified on {LATEST_OFFICIAL_INFLATION.dateChecked}.</p>
                <p>• <strong>Not a live feed:</strong> Inflation data is a source-backed periodic statistical publication, not a continuous live market feed.</p>
                <p>• <strong>Unadjusted option:</strong> Setting inflation to 0% displays nominal future rupee values without purchasing-power discounting.</p>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-[#D5DFDA]" />

        {/* 4. Shariah-Compliance Preference */}
        <div className="flex items-start justify-between gap-4 pt-1">
          <div className="space-y-1">
            <span className="text-sm font-bold text-[#172522] block">
              Shariah-compliant investment preference
            </span>
            <p className="text-xs text-[#52635D] leading-relaxed max-w-lg">
              Check this if you prefer investing in Shariah-compliant funds (e.g. Islamic money market, Sukuk, KMI-30 index funds).
            </p>
            <div className="text-[11px] text-[#52635D]">
              Note: Records your personal preference. Does not constitute certification of any individual security or fund.
            </div>
          </div>

          <button
            type="button"
            onClick={() => updateField('shariahPreference', !assumptions.shariahPreference)}
            role="switch"
            aria-checked={assumptions.shariahPreference}
            aria-label="Toggle Shariah-compliant funds preference"
            className={`min-w-[48px] h-7 rounded-full transition-colors relative focus-visible:ring-2 focus-visible:ring-[#176B52] shrink-0 ${
              assumptions.shariahPreference ? 'bg-[#176B52]' : 'bg-[#D5DFDA]'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform transform mt-1 ${
                assumptions.shariahPreference ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
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
            <span>View my starting plan</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
