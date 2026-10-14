/**
 * Backup and Restore Service for Horizon
 * 
 * Generates versioned JSON checkpoints (`horizon-backup-YYYY-MM-DD.json`)
 * and validates/imports them securely without cloud sync or servers.
 */

import { HorizonState } from '../types/horizon';
import { loadPortfolioSnapshots, PORTFOLIO_SNAPSHOT_KEY } from './portfolioStorage';

export const BACKUP_APP_IDENTIFIER = 'horizon_investment_companion_pk';
export const CURRENT_BACKUP_SCHEMA_VERSION = 3;

export interface HorizonBackupFile {
  appIdentifier: string;
  schemaVersion: number;
  exportTimestamp: string;
  state: HorizonState;
  portfolioSnapshots: any[];
}

/**
 * Generates and triggers a JSON file download of the user's complete backup.
 */
export function exportHorizonBackup(state: HorizonState): { success: boolean; filename: string; error?: string } {
  if (typeof window === 'undefined') {
    return { success: false, filename: '', error: 'Browser environment required' };
  }

  try {
    const snapshots = loadPortfolioSnapshots();
    const backupData: HorizonBackupFile = {
      appIdentifier: BACKUP_APP_IDENTIFIER,
      schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
      exportTimestamp: new Date().toISOString(),
      state: {
        ...state,
        version: CURRENT_BACKUP_SCHEMA_VERSION,
      },
      portfolioSnapshots: snapshots,
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `horizon-backup-${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, filename };
  } catch (err: any) {
    return { success: false, filename: '', error: err?.message || 'Failed to export backup' };
  }
}

export interface ImportValidationResult {
  valid: boolean;
  error?: string;
  preview?: {
    exportDate: string;
    holdingsCount: number;
    journeyStart?: string;
    totalMarketValue: number;
  };
  backupFile?: HorizonBackupFile;
}

/**
 * Validates an uploaded JSON backup file string securely.
 */
export function validateHorizonBackupFile(rawJson: string): ImportValidationResult {
  try {
    const data = JSON.parse(rawJson);
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Backup file is not a valid JSON object.' };
    }

    if (data.appIdentifier !== BACKUP_APP_IDENTIFIER) {
      return { valid: false, error: 'Invalid backup file: Unrecognized application identifier.' };
    }

    if (typeof data.schemaVersion !== 'number' || data.schemaVersion > CURRENT_BACKUP_SCHEMA_VERSION) {
      return {
        valid: false,
        error: `Unsupported backup version (${data.schemaVersion}). This app supports up to version ${CURRENT_BACKUP_SCHEMA_VERSION}.`,
      };
    }

    if (!data.state || typeof data.state !== 'object') {
      return { valid: false, error: 'Backup file missing saved state data.' };
    }

    const state = data.state as HorizonState;
    const holdings = Array.isArray(state.stockHoldings) ? state.stockHoldings : [];
    const journeyStart = state.journeySchedule?.startMonth;
    const totalMarketValue = holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
    const exportDate = data.exportTimestamp
      ? new Date(data.exportTimestamp).toLocaleDateString()
      : 'Unknown date';

    return {
      valid: true,
      preview: {
        exportDate,
        holdingsCount: holdings.length,
        journeyStart,
        totalMarketValue,
      },
      backupFile: data as HorizonBackupFile,
    };
  } catch (err: any) {
    return { valid: false, error: `Malformed JSON file: ${err?.message || 'Syntax error'}` };
  }
}

/**
 * Applies a validated backup file to localStorage.
 */
export function applyHorizonBackup(backup: HorizonBackupFile): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const storageKey = 'horizon_investing_state_v2';
    const statePayload = {
      ...backup.state,
      version: CURRENT_BACKUP_SCHEMA_VERSION,
      lastUpdated: new Date().toISOString(),
    };

    window.localStorage.setItem(storageKey, JSON.stringify(statePayload));
    if (Array.isArray(backup.portfolioSnapshots)) {
      window.localStorage.setItem(PORTFOLIO_SNAPSHOT_KEY, JSON.stringify(backup.portfolioSnapshots));
    }
    window.localStorage.removeItem('horizon_active_tab');
    return true;
  } catch (err) {
    console.warn('Failed to apply backup to localStorage:', err);
    return false;
  }
}
