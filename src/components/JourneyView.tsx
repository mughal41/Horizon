/**
 * My Investment Journey Component
 * 
 * Provides:
 * 1. Journey startup & scheduling
 * 2. Focused monthly check-in ("Your investment for [Month]")
 * 3. Contribution progress & shortfall calculation
 * 4. Primary chart: "Money added" (Planned vs Recorded cumulative deposits)
 * 5. Catch-up options and distribution
 * 6. Detailed contribution history ledger with edit/delete
 */

import React, { useState } from 'react';
import {
  JourneySchedule,
  ContributionRecord,
  CatchUpCommitment,
  MonthDecision,
  UserAssumptions,
} from '../types/horizon';
import { formatPKR } from '../utils/finance';
import {
  getCurrentDateInfo,
  formatMonthKey,
  formatShortMonthKey,
  calculateJourneyMetrics,
  getValidScheduledDate,
  MonthLedgerSummary,
} from '../utils/journey';
import { RecordContributionModal } from './RecordContributionModal';
import { CatchUpModal } from './CatchUpModal';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Plus,
  TrendingUp,
  BarChart3,
  Layers,
  ChevronRight,
  Edit2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface JourneyViewProps {
  schedule?: JourneySchedule;
  contributionRecords: ContributionRecord[];
  monthDecisions?: Record<string, MonthDecision>;
  catchUpCommitment?: CatchUpCommitment;
  monthlyInvestment: number;
  annualStepUpPercent: number;
  assumptions: UserAssumptions;
  showLakhFormat: boolean;
  onStartJourney: (schedule: JourneySchedule) => void;
  onSaveContribution: (record: ContributionRecord) => void;
  onDeleteContribution: (id: string) => void;
  onMonthDecision: (monthKey: string, decision: 'skipped' | 'not_yet') => void;
  onApplyCatchUp: (commitment: CatchUpCommitment) => void;
  onCancelCatchUp: () => void;
  onNavigateStep: (step: number) => void;
}

export const JourneyView: React.FC<JourneyViewProps> = ({
  schedule,
  contributionRecords,
  monthDecisions = {},
  catchUpCommitment,
  monthlyInvestment,
  annualStepUpPercent,
  assumptions,
  showLakhFormat,
  onStartJourney,
  onSaveContribution,
  onDeleteContribution,
  onMonthDecision,
  onApplyCatchUp,
  onCancelCatchUp,
  onNavigateStep,
}) => {
  const todayInfo = getCurrentDateInfo();

  // Setup form states (when no journey active)
  const [startMonth, setStartMonth] = useState<string>(todayInfo.monthKey);
  const [contributionDay, setContributionDay] = useState<number>(5);

  // Modals state
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [targetMonthKeyForRecord, setTargetMonthKeyForRecord] = useState<string>(todayInfo.monthKey);
  const [editingRecord, setEditingRecord] = useState<ContributionRecord | null>(null);
  const [catchUpModalOpen, setCatchUpModalOpen] = useState(false);
  const [selectedMonthDetail, setSelectedMonthDetail] = useState<MonthLedgerSummary | null>(null);
  const [showTableAlternative, setShowTableAlternative] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // If no journey started yet, render Setup Screen
  if (!schedule || !schedule.isActive) {
    const firstScheduledDate = getValidScheduledDate(startMonth, contributionDay);

    const handleCreateJourney = (e: React.FormEvent) => {
      e.preventDefault();
      const newSchedule: JourneySchedule = {
        isActive: true,
        startMonth,
        contributionDay,
        originalMonthlyAmount: monthlyInvestment ?? 25000,
        originalStepUpPercent: annualStepUpPercent ?? 0,
        originalHorizonYears: assumptions.timeHorizonYears || 10,
        originalReturnRate: assumptions.assumedAnnualReturnRate ?? 0.12,
        originalInflationRate: assumptions.assumedAnnualInflationRate ?? 0.10,
        createdAt: new Date().toISOString(),
      };
      onStartJourney(newSchedule);
    };

    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-[#176B52]" />
            <span className="text-xs font-bold text-[#176B52] uppercase tracking-wider">
              Monthly Investment Journey
            </span>
          </div>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#172522]">
            Start My Journey
          </h1>
          <p className="mt-1 text-sm text-[#52635D] leading-relaxed">
            Commit to your regular monthly investment schedule and track your real progress over time.
          </p>
        </div>

        <form onSubmit={handleCreateJourney} className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-6">
          <div className="p-4 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs text-[#52635D] space-y-2 leading-relaxed">
            <span className="font-semibold text-[#172522] block">
              Based on your saved plan:
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs text-[#172522]">
              <div>
                <span className="text-[#52635D] block text-[11px]">Monthly investment:</span>
                <strong>{formatPKR(monthlyInvestment, { useLakhFormat: showLakhFormat })}/mo</strong>
              </div>
              <div>
                <span className="text-[#52635D] block text-[11px]">Annual increase:</span>
                <strong>{annualStepUpPercent}% every 12 months</strong>
              </div>
            </div>
            <p className="text-[11px] text-[#52635D] pt-1">
              Existing starting investments do not count as monthly contributions. The first annual increase will apply in journey month 13.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172522] block">
                Start month
              </label>
              <input
                type="month"
                required
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-white border border-[#D5DFDA] rounded-xl text-xs font-semibold text-[#172522] focus:outline-none focus:ring-2 focus:ring-[#176B52]"
              />
              <span className="text-[11px] text-[#52635D] block">
                {formatMonthKey(startMonth)}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172522] block">
                Preferred monthly contribution day
              </label>
              <select
                value={contributionDay}
                onChange={(e) => setContributionDay(parseInt(e.target.value, 10))}
                className="w-full min-h-[44px] px-3 py-2 bg-white border border-[#D5DFDA] rounded-xl text-xs font-semibold text-[#172522] focus:outline-none focus:ring-2 focus:ring-[#176B52]"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                    {d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of each month
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-[#52635D] block">
                This is when you plan to add money each month.
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl text-xs text-[#176B52] space-y-1">
            <strong>First scheduled contribution:</strong>
            <div className="font-semibold text-sm text-[#172522]">
              {new Date(firstScheduledDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[48px] px-4 py-3 bg-[#176B52] hover:bg-[#11543F] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
          >
            <span>Start my journey</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  }

  // Active Journey Calculations
  const metrics = calculateJourneyMetrics(
    schedule,
    contributionRecords,
    monthDecisions,
    catchUpCommitment
  );

  const currentSummary = metrics.currentMonthSummary;
  const currentPlanned = currentSummary?.plannedAmount || schedule.originalMonthlyAmount;
  const currentRecorded = currentSummary?.recordedAmount || 0;
  const currentPercent = currentPlanned > 0 ? (currentRecorded / currentPlanned) * 100 : 0;
  const visualBarPercent = Math.min(100, currentPercent);

  // Open modal handlers
  const handleOpenRecordForMonth = (monthKey: string, existing?: ContributionRecord) => {
    setTargetMonthKeyForRecord(monthKey);
    setEditingRecord(existing || null);
    setRecordModalOpen(true);
  };

  const handleSkipCurrent = () => {
    onMonthDecision(todayInfo.monthKey, 'skipped');
  };

  const handleNotYetCurrent = () => {
    onMonthDecision(todayInfo.monthKey, 'not_yet');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-5 h-5 text-[#176B52]" />
          <span className="text-xs font-bold text-[#176B52] uppercase tracking-wider">
            My Investment Journey
          </span>
        </div>
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#172522]">
            Journey Check-in
          </h1>
          <button
            type="button"
            onClick={() => handleOpenRecordForMonth(todayInfo.monthKey)}
            className="shrink-0 min-h-[40px] px-3 py-1.5 bg-[#176B52] hover:bg-[#11543F] text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Record investment</span>
          </button>
        </div>
        <p className="mt-1 text-sm text-[#52635D] leading-relaxed">
          Record what you add each month and observe how your consistency builds over time.
        </p>
      </div>

      {/* 1. This Month's Check-in Card */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#D5DFDA]">
          <div>
            <span className="text-xs font-semibold text-[#52635D] uppercase tracking-wider block">
              This Month&apos;s Check-in
            </span>
            <h2 className="text-lg font-bold text-[#172522] mt-0.5">
              Your investment for {formatMonthKey(todayInfo.monthKey)}
            </h2>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 bg-[#F8FAF9] text-[#172522] border border-[#D5DFDA] rounded-lg self-start sm:self-auto">
            Planned: {formatPKR(currentPlanned, { useLakhFormat: showLakhFormat })}
          </span>
        </div>

        {/* Progress Bar & Numerical Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-[#172522]">
            <span>
              {formatPKR(currentRecorded, { useLakhFormat: showLakhFormat })} of{' '}
              {formatPKR(currentPlanned, { useLakhFormat: showLakhFormat })} added
            </span>
            <span className={currentRecorded >= currentPlanned ? 'text-[#176B52]' : 'text-[#52635D]'}>
              {currentPercent.toFixed(0)}%
            </span>
          </div>

          <div className="h-3 w-full bg-[#D5DFDA] rounded-full overflow-hidden">
            <div
              style={{ width: `${visualBarPercent}%` }}
              className={`h-full transition-all ${
                currentRecorded >= currentPlanned ? 'bg-[#176B52]' : 'bg-[#176B52]/80'
              }`}
            />
          </div>

          {currentPercent > 100 && (
            <p className="text-[11px] text-[#176B52] font-semibold">
              +{formatPKR(currentRecorded - currentPlanned, { useLakhFormat: showLakhFormat })} extra added this month!
            </p>
          )}

          {currentSummary?.decision?.decision === 'skipped' && currentRecorded === 0 && (
            <p className="text-xs text-[#52635D] italic">
              You chose to skip this month.
            </p>
          )}
        </div>

        {/* Actions for Current Month */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => handleOpenRecordForMonth(todayInfo.monthKey)}
            className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 bg-[#176B52] hover:bg-[#11543F] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{currentRecorded > 0 ? 'Add more money' : 'Record investment'}</span>
          </button>

          <button
            type="button"
            onClick={handleNotYetCurrent}
            className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 bg-[#FFFFFF] border border-[#D5DFDA] hover:bg-[#F8FAF9] text-xs font-semibold text-[#172522] rounded-xl transition-colors"
          >
            Not yet
          </button>

          <button
            type="button"
            onClick={handleSkipCurrent}
            className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 bg-[#FFFFFF] border border-[#D5DFDA] hover:bg-[#F8FAF9] text-xs font-semibold text-[#52635D] hover:text-[#172522] rounded-xl transition-colors"
          >
            Skip this month
          </button>
        </div>
      </div>

      {/* 2. Progress Summary Card */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#D5DFDA]">
          <div>
            <h2 className="text-base font-bold text-[#172522]">Contribution Progress</h2>
            <p className="text-xs text-[#52635D] mt-0.5">
              Cumulative deposits scheduled vs actual money added to date.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl space-y-1">
            <span className="text-xs font-semibold text-[#52635D] uppercase tracking-wider block">
              Planned due so far
            </span>
            <div className="text-2xl font-extrabold text-[#172522] tabular-nums mt-1">
              {formatPKR(metrics.scheduledContributionsDueToDate, { useLakhFormat: showLakhFormat })}
            </div>
            <span className="text-[11px] text-[#52635D] block">
              Through {formatMonthKey(todayInfo.monthKey)}
            </span>
          </div>

          <div className="p-4 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl space-y-1">
            <span className="text-xs font-semibold text-[#52635D] uppercase tracking-wider block">
              Recorded to date
            </span>
            <div className="text-2xl font-extrabold text-[#176B52] tabular-nums mt-1">
              {formatPKR(metrics.recordedContributionsToDate, { useLakhFormat: showLakhFormat })}
            </div>
            <span className="text-[11px] text-[#52635D] block">
              Total external deposits
            </span>
          </div>

          <div className={`p-4 border rounded-xl space-y-1 ${
            metrics.contributionGap > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-[#EAF4EF] border-[#176B52]/30'
          }`}>
            <span className="text-xs font-semibold text-[#52635D] uppercase tracking-wider block">
              {metrics.contributionGap > 0 ? 'Contribution gap' : 'Status'}
            </span>
            <div className={`text-2xl font-extrabold tabular-nums mt-1 ${
              metrics.contributionGap > 0 ? 'text-amber-900' : 'text-[#176B52]'
            }`}>
              {metrics.contributionGap > 0
                ? formatPKR(metrics.contributionGap, { useLakhFormat: showLakhFormat })
                : 'On Track'}
            </div>
            <span className="text-[11px] text-[#52635D] block">
              {metrics.contributionGap > 0
                ? 'Missed or partial payments'
                : metrics.amountAhead > 0
                ? `Ahead by ${formatPKR(metrics.amountAhead, { useLakhFormat: showLakhFormat })}`
                : 'Matching schedule'}
            </span>
          </div>
        </div>

        {/* Unconfirmed Warning Qualification */}
        {metrics.hasUnconfirmedMonths && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Based on what you&apos;ve recorded:</strong> You have {metrics.unconfirmedPastMonthsCount} past month(s) without a recorded check-in. Confirm whether you added money in those months below before treating this gap as definite.
            </div>
          </div>
        )}

        {/* Catch-up Banner / Action */}
        {metrics.contributionGap > 0 && (
          <div className="p-4 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#172522] block">
                Manage your contribution gap
              </span>
              <p className="text-xs text-[#52635D] mt-0.5 leading-relaxed">
                Explore manageable ways to catch up next month or spread it across future months.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCatchUpModalOpen(true)}
              className="shrink-0 min-h-[40px] px-3.5 py-1.5 bg-[#176B52] hover:bg-[#11543F] text-white text-xs font-bold rounded-xl transition-all shadow-xs"
            >
              Catch-up options
            </button>
          </div>
        )}

        {/* Active Catch-up Badge */}
        {catchUpCommitment && catchUpCommitment.strategy !== 'none' && (
          <div className="p-3 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl text-xs flex items-center justify-between gap-2">
            <span className="text-[#176B52] font-semibold">
              Catch-up commitment active ({catchUpCommitment.strategy === 'next_month' ? 'Next month' : `Spread over ${catchUpCommitment.spreadMonths} mos`})
            </span>
            <button
              type="button"
              onClick={() => setCatchUpModalOpen(true)}
              className="text-[#176B52] underline font-bold"
            >
              Adjust
            </button>
          </div>
        )}
      </div>

      {/* 3. Primary Chart: "Money added" */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D5DFDA]">
          <div>
            <h2 className="text-base font-bold text-[#172522]">
              Cumulative Money Added
            </h2>
            <p className="text-xs text-[#52635D] mt-0.5">
              Excludes opening capital. Compares scheduled deposits against actual money added.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowTableAlternative(!showTableAlternative)}
            className="text-xs text-[#176B52] hover:underline font-semibold self-start sm:self-auto"
          >
            {showTableAlternative ? 'View chart' : 'View table alternative'}
          </button>
        </div>

        {!showTableAlternative ? (
          <div className="space-y-4">
            {/* SVG Cumulative Chart (12 Months window around current) */}
            <div className="h-56 w-full bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex flex-wrap justify-between gap-2 text-xs text-[#52635D]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-[#176B52] rounded" />
                    <span>Recorded</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-[#52635D] rounded border-b border-dashed" />
                    <span>Planned</span>
                  </span>
                </div>
                <span>Tap any month to inspect</span>
              </div>

              {/* Render bar / step visualization for first 12 journey months */}
              <div role="region" aria-label="Monthly contributions chart; scroll to see all months" tabIndex={0} className="flex items-end h-32 gap-1.5 px-1 pt-4 overflow-x-auto border-b border-[#D5DFDA]">
                {metrics.months.slice(0, 12).map((m) => {
                  const maxVal = Math.max(
                    ...metrics.months.slice(0, 12).map((x) => Math.max(x.plannedAmount, x.recordedAmount)),
                    1
                  );
                  const plannedH = Math.max(10, Math.min(100, (m.plannedAmount / maxVal) * 100));
                  const recordedH = Math.max(0, Math.min(100, (m.recordedAmount / maxVal) * 100));

                  const isSelected = selectedMonthDetail?.monthKey === m.monthKey;

                  return (
                    <button
                      key={m.monthKey}
                      type="button"
                      onClick={() => setSelectedMonthDetail(m)}
                      className={`flex-1 min-w-[36px] flex flex-col items-center h-full justify-end group transition-all p-0.5 rounded cursor-pointer ${
                        isSelected ? 'bg-[#EAF4EF]' : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="w-full flex items-end justify-center gap-0.5 h-full">
                        {/* Planned bar (outline) */}
                        <div
                          style={{ height: `${plannedH}%` }}
                          className={`w-1.5 sm:w-2 rounded-t ${
                            m.isFuture ? 'bg-[#52635D]/40' : 'bg-[#52635D]/60'
                          }`}
                          title={`Planned: ${formatPKR(m.plannedAmount)}`}
                        />
                        {/* Recorded bar (solid) */}
                        <div
                          style={{ height: `${recordedH}%` }}
                          className={`w-1.5 sm:w-2 rounded-t ${
                            m.recordedAmount >= m.plannedAmount
                              ? 'bg-[#176B52]'
                              : m.recordedAmount > 0
                              ? 'bg-amber-600'
                              : 'bg-transparent'
                          }`}
                          title={`Recorded: ${formatPKR(m.recordedAmount)}`}
                        />
                      </div>
                      <span className="text-[10px] text-[#52635D] mt-1 truncate w-full text-center">
                        {formatShortMonthKey(m.monthKey)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between text-[11px] text-[#52635D]">
                <span>Start: {formatMonthKey(schedule.startMonth)}</span>
                <span>Annual step-up: Month 13 (+{schedule.originalStepUpPercent}%)</span>
              </div>
            </div>

            {/* Selected Month Inspector Card */}
            {selectedMonthDetail && (
              <div className="p-4 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <strong className="text-sm text-[#172522]">
                    {formatMonthKey(selectedMonthDetail.monthKey)} (Month {selectedMonthDetail.monthIndex})
                  </strong>
                  <span className="px-2 py-0.5 bg-white text-[#176B52] border border-[#176B52]/30 rounded text-[11px] font-bold">
                    {selectedMonthDetail.statusLabel}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-[#172522]">
                  <div>
                    <span className="text-[11px] text-[#52635D] block">Planned:</span>
                    <strong>{formatPKR(selectedMonthDetail.plannedAmount, { useLakhFormat: showLakhFormat })}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#52635D] block">Recorded:</span>
                    <strong>{formatPKR(selectedMonthDetail.recordedAmount, { useLakhFormat: showLakhFormat })}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#52635D] block">Remaining:</span>
                    <strong>{formatPKR(selectedMonthDetail.remainingAmount, { useLakhFormat: showLakhFormat })}</strong>
                  </div>
                </div>
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenRecordForMonth(selectedMonthDetail.monthKey)}
                    className="min-h-[36px] px-3 bg-[#176B52] text-white rounded-lg text-xs font-bold hover:bg-[#11543F]"
                  >
                    Record contribution for this month
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMonthDetail(null)}
                    className="min-h-[36px] px-3 bg-white border border-[#D5DFDA] text-[#52635D] rounded-lg text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Accessible Table Alternative */
          <div className="overflow-x-auto border border-[#D5DFDA] rounded-xl">
            <table className="w-full text-xs text-left text-[#172522]">
              <thead className="bg-[#F8FAF9] text-[#52635D] border-b border-[#D5DFDA]">
                <tr>
                  <th className="p-3 font-semibold">Month</th>
                  <th className="p-3 font-semibold">Scheduled Date</th>
                  <th className="p-3 font-semibold">Planned</th>
                  <th className="p-3 font-semibold">Recorded</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5DFDA]">
                {metrics.months.slice(0, 12).map((m) => (
                  <tr key={m.monthKey} className="hover:bg-[#F8FAF9]">
                    <td className="p-3 font-semibold">{formatMonthKey(m.monthKey)}</td>
                    <td className="p-3 text-[#52635D]">{m.scheduledDate}</td>
                    <td className="p-3 tabular-nums">{formatPKR(m.plannedAmount, { useLakhFormat: showLakhFormat })}</td>
                    <td className="p-3 tabular-nums font-bold text-[#176B52]">
                      {formatPKR(m.recordedAmount, { useLakhFormat: showLakhFormat })}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-[#F8FAF9] border border-[#D5DFDA] rounded text-[10px] font-semibold">
                        {m.statusLabel}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleOpenRecordForMonth(m.monthKey)}
                        className="text-[#176B52] hover:underline font-bold text-xs"
                      >
                        Record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Contribution Ledger & History */}
      <div className="bg-[#FFFFFF] border border-[#D5DFDA] rounded-2xl p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#D5DFDA]">
          <div>
            <h2 className="text-base font-bold text-[#172522]">
              Contribution Records ({contributionRecords.length})
            </h2>
            <p className="text-xs text-[#52635D] mt-0.5">
              Individual deposits recorded in this browser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="text-xs text-[#176B52] hover:underline font-semibold"
          >
            {historyExpanded ? 'Collapse' : 'Expand all'}
          </button>
        </div>

        {contributionRecords.length === 0 ? (
          <div className="p-6 text-center bg-[#F8FAF9] border border-dashed border-[#D5DFDA] rounded-xl text-xs text-[#52635D]">
            No contributions recorded yet. Tap &ldquo;Record investment&rdquo; above to log your first deposit.
          </div>
        ) : (
          <div className="divide-y divide-[#D5DFDA] border border-[#D5DFDA] rounded-xl overflow-hidden bg-white">
            {contributionRecords.map((record) => (
              <div
                key={record.id}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#F8FAF9] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#172522] tabular-nums">
                      {formatPKR(record.amount, { useLakhFormat: showLakhFormat })}
                    </span>
                    <span className="text-[11px] text-[#52635D]">
                      · {record.date}
                    </span>
                  </div>
                  <div className="text-xs text-[#52635D] mt-0.5">
                    <span>For {formatMonthKey(record.monthKey)}</span>
                    {record.note && <span> · {record.note}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenRecordForMonth(record.monthKey, record)}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-semibold text-[#176B52] hover:bg-[#EAF4EF] rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Contribution Modal */}
      {recordModalOpen && (
        <RecordContributionModal
          monthKey={targetMonthKeyForRecord}
          plannedAmount={schedule.originalMonthlyAmount}
          existingRecord={editingRecord}
          onSaveRecord={onSaveContribution}
          onDeleteRecord={onDeleteContribution}
          onClose={() => {
            setRecordModalOpen(false);
            setEditingRecord(null);
          }}
          showLakhFormat={showLakhFormat}
        />
      )}

      {/* Catch-Up Modal */}
      {catchUpModalOpen && (
        <CatchUpModal
          schedule={schedule}
          contributionGap={metrics.contributionGap}
          currentCommitment={catchUpCommitment}
          onApplyCommitment={onApplyCatchUp}
          onCancelCommitment={onCancelCatchUp}
          onClose={() => setCatchUpModalOpen(false)}
          showLakhFormat={showLakhFormat}
        />
      )}
    </div>
  );
};
