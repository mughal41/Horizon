/**
 * Backup & Restore Modal Component
 * 
 * Allows users to download a private, versioned JSON checkpoint
 * and restore it across devices or browsers.
 * 
 * Flow:
 * 1. Select file
 * 2. Validate size, JSON, schema version, IDs, and financial values
 * 3. Show preview (export date, holdings count, journey start)
 * 4. Warn that restoring replaces current saved data
 * 5. Offer download of current data first
 * 6. Apply only on explicit user confirmation
 */

import React, { useState, useRef } from 'react';
import {
  HorizonBackupPayload,
  createBackupPayload,
  downloadBackupFile,
  validateBackupContent,
  restoreValidatedBackup,
  BackupPreview,
} from '../utils/backup';
import { HorizonState } from '../types/horizon';
import { formatPKR } from '../utils/finance';
import {
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  X,
  FileCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface BackupModalProps {
  state: HorizonState;
  activeTab?: 'plan' | 'portfolio' | 'journey';
  onClose: () => void;
  onRestoreSuccess: (restoredState: HorizonState) => void;
  showLakhFormat: boolean;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  state,
  activeTab,
  onClose,
  onRestoreSuccess,
  showLakhFormat,
}) => {
  const [activeMode, setActiveMode] = useState<'download' | 'restore'>('download');
  const [downloadDone, setDownloadDone] = useState(false);

  // Restore flow states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [validatedPayload, setValidatedPayload] = useState<HorizonBackupPayload | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [backedUpCurrentBeforeRestore, setBackedUpCurrentBeforeRestore] = useState(false);

  const handleDownload = () => {
    const payload = createBackupPayload(state, undefined, activeTab);
    downloadBackupFile(payload);
    setDownloadDone(true);
  };

  const handleBackupCurrentBeforeRestore = () => {
    const payload = createBackupPayload(state, undefined, activeTab);
    downloadBackupFile(payload);
    setBackedUpCurrentBeforeRestore(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError(null);
    setRestoreError(null);
    setPreview(null);
    setValidatedPayload(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== 'string') {
        setValidationError('Could not read the selected file.');
        return;
      }

      const result = validateBackupContent(content, file.size);
      if (!result.isValid || !result.parsedPayload || !result.preview) {
        setValidationError(result.errorMessage || 'Invalid backup file.');
        return;
      }

      setPreview(result.preview);
      setValidatedPayload(result.parsedPayload);
    };

    reader.onerror = () => {
      setValidationError('Failed to read file from disk.');
    };

    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!validatedPayload) return;
    setIsRestoring(true);
    setRestoreError(null);

    const result = restoreValidatedBackup(validatedPayload);
    setIsRestoring(false);

    if (result.success && result.restoredState) {
      onRestoreSuccess(result.restoredState);
      onClose();
    } else {
      setRestoreError(result.errorMessage || 'Could not restore backup into this browser.');
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
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#176B52]" />
            <h3 className="text-base font-bold text-[#172522]">Backup & Restore</h3>
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

        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveMode('download')}
            className={`min-h-[40px] px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeMode === 'download'
                ? 'bg-[#176B52] text-white shadow-xs'
                : 'text-[#52635D] hover:text-[#172522]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download backup</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('restore')}
            className={`min-h-[40px] px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeMode === 'restore'
                ? 'bg-[#176B52] text-white shadow-xs'
                : 'text-[#52635D] hover:text-[#172522]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Restore backup</span>
          </button>
        </div>

        {/* Download Mode */}
        {activeMode === 'download' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs text-[#52635D] space-y-2 leading-relaxed">
              <p className="font-semibold text-[#172522]">
                Save your progress to a portable file
              </p>
              <p>
                Download a checkpoint containing your saved plan, portfolio holdings, recorded buying prices, monthly journey schedule, and contribution history.
              </p>
              <p className="text-amber-800 font-medium">
                This file contains your financial information. Keep it somewhere private.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full min-h-[44px] px-4 py-2 bg-[#176B52] hover:bg-[#11543F] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download backup file (.json)</span>
              </button>

              {downloadDone && (
                <div className="p-3 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl text-xs text-[#176B52] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Backup downloaded. You can restore it anytime in any modern browser.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Restore Mode */}
        {activeMode === 'restore' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs text-[#52635D] space-y-1.5 leading-relaxed">
              <p className="font-semibold text-[#172522]">
                Restore progress from another browser or device
              </p>
              <p>
                Select your previously exported Horizon backup file. Your file will be checked for accuracy before anything is replaced.
              </p>
            </div>

            {/* Hidden file input & picker */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json,application/json"
              className="hidden"
            />

            {!preview && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[48px] px-4 py-3 border-2 border-dashed border-[#D5DFDA] hover:border-[#176B52] rounded-xl text-xs font-bold text-[#172522] hover:bg-[#F8FAF9] transition-all flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 text-[#176B52]" />
                <span>Select backup file</span>
              </button>
            )}

            {validationError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Could not accept backup</span>
                </div>
                <p className="leading-relaxed">{validationError}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-rose-700 underline font-semibold block"
                >
                  Choose another file
                </button>
              </div>
            )}

            {/* File Validated: Show Preview */}
            {preview && validatedPayload && (
              <div className="space-y-4">
                <div className="p-4 bg-[#EAF4EF] border border-[#176B52]/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-[#176B52] font-bold">
                    <FileCheck className="w-4 h-4" />
                    <span>Backup Verified</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[#172522]">
                    <div>
                      <span className="text-[11px] text-[#52635D] block">Exported:</span>
                      <strong className="text-xs">
                        {new Date(preview.exportDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#52635D] block">Holdings:</span>
                      <strong className="text-xs">{preview.holdingsCount} stock(s)</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#52635D] block">Journey:</span>
                      <strong className="text-xs">
                        {preview.journeyActive
                          ? `Active (${preview.journeyStartMonth || 'Started'})`
                          : 'Not started'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#52635D] block">Contributions:</span>
                      <strong className="text-xs">
                        {preview.contributionRecordsCount} record(s) (
                        {formatPKR(preview.totalContributionsRecorded, { useLakhFormat: showLakhFormat, compact: true })})
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Replacement Warning & Current Backup Offer */}
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Restoring replaces current saved data</span>
                  </div>
                  <p className="leading-relaxed">
                    Restoring this file will replace the plans, holdings, and journey data currently stored in this browser.
                  </p>
                  <button
                    type="button"
                    onClick={handleBackupCurrentBeforeRestore}
                    className="text-amber-800 underline font-semibold flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {backedUpCurrentBeforeRestore
                        ? 'Current data downloaded ✓'
                        : 'Download current data first as a precaution'}
                    </span>
                  </button>
                </div>

                {restoreError && (
                  <p className="text-xs text-rose-700 font-semibold">{restoreError}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreview(null);
                      setValidatedPayload(null);
                    }}
                    className="flex-1 min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#D5DFDA] text-xs font-semibold text-[#172522] rounded-xl hover:bg-[#F8FAF9] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isRestoring}
                    onClick={handleConfirmRestore}
                    className="flex-1 min-h-[44px] px-4 py-2 bg-[#176B52] hover:bg-[#11543F] text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50"
                  >
                    {isRestoring ? 'Restoring...' : 'Confirm & Restore'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
