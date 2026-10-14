/**
 * Horizon — Personal Investing Companion for Pakistan
 * Main Application Orchestrator
 */

import React, { useState, useEffect } from 'react';
import {
  HorizonState,
  HorizonPlan,
  InvestmentStatusChoice,
  StockHolding,
  TrackedWealthItem,
  MonthlyMethodChoice,
  AffordabilityBudget,
  UserAssumptions,
  JourneySchedule,
  ContributionRecord,
  CatchUpCommitment,
} from './types/horizon';
import { loadSavedState, saveState, clearSavedState, DEFAULT_INITIAL_STATE, getLastSaveStatus } from './utils/storage';
import { Header } from './components/Header';
import { Step1InvestmentsToday } from './components/steps/Step1InvestmentsToday';
import { Step2MonthlyInvestment } from './components/steps/Step2MonthlyInvestment';
import { Step3Assumptions } from './components/steps/Step3Assumptions';
import { Step4ReviewPlan } from './components/steps/Step4ReviewPlan';
import { Step5Explorer } from './components/steps/Step5Explorer';
import { PortfolioView } from './components/PortfolioView';
import { JourneyView } from './components/JourneyView';
import { BackupModal } from './components/BackupModal';

const STEP_NAMES = [
  'Your investments',
  'Monthly investment',
  'Plan assumptions',
  'Starting plan',
  'Saved plan overview',
];

export default function App() {
  const [state, setState] = useState<HorizonState>(() => loadSavedState());
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [storageStatus, setStorageStatus] = useState<'saved' | 'failed' | 'idle'>('saved');

  const [activeTab, setActiveTab] = useState<'plan' | 'portfolio' | 'journey'>(() => {
    const saved = loadSavedState();
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('horizon_active_tab');
      if (stored === 'plan' || stored === 'portfolio' || stored === 'journey') {
        return stored;
      }
    }
    if (saved.lastSelectedTab) {
      return saved.lastSelectedTab;
    }
    // Landing fit:
    // Users with recorded holdings -> My portfolio
    // Users with active journey -> My journey
    // Otherwise -> My plan
    if (saved.hasCompletedOnboarding) {
      if (saved.journeySchedule?.isActive) {
        return 'journey';
      }
      if (saved.investmentChoice === 'stocks_detail' && saved.stockHoldings.length > 0) {
        return 'portfolio';
      }
      return 'plan';
    }
    return 'plan';
  });

  const handleSelectTab = (tab: 'plan' | 'portfolio' | 'journey') => {
    setActiveTab(tab);
    setState((prev) => ({ ...prev, lastSelectedTab: tab }));
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('horizon_active_tab', tab);
    }
  };

  // Automatically save state on change with status tracking
  useEffect(() => {
    const success = saveState(state);
    setStorageStatus(success ? 'saved' : 'failed');
  }, [state]);

  const handleNavigateStep = (step: number) => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(Math.max(1, step), 5),
    }));
    handleSelectTab('plan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavePlan = () => {
    const hasHoldings = state.investmentChoice === 'stocks_detail' && state.stockHoldings.length > 0;
    const defaultNextTab = state.journeySchedule?.isActive
      ? 'journey'
      : hasHoldings
      ? 'portfolio'
      : 'plan';

    setState((prev) => ({
      ...prev,
      hasCompletedOnboarding: true,
      currentStep: 5,
    }));
    handleSelectTab(defaultNextTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextStep = () => {
    setState((prev) => {
      const nextStep = Math.min(5, prev.currentStep + 1);
      const isFinishing = nextStep === 5;
      const hasHoldings = prev.investmentChoice === 'stocks_detail' && prev.stockHoldings.length > 0;
      if (isFinishing) {
        const nextTab = prev.journeySchedule?.isActive
          ? 'journey'
          : hasHoldings
          ? 'portfolio'
          : 'plan';
        handleSelectTab(nextTab);
      }
      return {
        ...prev,
        currentStep: nextStep,
        hasCompletedOnboarding: isFinishing ? true : prev.hasCompletedOnboarding,
      };
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1),
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleLakh = () => {
    setState((prev) => ({
      ...prev,
      showLakhFormat: !prev.showLakhFormat,
    }));
  };

  const handleReset = () => {
    clearSavedState();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('horizon_active_tab');
    }
    setState(DEFAULT_INITIAL_STATE);
    setActiveTab('plan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // State update handlers
  const handleInvestmentChoice = (choice: InvestmentStatusChoice) => {
    setState((prev) => ({ ...prev, investmentChoice: choice }));
  };

  const handleStockHoldings = (holdings: StockHolding[]) => {
    setState((prev) => ({ ...prev, stockHoldings: holdings }));
  };

  const handleTotalInvestmentsValue = (val: number) => {
    setState((prev) => ({ ...prev, totalInvestmentsValue: val }));
  };

  const handleCashToInvest = (val: number) => {
    setState((prev) => ({ ...prev, cashAvailableToInvest: val }));
  };

  const handleTrackedWealth = (wealth: TrackedWealthItem[]) => {
    setState((prev) => ({ ...prev, trackedWealth: wealth }));
  };

  const handleMonthlyChoice = (choice: MonthlyMethodChoice) => {
    setState((prev) => ({ ...prev, monthlyChoice: choice }));
  };

  const handleBudget = (budget: AffordabilityBudget) => {
    setState((prev) => ({ ...prev, budget }));
  };

  const handleMonthlyInvestment = (val: number) => {
    setState((prev) => ({ ...prev, monthlyInvestment: val }));
  };

  const handleAnnualStepUp = (val: number) => {
    setState((prev) => ({ ...prev, annualStepUpPercent: val }));
  };

  const handleAssumptions = (assumptions: UserAssumptions) => {
    setState((prev) => ({ ...prev, assumptions }));
  };

  // Journey handlers
  const handleStartJourney = (schedule: JourneySchedule) => {
    setState((prev) => ({
      ...prev,
      journeySchedule: schedule,
    }));
    handleSelectTab('journey');
  };

  const handleSaveContribution = (record: ContributionRecord) => {
    setState((prev) => {
      const records = prev.contributionRecords || [];
      const existingIdx = records.findIndex((r) => r.id === record.id);
      let updated: ContributionRecord[];
      if (existingIdx >= 0) {
        updated = [...records];
        updated[existingIdx] = record;
      } else {
        updated = [...records, record];
      }
      return {
        ...prev,
        contributionRecords: updated,
      };
    });
  };

  const handleDeleteContribution = (id: string) => {
    setState((prev) => ({
      ...prev,
      contributionRecords: (prev.contributionRecords || []).filter((r) => r.id !== id),
    }));
  };

  const handleMonthDecision = (monthKey: string, decision: 'skipped' | 'not_yet') => {
    setState((prev) => ({
      ...prev,
      monthDecisions: {
        ...(prev.monthDecisions || {}),
        [monthKey]: {
          decision,
          decidedAt: new Date().toISOString(),
        },
      },
    }));
  };

  const handleApplyCatchUp = (commitment: CatchUpCommitment) => {
    setState((prev) => ({
      ...prev,
      catchUpCommitment: commitment,
    }));
  };

  const handleCancelCatchUp = () => {
    setState((prev) => ({
      ...prev,
      catchUpCommitment: undefined,
    }));
  };

  const handleRestoreSuccess = (restored: HorizonState) => {
    setState(restored);
    const targetTab = restored.lastSelectedTab || (restored.journeySchedule?.isActive ? 'journey' : 'plan');
    handleSelectTab(targetTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Construct active plan payload
  const existingInvestmentsToProject =
    state.investmentChoice === 'stocks_detail'
      ? state.stockHoldings.reduce((sum, s) => sum + s.marketValue, 0)
      : state.investmentChoice === 'total_value'
      ? state.totalInvestmentsValue
      : 0;

  const activePlan: HorizonPlan = {
    existingInvestmentsToProject,
    cashAvailableToInvest: state.cashAvailableToInvest,
    monthlyInvestment: state.monthlyInvestment,
    annualStepUpPercent: state.annualStepUpPercent,
    assumptions: state.assumptions,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAF9] text-[#172522]">
      {/* Header with single progress indicator, storage status, and backup action */}
      <Header
        currentStep={state.currentStep}
        totalSteps={5}
        stepNames={STEP_NAMES}
        onNavigateStep={handleNavigateStep}
        showLakhFormat={state.showLakhFormat}
        onToggleLakhFormat={handleToggleLakh}
        onReset={handleReset}
        onOpenBackupModal={() => setBackupModalOpen(true)}
        storageStatus={storageStatus}
      />

      {/* Post-onboarding View Switcher / Tab Bar ("My Journey", "My Portfolio", "My Plan") */}
      {state.hasCompletedOnboarding && (
        <div className="bg-[#FFFFFF] border-b border-[#D5DFDA] px-4 sm:px-6 py-2">
          <div className="max-w-[640px] mx-auto flex items-center justify-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => handleSelectTab('journey')}
              className={`flex-1 sm:flex-initial min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'journey'
                  ? 'bg-[#176B52] text-white shadow-xs'
                  : 'bg-[#F8FAF9] text-[#52635D] hover:text-[#172522] border border-[#D5DFDA]'
              }`}
            >
              My Journey
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab('portfolio')}
              className={`flex-1 sm:flex-initial min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'portfolio'
                  ? 'bg-[#176B52] text-white shadow-xs'
                  : 'bg-[#F8FAF9] text-[#52635D] hover:text-[#172522] border border-[#D5DFDA]'
              }`}
            >
              My Portfolio
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab('plan')}
              className={`flex-1 sm:flex-initial min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'plan'
                  ? 'bg-[#176B52] text-white shadow-xs'
                  : 'bg-[#F8FAF9] text-[#52635D] hover:text-[#172522] border border-[#D5DFDA]'
              }`}
            >
              My Plan & Projections
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Focused Setup Column (max 640px) */}
      <main className="flex-1 max-w-[640px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {state.hasCompletedOnboarding && activeTab === 'journey' ? (
          <JourneyView
            schedule={state.journeySchedule}
            contributionRecords={state.contributionRecords}
            monthDecisions={state.monthDecisions}
            catchUpCommitment={state.catchUpCommitment}
            monthlyInvestment={state.monthlyInvestment}
            annualStepUpPercent={state.annualStepUpPercent}
            assumptions={state.assumptions}
            showLakhFormat={state.showLakhFormat}
            onStartJourney={handleStartJourney}
            onSaveContribution={handleSaveContribution}
            onDeleteContribution={handleDeleteContribution}
            onMonthDecision={handleMonthDecision}
            onApplyCatchUp={handleApplyCatchUp}
            onCancelCatchUp={handleCancelCatchUp}
            onNavigateStep={handleNavigateStep}
          />
        ) : state.hasCompletedOnboarding && activeTab === 'portfolio' ? (
          <PortfolioView
            stockHoldings={state.stockHoldings}
            onChangeHoldings={handleStockHoldings}
            showLakhFormat={state.showLakhFormat}
            onNavigateStep={handleNavigateStep}
          />
        ) : (
          <>
            {state.currentStep === 1 && (
              <Step1InvestmentsToday
                investmentChoice={state.investmentChoice}
                stockHoldings={state.stockHoldings}
                totalInvestmentsValue={state.totalInvestmentsValue}
                cashAvailableToInvest={state.cashAvailableToInvest}
                trackedWealth={state.trackedWealth}
                onChangeChoice={handleInvestmentChoice}
                onChangeHoldings={handleStockHoldings}
                onChangeTotalValue={handleTotalInvestmentsValue}
                onChangeCashToInvest={handleCashToInvest}
                onChangeTrackedWealth={handleTrackedWealth}
                onNext={handleNextStep}
                showLakhFormat={state.showLakhFormat}
              />
            )}

            {state.currentStep === 2 && (
              <Step2MonthlyInvestment
                monthlyChoice={state.monthlyChoice}
                budget={state.budget}
                monthlyInvestment={state.monthlyInvestment}
                annualStepUpPercent={state.annualStepUpPercent}
                timeHorizonYears={state.assumptions.timeHorizonYears}
                onChangeChoice={handleMonthlyChoice}
                onChangeBudget={handleBudget}
                onChangeMonthlyInvestment={handleMonthlyInvestment}
                onChangeAnnualStepUp={handleAnnualStepUp}
                onNext={handleNextStep}
                onBack={handlePrevStep}
                showLakhFormat={state.showLakhFormat}
              />
            )}

            {state.currentStep === 3 && (
              <Step3Assumptions
                assumptions={state.assumptions}
                onChangeAssumptions={handleAssumptions}
                onNext={handleNextStep}
                onBack={handlePrevStep}
              />
            )}

            {state.currentStep === 4 && (
              <Step4ReviewPlan
                plan={activePlan}
                investmentChoice={state.investmentChoice}
                stockHoldings={state.stockHoldings}
                trackedWealth={state.trackedWealth}
                onSavePlan={handleSavePlan}
                onBack={handlePrevStep}
                onNavigateStep={handleNavigateStep}
                showLakhFormat={state.showLakhFormat}
              />
            )}

            {state.currentStep === 5 && (
              <Step5Explorer
                plan={activePlan}
                investmentChoice={state.investmentChoice}
                stockHoldings={state.stockHoldings}
                onChangeMonthlyInvestment={handleMonthlyInvestment}
                onChangeAnnualStepUp={handleAnnualStepUp}
                onChangeAssumptions={handleAssumptions}
                onNavigateStep={handleNavigateStep}
                showLakhFormat={state.showLakhFormat}
                onStartJourney={() => handleSelectTab('journey')}
                hasActiveJourney={Boolean(state.journeySchedule?.isActive)}
              />
            )}
          </>
        )}
      </main>

      {/* Backup & Restore Modal */}
      {backupModalOpen && (
        <BackupModal
          state={state}
          activeTab={activeTab}
          onClose={() => setBackupModalOpen(false)}
          onRestoreSuccess={handleRestoreSuccess}
          showLakhFormat={state.showLakhFormat}
        />
      )}

      {/* Restrained Footer */}
      <footer className="border-t border-[#D5DFDA] bg-[#FFFFFF] py-6 px-4 text-xs text-[#52635D]">
        <div className="max-w-[640px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="font-bold text-[#172522]">
            Horizon · Personal Investing Companion
          </span>
          <span className="text-[11px] text-[#52635D]">
            Educational planning tool for Pakistan
          </span>
        </div>
      </footer>
    </div>
  );
}
