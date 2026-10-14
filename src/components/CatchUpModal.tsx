/**
 * Catch-Up Options Modal
 * 
 * Offers structured, non-judgmental ways to handle a confirmed contribution gap:
 * 1. Catch up next month (regular scheduled amount + full gap)
 * 2. Spread it out across 2 to 12 future months (with exact single-rupee rounding)
 * 3. Continue without catching up (keeps schedule intact, explains reality calmly)
 * 
 * Financial honesty:
 * “Adding extra can close the contribution gap. It may not recover investment
 * growth missed during the delay.”
 */

import React, { useState } from 'react';
import { CatchUpCommitment, JourneySchedule } from '../types/horizon';
import { formatPKR } from '../utils/finance';
import {
  calculateCatchUpDistribution,
  addMonthsToKey,
  formatMonthKey,
  getCurrentDateInfo,
  generatePlannedSchedule,
} from '../utils/journey';
import { X, Calendar, Check, HelpCircle } from 'lucide-react';

interface CatchUpModalProps {
  schedule: JourneySchedule;
  contributionGap: number;
  currentCommitment?: CatchUpCommitment;
  onApplyCommitment: (commitment: CatchUpCommitment) => void;
  onCancelCommitment: () => void;
  onClose: () => void;
  showLakhFormat: boolean;
}

export const CatchUpModal: React.FC<CatchUpModalProps> = ({
  schedule,
  contributionGap,
  currentCommitment,
  onApplyCommitment,
  onCancelCommitment,
  onClose,
  showLakhFormat,
}) => {
  const todayInfo = getCurrentDateInfo();
  const nextMonthKey = addMonthsToKey(todayInfo.monthKey, 1);

  // Strategy selection
  const [selectedStrategy, setSelectedStrategy] = useState<'next_month' | 'spread_out' | 'none'>(
    currentCommitment?.strategy || 'next_month'
  );
  const [spreadMonths, setSpreadMonths] = useState<number>(
    currentCommitment?.spreadMonths || 3
  );

  const plannedMonths = generatePlannedSchedule(schedule);
  const endMonthKey = plannedMonths.at(-1)?.monthKey ?? schedule.startMonth;
  const remainingMonths = plannedMonths.filter(m => m.monthKey >= nextMonthKey).length;
  const regularNextMonthAmount = plannedMonths.find(m => m.monthKey === nextMonthKey)?.baseAmount ?? 0;

  // Next month full catch-up calculation
  const nextMonthTotal = regularNextMonthAmount + contributionGap;

  // Spread out distribution calculation
  const { monthlyAllocations, breakdown } = calculateCatchUpDistribution(
    contributionGap,
    spreadMonths,
    nextMonthKey,
    endMonthKey
  );

  const handleApply = () => {
    if (selectedStrategy === 'none') {
      onCancelCommitment();
      onClose();
      return;
    }

    if (remainingMonths === 0) return;

    if (selectedStrategy === 'next_month') {
      const commitment: CatchUpCommitment = {
        strategy: 'next_month',
        targetMonthKey: nextMonthKey,
        totalGapAmount: contributionGap,
        extraMonthlyAmount: contributionGap,
        monthlyAllocations: {
          [nextMonthKey]: contributionGap,
        },
        appliedAt: new Date().toISOString(),
      };
      onApplyCommitment(commitment);
      onClose();
      return;
    }

    if (selectedStrategy === 'spread_out') {
      const commitment: CatchUpCommitment = {
        strategy: 'spread_out',
        startMonthKey: nextMonthKey,
        spreadMonths: breakdown.length,
        totalGapAmount: contributionGap,
        monthlyAllocations,
        appliedAt: new Date().toISOString(),
      };
      onApplyCommitment(commitment);
      onClose();
      return;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-[#FFFFFF] rounded-2xl p-6 shadow-xl border border-[#D5DFDA] space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#D5DFDA]">
          <div>
            <h3 className="text-base font-bold text-[#172522]">Manage Contribution Gap</h3>
            <span className="text-xs text-[#52635D]">
              Gap to date:{' '}
              <strong className="text-[#172522]">
                {formatPKR(contributionGap, { useLakhFormat: showLakhFormat })}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-[#52635D] hover:text-[#172522] rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Limitation Notice */}
        <div className="p-3.5 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs text-[#52635D] leading-relaxed flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-[#176B52] shrink-0 mt-0.5" />
          <div>
            <strong>Financial note:</strong> Adding extra can close the contribution gap. It may not recover investment growth missed during the delay.
          </div>
        </div>

        {/* Strategy Options */}
        <div className="space-y-3">
          {/* 1. Catch up next month */}
          <label
            className={`block p-4 border rounded-xl cursor-pointer transition-all ${
              selectedStrategy === 'next_month'
                ? 'border-[#176B52] bg-[#EAF4EF]/40 ring-1 ring-[#176B52]'
                : 'border-[#D5DFDA] bg-white hover:bg-[#F8FAF9]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="catchup_strategy"
                  value="next_month"
                  checked={selectedStrategy === 'next_month'}
                  onChange={() => setSelectedStrategy('next_month')}
                  className="w-4 h-4 text-[#176B52] focus:ring-[#176B52]"
                />
                <span className="text-xs font-bold text-[#172522]">
                  Catch up next month ({formatMonthKey(nextMonthKey)})
                </span>
              </div>
            </div>
            <p className="text-xs text-[#52635D] mt-2 ml-6 leading-relaxed">
              Add the entire gap to your next scheduled contribution.
            </p>
            <div className="mt-2 ml-6 p-2.5 bg-white border border-[#D5DFDA] rounded-lg text-xs space-y-1">
              <div className="flex justify-between text-[#52635D]">
                <span>Regular amount:</span>
                <span>{formatPKR(regularNextMonthAmount, { useLakhFormat: showLakhFormat })}</span>
              </div>
              <div className="flex justify-between text-[#176B52] font-semibold">
                <span>Extra catch-up:</span>
                <span>+{formatPKR(contributionGap, { useLakhFormat: showLakhFormat })}</span>
              </div>
              <div className="flex justify-between border-t border-[#D5DFDA] pt-1 font-bold text-[#172522]">
                <span>Total planned next month:</span>
                <span>{formatPKR(nextMonthTotal, { useLakhFormat: showLakhFormat })}</span>
              </div>
            </div>
          </label>

          {/* 2. Spread it out */}
          <label
            className={`block p-4 border rounded-xl cursor-pointer transition-all ${
              selectedStrategy === 'spread_out'
                ? 'border-[#176B52] bg-[#EAF4EF]/40 ring-1 ring-[#176B52]'
                : 'border-[#D5DFDA] bg-white hover:bg-[#F8FAF9]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="catchup_strategy"
                  value="spread_out"
                  checked={selectedStrategy === 'spread_out'}
                  onChange={() => setSelectedStrategy('spread_out')}
                  className="w-4 h-4 text-[#176B52] focus:ring-[#176B52]"
                />
                <span className="text-xs font-bold text-[#172522]">
                  Spread it out across multiple months
                </span>
              </div>
            </div>
            <p className="text-xs text-[#52635D] mt-2 ml-6 leading-relaxed">
              Divide the gap into manageable monthly additions starting next month.
            </p>

            {selectedStrategy === 'spread_out' && (
              <div className="mt-3 ml-6 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-[#172522]">
                    <span className="font-semibold">Number of months:</span>
                    <strong className="text-[#176B52]">{spreadMonths} months</strong>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={12}
                    step={1}
                    value={spreadMonths}
                    onChange={(e) => setSpreadMonths(parseInt(e.target.value, 10))}
                    className="w-full accent-[#176B52] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#52635D]">
                    <span>2 months</span>
                    <span>6 months</span>
                    <span>12 months</span>
                  </div>
                </div>

                {/* Breakdown Schedule */}
                <div className="max-h-36 overflow-y-auto divide-y divide-[#D5DFDA] border border-[#D5DFDA] rounded-lg bg-white text-xs">
                  {breakdown.map((b) => (
                    <div key={b.monthKey} className="p-2 flex justify-between items-center text-[11px]">
                      <span className="font-medium text-[#172522]">
                        {formatMonthKey(b.monthKey)}
                      </span>
                      <div className="text-right">
                        <span className="text-[#176B52] font-semibold block">
                          +{formatPKR(b.extraCatchUp, { useLakhFormat: showLakhFormat })}
                        </span>
                        <span className="text-[10px] text-[#52635D]">
                          Total: {formatPKR((plannedMonths.find(month => month.monthKey === b.monthKey)?.baseAmount ?? 0) + b.extraCatchUp, { useLakhFormat: showLakhFormat })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </label>

          {/* 3. Continue without catching up */}
          <label
            className={`block p-4 border rounded-xl cursor-pointer transition-all ${
              selectedStrategy === 'none'
                ? 'border-[#176B52] bg-[#EAF4EF]/40 ring-1 ring-[#176B52]'
                : 'border-[#D5DFDA] bg-white hover:bg-[#F8FAF9]'
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="catchup_strategy"
                value="none"
                checked={selectedStrategy === 'none'}
                onChange={() => setSelectedStrategy('none')}
                className="w-4 h-4 text-[#176B52] focus:ring-[#176B52]"
              />
              <span className="text-xs font-bold text-[#172522]">
                Continue regular plan without catching up
              </span>
            </div>
            <p className="text-xs text-[#52635D] mt-2 ml-6 leading-relaxed">
              Keep regular monthly amounts unchanged. The earlier shortfall remains recorded, but no extra money is required.
            </p>
          </label>
        </div>

        {/* Active commitment cancellation option */}
        {currentCommitment && currentCommitment.strategy !== 'none' && (
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-[#52635D]">Existing catch-up is currently active.</span>
            <button
              type="button"
              onClick={() => {
                onCancelCommitment();
                onClose();
              }}
              className="text-xs text-rose-700 hover:text-rose-800 underline font-semibold"
            >
              Cancel catch-up commitment
            </button>
          </div>
        )}

        {remainingMonths < spreadMonths && selectedStrategy !== 'none' && (
          <p role="status" className="text-xs text-amber-800">
            {remainingMonths === 0 ? 'No future months remain in this journey. Catch-up cannot extend its horizon.' : `Catch-up is limited to the ${remainingMonths} remaining journey months.`}
          </p>
        )}
        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#D5DFDA] text-xs font-semibold text-[#172522] rounded-xl hover:bg-[#F8FAF9] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedStrategy !== 'none' && remainingMonths === 0}
            onClick={handleApply}
            className="flex-1 min-h-[44px] px-4 py-2 bg-[#176B52] hover:bg-[#11543F] text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            Apply Plan
          </button>
        </div>
      </div>
    </div>
  );
};
