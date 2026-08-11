export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[Storage] Failed to set item "${key}" in localStorage:`, error);

    // Attempt cleanup of non-essential caches to free up space
    const cacheKeysToClear = [
      'wip_sheet_scan_distribusi_cache',
      'wip_sheet_chk10_cache',
      'wip_sheet_spo_options',
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

    // Try setting item again after clearing caches
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (retryError) {
      console.warn(`[Storage] Quota exceeded for "${key}". Data will persist in memory.`, retryError);
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
