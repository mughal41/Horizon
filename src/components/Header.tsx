import React, { useState } from 'react';
import { Settings, RotateCcw, HelpCircle, X, Check, Info, Download, Upload, ShieldCheck, AlertCircle } from 'lucide-react';

interface HeaderProps {
  currentStep: number;
  totalSteps: number;
  stepNames: string[];
  onNavigateStep: (step: number) => void;
  showLakhFormat: boolean;
  onToggleLakhFormat: () => void;
  onReset: () => void;
  onOpenBackupModal?: () => void;
  storageStatus?: 'saved' | 'failed' | 'idle';
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  totalSteps,
  stepNames,
  onNavigateStep,
  showLakhFormat,
  onToggleLakhFormat,
  onReset,
  onOpenBackupModal,
  storageStatus = 'saved',
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pricesHelpOpen, setPricesHelpOpen] = useState(false);
  const [storageHelpOpen, setStorageHelpOpen] = useState(false);

  const handleConfirmReset = () => {
    setResetConfirmOpen(false);
    setMenuOpen(false);
    onReset();
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#FFFFFF] border-b border-[#D5DFDA]">
        <div className="max-w-[640px] mx-auto px-4 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
          {/* Horizon wordmark and subtle storage badge */}
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-[#172522]">
              Horizon
            </span>

            {/* Subtle "Saved on this browser" badge */}
            <button
              type="button"
              onClick={() => setStorageHelpOpen(true)}
              title="Storage status"
              className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all ${
                storageStatus === 'failed'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-[#F8FAF9] border-[#D5DFDA] text-[#52635D] hover:text-[#172522]'
              }`}
            >
              {storageStatus === 'failed' ? (
                <>
                  <AlertCircle className="w-3 h-3 text-rose-600" />
                  <span>Not saved</span>
                </>
              ) : (
                <>
                  <Check className="w-3 h-3 text-[#176B52]" />
                  <span>Saved on this browser</span>
                </>
              )}
            </button>
          </div>

          {/* Compact Settings / Menu Action */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open settings and options"
              className="min-h-[40px] px-2.5 py-1 flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#52635D] hover:text-[#172522] hover:bg-[#F8FAF9] rounded-lg border border-[#D5DFDA] transition-colors focus-visible:ring-2 focus-visible:ring-[#176B52]"
            >
              <Settings className="w-4 h-4 text-[#52635D]" />
              <span className="hidden sm:inline">Options</span>
            </button>
          </div>
        </div>

        {/* Single Onboarding Progress Indicator */}
        <div className="bg-[#F8FAF9] border-t border-[#D5DFDA] px-4 sm:px-6 py-1.5 sm:py-2">
          <div className="max-w-[640px] mx-auto">
            <div className="flex items-center justify-between text-xs font-semibold text-[#172522] mb-1.5">
              <span>
                Step {currentStep} of {totalSteps} · {stepNames[currentStep - 1]}
              </span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="grid grid-cols-5 gap-1.5 h-1.5">
              {Array.from({ length: totalSteps }).map((_, idx) => {
                const stepNum = idx + 1;
                const isCompleted = stepNum < currentStep;
                const isCurrent = stepNum === currentStep;

                return (
                  <button
                    key={stepNum}
                    type="button"
                    disabled={stepNum > currentStep}
                    onClick={() => onNavigateStep(stepNum)}
                    aria-label={`Jump to Step ${stepNum}: ${stepNames[idx]}`}
                    className={`h-full rounded-full transition-all ${
                      isCurrent
                        ? 'bg-[#176B52]'
                        : isCompleted
                        ? 'bg-[#176B52]/40 hover:bg-[#176B52]/60 cursor-pointer'
                        : 'bg-[#D5DFDA] cursor-not-allowed'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Settings / Options Drawer / Modal */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[#FFFFFF] rounded-t-2xl sm:rounded-2xl p-5 shadow-lg border border-[#D5DFDA] space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D5DFDA]">
              <h2 className="text-base font-bold text-[#172522]">Options</h2>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-[#52635D] hover:text-[#172522] rounded-lg"
                aria-label="Close options"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Currency Format */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172522] block">
                Number & Currency Display
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (showLakhFormat) onToggleLakhFormat();
                  }}
                  className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                    !showLakhFormat
                      ? 'bg-[#EAF4EF] border-[#176B52] text-[#176B52]'
                      : 'bg-[#FFFFFF] border-[#D5DFDA] text-[#52635D] hover:border-[#B8C7C0]'
                  }`}
                >
                  Standard (PKR)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!showLakhFormat) onToggleLakhFormat();
                  }}
                  className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                    showLakhFormat
                      ? 'bg-[#EAF4EF] border-[#176B52] text-[#176B52]'
                      : 'bg-[#FFFFFF] border-[#D5DFDA] text-[#52635D] hover:border-[#B8C7C0]'
                  }`}
                >
                  Lakh / Crore
                </button>
              </div>
            </div>

            <div className="h-px bg-[#D5DFDA]" />

            {/* Backup & Restore Action */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                if (onOpenBackupModal) onOpenBackupModal();
              }}
              className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between text-xs font-semibold text-[#176B52] bg-[#EAF4EF] hover:bg-[#D5EADF] rounded-lg transition-colors border border-[#176B52]/30"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#176B52]" />
                Backup & Restore
              </span>
              <span className="text-[#176B52] font-semibold">JSON →</span>
            </button>

            {/* About Prices */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setPricesHelpOpen(true);
              }}
              className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between text-xs font-semibold text-[#172522] hover:bg-[#F8FAF9] rounded-lg transition-colors border border-[#D5DFDA]"
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#52635D]" />
                About prices
              </span>
              <span className="text-[#52635D] font-normal">→</span>
            </button>

            {/* Help / About Horizon */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setHelpOpen(true);
              }}
              className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between text-xs font-semibold text-[#172522] hover:bg-[#F8FAF9] rounded-lg transition-colors border border-[#D5DFDA]"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#52635D]" />
                About Horizon
              </span>
              <span className="text-[#52635D] font-normal">→</span>
            </button>

            {/* Start Over Button */}
            <button
              type="button"
              onClick={() => {
                setResetConfirmOpen(true);
              }}
              className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
            >
              <span className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                Start Over
              </span>
              <span className="text-rose-500 font-normal">Reset</span>
            </button>
          </div>
        </div>
      )}

      {/* Storage Status Explanation Modal */}
      {storageHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-[#FFFFFF] rounded-2xl p-6 shadow-xl border border-[#D5DFDA] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D5DFDA]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#176B52]" />
                <h3 className="text-base font-bold text-[#172522]">Browser Storage</h3>
              </div>
              <button
                type="button"
                onClick={() => setStorageHelpOpen(false)}
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-[#52635D] hover:text-[#172522]"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[#52635D] space-y-2 leading-relaxed">
              <p>
                <strong>Your progress is saved in this browser.</strong> Download a backup to keep a copy or move to another device.
              </p>
              <p>
                Horizon runs purely on your device without an external server or cloud sync. Clearing this site's data removes saved progress.
              </p>
              {storageStatus === 'failed' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                  Storage is full or restricted. Changes are currently held in memory only. Please download a backup to keep your records.
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              {onOpenBackupModal && (
                <button
                  type="button"
                  onClick={() => {
                    setStorageHelpOpen(false);
                    onOpenBackupModal();
                  }}
                  className="flex-1 min-h-[44px] bg-[#176B52] text-white text-xs font-bold rounded-xl hover:bg-[#11543F] transition-colors"
                >
                  Backup now
                </button>
              )}
              <button
                type="button"
                onClick={() => setStorageHelpOpen(false)}
                className="flex-1 min-h-[44px] bg-white border border-[#D5DFDA] text-[#172522] text-xs font-semibold rounded-xl hover:bg-[#F8FAF9] transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Over Confirmation Modal */}
      {resetConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-[#FFFFFF] rounded-2xl p-6 shadow-xl border border-[#D5DFDA] space-y-4">
            <h3 className="text-base font-bold text-[#172522]">Start over from the beginning?</h3>
            <p className="text-xs text-[#52635D] leading-relaxed">
              This will clear all entered holdings, monthly amounts, and progress. Your saved plan will be reset to Step 1.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="flex-1 min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#D5DFDA] text-xs font-semibold text-[#172522] rounded-lg hover:bg-[#F8FAF9] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 min-h-[44px] px-3 py-2 bg-rose-700 text-white text-xs font-semibold rounded-lg hover:bg-rose-800 transition-colors"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Stock Prices Modal */}
      {pricesHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-[#FFFFFF] rounded-2xl p-6 shadow-xl border border-[#D5DFDA] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#D5DFDA]">
              <h3 className="text-base font-bold text-[#172522]">About stock prices</h3>
              <button
                type="button"
                onClick={() => setPricesHelpOpen(false)}
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-[#52635D] hover:text-[#172522]"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-[#52635D] space-y-3 leading-relaxed">
              <div>
                <h4 className="font-bold text-[#172522] mb-0.5">Source & Data Provider</h4>
                <p>
                  Company names and tickers are sourced from the Pakistan Stock Exchange (PSX) regular equities directory. Automated prices are fetched on request from the open-source psxdata-api community service (MIT License).
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[#172522] mb-0.5">Timestamps & Freshness</h4>
                <p>
                  Price timestamps indicate when the quote was retrieved by Horizon from the network provider (formatted in Pakistan Standard Time). They do not represent exchange trade execution timestamps.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[#172522] mb-0.5">Two-Hour Session Caching</h4>
                <p>
                  Successful quotes are temporarily cached in your browser session for up to two hours to minimize network traffic and keep the interface fast. A cache lifetime controls reuse; it does not prove the underlying market price is fresh. You can tap “Update price” at any time to request a fresh quote.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[#172522] mb-0.5">Manual Pricing & Fallback</h4>
                <p>
                  You are never locked into automated prices. You can enter or edit any share price manually at any time to match the exact figures in your brokerage account.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-[#172522] mb-0.5">Privacy Notice</h4>
                <p>
                  Network requests to retrieve market quotes originate directly from your web browser. Removing technical provider names from the primary form improves clarity, but does not make browser network requests private.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPricesHelpOpen(false)}
              className="w-full min-h-[44px] bg-[#176B52] text-white text-xs font-semibold rounded-lg hover:bg-[#11543F] transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* About Horizon Modal */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-[#FFFFFF] rounded-2xl p-6 shadow-xl border border-[#D5DFDA] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#D5DFDA]">
              <h3 className="text-base font-bold text-[#172522]">About Horizon</h3>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-[#52635D] hover:text-[#172522]"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-[#52635D] space-y-3 leading-relaxed">
              <p>
                Horizon is an independent investing companion designed for ordinary people in Pakistan.
              </p>
              <p>
                Its purpose is to help you understand your starting position, commit to a sustainable monthly investment, and explore mathematical long-term compounding outcomes.
              </p>
              <p>
                Horizon does not sell financial products, give licensed financial advice, or promise guaranteed investment returns.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="w-full min-h-[44px] bg-[#176B52] text-white text-xs font-semibold rounded-lg hover:bg-[#11543F] transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
};
