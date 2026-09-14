/**
 * PAPER MAX - Backup and Restore Engine
 * Provides safe export and import of versioned JSON backups with rollback safety.
 */

import { STORAGE_KEYS } from './storage.js';

export function getLastBackupTimestamp() {
  try {
    return localStorage.getItem('papermax.last_backup.v1') || null;
  } catch (e) {
    return null;
  }
}

export function setLastBackupTimestamp(isoString) {
  try {
    localStorage.setItem('papermax.last_backup.v1', isoString);
  } catch (e) {
    console.error('[Backup] Error saving last backup timestamp:', e);
  }
}

export function exportBackup() {
  try {
    const collections = {};
    for (const [keyName, storageKey] of Object.entries(STORAGE_KEYS)) {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        try {
          collections[keyName] = JSON.parse(raw);
        } catch (e) {
          collections[keyName] = raw;
        }
      } else {
        collections[keyName] = null;
      }
    }

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());

    const backupPayload = {
      app: 'PAPER MAX',
      version: '1.0',
      backupVersion: 1,
      exportedAt: now.toISOString(),
      collections
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `PAPER-MAX-backup-${yyyy}-${mm}-${dd}-${hh}-${min}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setLastBackupTimestamp(now.toISOString());
    return { success: true, timestamp: now.toISOString() };
  } catch (err) {
    console.error('[Backup] Export failed:', err);
    return { success: false, error: err.message };
  }
}

export function restoreBackup(jsonString) {
  // 1. Take a full snapshot of current localStorage state for rollback safety
  const rollbackSnapshot = {};
  for (const storageKey of Object.values(STORAGE_KEYS)) {
    rollbackSnapshot[storageKey] = localStorage.getItem(storageKey);
  }

  try {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseErr) {
      return { success: false, error: 'Arquivo JSON inválido ou corrompido.' };
    }

    // 2. Validate structure & version
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Estrutura do arquivo de backup inválida.' };
    }
    if (parsed.app !== 'PAPER MAX') {
      return { success: false, error: 'O arquivo selecionado não pertence ao sistema PAPER MAX.' };
    }
    if (!parsed.collections || typeof parsed.collections !== 'object') {
      return { success: false, error: 'Coleções de dados ausentes ou inválidas no backup.' };
    }

    // 3. Apply collections to localStorage safely
    for (const [keyName, storageKey] of Object.entries(STORAGE_KEYS)) {
      const data = parsed.collections[keyName];
      if (data !== undefined && data !== null) {
        localStorage.setItem(storageKey, typeof data === 'string' ? data : JSON.stringify(data));
      } else {
        localStorage.removeItem(storageKey);
      }
    }

    // Set last backup or restore timestamp
    localStorage.setItem('papermax.last_backup.v1', new Date().toISOString());

    return { success: true };
  } catch (err) {
    console.error('[Backup] Restore failed, rolling back:', err);
    // Rollback to previous state
    try {
      for (const [storageKey, val] of Object.entries(rollbackSnapshot)) {
        if (val !== null) {
          localStorage.setItem(storageKey, val);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch (rbErr) {
      console.error('[Backup] Critical rollback failure:', rbErr);
    }
    return { success: false, error: `Falha ao restaurar dados: ${err.message}` };
  }
}
