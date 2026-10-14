/**
 * Record Contribution Modal Component
 * 
 * Records actual monthly money deposited into the user's investment account.
 * Supports partial amounts, multiple contributions in the same month,
 * editing, and deleting.
 * 
 * Strict financial separation:
 * “Record money added to your investment account, not transfers between
 * investments you already own.”
 */

import React, { useState } from 'react';
import { ContributionRecord } from '../types/horizon';
import { formatMonthKey, getCurrentDateInfo } from '../utils/journey';
import { formatPKR } from '../utils/finance';
import { X, Trash2, Calendar, HelpCircle, Check } from 'lucide-react';

interface RecordContributionModalProps {
  monthKey: string;
  plannedAmount: number;
  existingRecord?: ContributionRecord | null;
  onSaveRecord: (record: ContributionRecord) => void;
  onDeleteRecord?: (id: string) => void;
  onClose: () => void;
  showLakhFormat: boolean;
}

export const RecordContributionModal: React.FC<RecordContributionModalProps> = ({
  monthKey,
  plannedAmount,
  existingRecord,
  onSaveRecord,
  onDeleteRecord,
  onClose,
  showLakhFormat,
}) => {
  const today = getCurrentDateInfo().dateString;

  const [amountStr, setAmountStr] = useState<string>(
    existingRecord ? String(existingRecord.amount) : String(plannedAmount || 20000)
  );
  const [dateStr, setDateStr] = useState<string>(
    existingRecord ? existingRecord.date : today
  );
  const [noteStr, setNoteStr] = useState<string>(existingRecord?.note || '');
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseFloat(amountStr.replace(/,/g, ''));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid contribution amount in PKR (greater than 0).');
      return;
    }
    if (!dateStr) {
      setError('Please select the date when the contribution was made.');
      return;
    }

    const record: ContributionRecord = {
      id: existingRecord?.id || `contrib-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      monthKey,
      amount: Math.round(parsedAmount),
      date: dateStr,
      note: noteStr.trim() || undefined,
      status: parsedAmount >= plannedAmount ? 'added' : 'partly_added',
    };

    onSaveRecord(record);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm bg-[#FFFFFF] rounded-2xl p-6 shadow-xl border border-[#D5DFDA] space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#D5DFDA]">
          <div>
            <h3 className="text-base font-bold text-[#172522]">
              {existingRecord ? 'Edit Contribution' : 'Record Investment'}
            </h3>
            <span className="text-xs text-[#52635D]">
              For {formatMonthKey(monthKey)} · Planned: {formatPKR(plannedAmount, { useLakhFormat: showLakhFormat })}
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

        {/* Financial Separation Reminder */}
        <div className="p-3 bg-[#F8FAF9] border border-[#D5DFDA] rounded-xl text-xs text-[#52635D] leading-relaxed">
          Record money added from your income/savings to your investment account. This does not automatically buy shares or create holdings.
        </div>

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#172522] block">
              Amount added (PKR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#52635D]">
                Rs.
              </span>
              <input
                type="number"
                min={1}
                step={100}
                required
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setError(null);
                }}
                className="w-full min-h-[44px] pl-10 pr-3 py-2 bg-white border border-[#D5DFDA] rounded-xl text-sm font-bold text-[#172522] focus:outline-none focus:ring-2 focus:ring-[#176B52]"
                placeholder="20,000"
              />
            </div>
            {!isNaN(parsedAmount) && parsedAmount > 0 && (
              <span className="text-[11px] text-[#52635D] block">
                {formatPKR(parsedAmount, { useLakhFormat: showLakhFormat })}
              </span>
            )}
          </div>

          {/* Date Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#172522] block">
              Contribution date
            </label>
            <input
              type="date"
              required
              value={dateStr}
              onChange={(e) => {
                setDateStr(e.target.value);
                setError(null);
              }}
              className="w-full min-h-[44px] px-3 py-2 bg-white border border-[#D5DFDA] rounded-xl text-xs font-medium text-[#172522] focus:outline-none focus:ring-2 focus:ring-[#176B52]"
            />
          </div>

          {/* Optional Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#172522] block">
              Note (optional)
            </label>
            <input
              type="text"
              maxLength={80}
              placeholder="e.g. Salary deposit, bonus"
              value={noteStr}
              onChange={(e) => setNoteStr(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 bg-white border border-[#D5DFDA] rounded-xl text-xs text-[#172522] focus:outline-none focus:ring-2 focus:ring-[#176B52]"
            />
          </div>

          {error && <p className="text-xs text-rose-700 font-semibold">{error}</p>}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            {existingRecord && onDeleteRecord && (
              <button
                type="button"
                onClick={() => {
                  onDeleteRecord(existingRecord.id);
                  onClose();
                }}
                className="min-h-[44px] px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                title="Delete record"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] px-3 py-2 bg-[#FFFFFF] border border-[#D5DFDA] text-xs font-semibold text-[#172522] rounded-xl hover:bg-[#F8FAF9] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] px-4 py-2 bg-[#176B52] hover:bg-[#11543F] text-white text-xs font-bold rounded-xl transition-all shadow-xs"
            >
              {existingRecord ? 'Update' : 'Save record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
