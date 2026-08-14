export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // Attempt cleanup of non-essential/large temporary caches to free up space
    const cacheKeysToClear = [
      'wip_sheet_scan_distribusi_cache',
      'wip_sheet_chk10_cache',
      'wip_sheet_spo_options',
      'wip_sewing_spos',
    ];

    for (const cacheKey of cacheKeysToClear) {
      if (cacheKey !== key) {
        try {
          localStorage.removeItem(cacheKey);
        } catch {
          // ignore
        }
      }
    }

    // Try setting item again after clearing non-essential caches
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (retryError) {
      // Gracefully handle storage quota limit (data continues to live safely in active app state RAM)
      console.info(`[Storage] Quota browser lokal (localStorage) penuh untuk "${key}". Data tetap aktif berjalan di memori browser (RAM).`);
      return false;
    }
  }
}

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`[Storage] Failed to read "${key}" from localStorage:`, error);
    return null;
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[Storage] Failed to remove "${key}" from localStorage:`, error);
  }
}
