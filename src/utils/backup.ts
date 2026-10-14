/**
 * Horizon Backup and Restore Engine
 * 
 * Manages portable, versioned JSON checkpoints:
 * - Exports complete financial state, preferences, holdings, journey schedule,
 *   contribution ledger, and portfolio snapshots.
 * - Excludes ephemeral session caches (e.g. 2-hour quote cache), in-flight requests,
 *   and UI modal states.
 * - Strict validation and preview before restoring.
 * - Restoring replaces current saved data only after explicit user confirmation.
 * - Preserves previous usable state if validation or storage write fails.
 * - Preserves original price timestamps and provenance — never marks an old price as newly fetched.
 */

import { HorizonState, StockHolding, ContributionRecord } from '../types/horizon';
import { PortfolioSnapshot, PORTFOLIO_SNAPSHOT_KEY, defaultPortfolioStore } from './portfolioStorage';
import { STORAGE_KEY } from './storage';

export const BACKUP_APP_IDENTIFIER = 'horizon_investing_companion';
export const CURRENT_BACKUP_SCHEMA_VERSION = 2;
export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface HorizonBackupPayload {
  app: typeof BACKUP_APP_IDENTIFIER;
  schemaVersion: number;
  exportedAt: string;
  data: {
    state: HorizonState;
    portfolioSnapshots: PortfolioSnapshot[];
    lastSelectedTab?: 'plan' | 'portfolio' | 'journey';
  };
}

export interface BackupPreview {
  exportDate: string;
  schemaVersion: number;
  holdingsCount: number;
  journeyActive: boolean;
  journeyStartMonth?: string;
  contributionRecordsCount: number;
  totalContributionsRecorded: number;
  hasPortfolioSnapshots: boolean;
  snapshotsCount: number;
}

export interface BackupValidationResult {
  isValid: boolean;
  errorMessage?: string;
  preview?: BackupPreview;
  parsedPayload?: HorizonBackupPayload;
}

/**
 * Builds the complete backup JSON object for export.
 */
export function createBackupPayload(
  state: HorizonState,
  snapshots?: PortfolioSnapshot[],
  activeTab?: 'plan' | 'portfolio' | 'journey'
): HorizonBackupPayload {
  const portfolioSnapshots = snapshots ?? (() => {
    try {
      const raw = defaultPortfolioStore.getItem(PORTFOLIO_SNAPSHOT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();

  const tab = activeTab ?? (typeof window !== 'undefined' ? (window.localStorage.getItem('horizon_active_tab') as any) : undefined);

  return {
    app: BACKUP_APP_IDENTIFIER,
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      state: {
        ...state,
        lastSelectedTab: tab || state.lastSelectedTab || 'plan',
      },
      portfolioSnapshots: Array.isArray(portfolioSnapshots) ? portfolioSnapshots : [],
      lastSelectedTab: tab || state.lastSelectedTab || 'plan',
    },
  };
}

/**
 * Generates formatted filename e.g. horizon-backup-2026-10-14.json
 */
export function getBackupFilename(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `horizon-backup-${year}-${month}-${day}.json`;
}

/**
 * Triggers client-side download of the JSON backup.
 */
export function downloadBackupFile(payload: HorizonBackupPayload): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = getBackupFilename(new Date(payload.exportedAt));
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Validates untrusted imported JSON content.
 * Checks structure, types, schema versions, numeric ranges, and dates.
 */
export function validateBackupContent(rawContent: string, fileSizeBytes?: number): BackupValidationResult {
  if (fileSizeBytes && fileSizeBytes > MAX_BACKUP_FILE_BYTES) {
    return {
      isValid: false,
      errorMessage: `File size exceeds safety limit of 5 MB (actual: ${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB).`,
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err: any) {
    return {
      isValid: false,
      errorMessage: 'Invalid JSON file. Please provide a genuine Horizon backup file.',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      isValid: false,
      errorMessage: 'Invalid backup structure: root must be an object.',
    };
  }

  // App identifier check
  if (parsed.app !== BACKUP_APP_IDENTIFIER) {
    return {
      isValid: false,
      errorMessage: `Unrecognized file origin. Expected app "${BACKUP_APP_IDENTIFIER}" but found "${parsed.app || 'unknown'}".`,
    };
  }

  // Schema version check
  const schemaVer = parsed.schemaVersion;
  if (typeof schemaVer !== 'number' || schemaVer < 1) {
    return {
      isValid: false,
      errorMessage: 'Invalid or missing schema version in backup file.',
    };
  }

  if (schemaVer > CURRENT_BACKUP_SCHEMA_VERSION) {
    return {
      isValid: false,
      errorMessage: `This backup was created with a newer version of Horizon (Schema v${schemaVer}). This version supports up to Schema v${CURRENT_BACKUP_SCHEMA_VERSION}. Please update the application.`,
    };
  }

  const data = parsed.data;
  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errorMessage: 'Missing "data" payload in backup file.',
    };
  }

  const state = data.state;
  if (!state || typeof state !== 'object') {
    return {
      isValid: false,
      errorMessage: 'Missing state record inside backup payload.',
    };
  }

  // Validate state fields and numeric values
  if (typeof state.monthlyInvestment === 'number' && state.monthlyInvestment < 0) {
    return { isValid: false, errorMessage: 'Invalid monthly investment: cannot be negative.' };
  }
  if (typeof state.totalInvestmentsValue === 'number' && state.totalInvestmentsValue < 0) {
    return { isValid: false, errorMessage: 'Invalid investments total: cannot be negative.' };
  }

  // Validate and normalize holdings
  const holdings: StockHolding[] = Array.isArray(state.stockHoldings) ? state.stockHoldings : [];
  for (const h of holdings) {
    for (const field of ['shares', 'pricePerShare', 'averageBuyingPrice', 'currentPrice'] as const) {
      const value = (h as any)[field];
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        return { isValid: false, errorMessage: `Invalid ${field} in holding "${h.symbolOrName || 'unknown'}".` };
      }
    }
    if (!h.id || typeof h.id !== 'string') {
      return { isValid: false, errorMessage: 'Corrupt holding entry: missing ID.' };
    }
    if (!h.symbolOrName && (h as any).symbol) {
      h.symbolOrName = (h as any).symbol;
    }
    if (typeof h.marketValue !== 'number' || isNaN(h.marketValue)) {
      if (typeof h.shares === 'number' && typeof (h.pricePerShare ?? (h as any).currentPrice) === 'number') {
        h.marketValue = Math.round(h.shares * ((h.pricePerShare ?? (h as any).currentPrice) as number));
      } else {
        return { isValid: false, errorMessage: `Invalid market value in holding "${h.symbolOrName || 'unknown'}".` };
      }
    }
    if (h.marketValue < 0) {
      return { isValid: false, errorMessage: `Invalid market value in holding "${h.symbolOrName || 'unknown'}".` };
    }
  }

  // Validate contribution records
  const records: ContributionRecord[] = Array.isArray(state.contributionRecords) ? state.contributionRecords : [];
  const seenIds = new Set<string>();
  let totalContributionsRecorded = 0;

  for (const r of records) {
    if (!r.id || typeof r.id !== 'string') {
      return { isValid: false, errorMessage: 'Corrupt contribution record: missing ID.' };
    }
    if (seenIds.has(r.id)) {
      return { isValid: false, errorMessage: `Duplicate contribution ID "${r.id}" detected in file.` };
    }
    seenIds.add(r.id);

    if (typeof r.amount !== 'number' || !Number.isFinite(r.amount) || r.amount < 0) {
      return { isValid: false, errorMessage: `Invalid contribution amount in record dated ${r.date}.` };
    }
    totalContributionsRecorded += r.amount;
  }

  const snapshots: PortfolioSnapshot[] = Array.isArray(data.portfolioSnapshots) ? data.portfolioSnapshots : [];

  const isJourneyActive = Boolean(
    state.journeySchedule &&
    state.journeySchedule.startMonth &&
    state.journeySchedule.isActive !== false
  );

  const preview: BackupPreview = {
    exportDate: parsed.exportedAt || new Date().toISOString(),
    schemaVersion: schemaVer,
    holdingsCount: holdings.length,
    journeyActive: isJourneyActive,
    journeyStartMonth: state.journeySchedule?.startMonth,
    contributionRecordsCount: records.length,
    totalContributionsRecorded,
    hasPortfolioSnapshots: snapshots.length > 0,
    snapshotsCount: snapshots.length,
  };

  return {
    isValid: true,
    preview,
    parsedPayload: parsed as HorizonBackupPayload,
  };
}

/**
 * Restores a validated backup into browser storage.
 * Atomic: if saving fails, existing state is not lost.
 */
export function restoreValidatedBackup(payload: HorizonBackupPayload): {
  success: boolean;
  restoredState?: HorizonState;
  errorMessage?: string;
} {
  const keys = [STORAGE_KEY, PORTFOLIO_SNAPSHOT_KEY, 'horizon_active_tab'];
  let storage: Storage;
  let previous: (string | null)[];
  try {
    storage = window.localStorage;
    previous = keys.map(key => storage.getItem(key));
  } catch {
    return { success: false, errorMessage: 'Browser storage is unavailable.' };
  }
  try {
    const incomingState = { ...payload.data.state };
    // Write directly: the portfolio adapter's memory fallback must not hide failed persistence.
    storage.setItem(STORAGE_KEY, JSON.stringify(incomingState));
    storage.setItem(PORTFOLIO_SNAPSHOT_KEY, JSON.stringify(payload.data.portfolioSnapshots ?? []));
    storage.setItem('horizon_active_tab', payload.data.lastSelectedTab || incomingState.lastSelectedTab || 'plan');
    return { success: true, restoredState: incomingState };
  } catch (err: any) {
    let rollbackFailed = false;
    keys.forEach((key, index) => {
      try {
        if (previous[index] === null) storage.removeItem(key);
        else storage.setItem(key, previous[index]!);
      } catch { rollbackFailed = true; }
    });
    return {
      success: false,
      errorMessage: rollbackFailed
        ? 'Restore failed and browser storage prevented rollback. Keep your backup and retry when storage is available.'
        : err?.message || 'Failed to write restored backup into browser storage.',
    };
  }
}
