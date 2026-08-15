/**
 * Date normalization and formatting utilities for consistent synchronization
 * across different devices, time zones, and Google Sheets formats.
 */

const MONTHS_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/**
 * Normalizes any date string (ISO, GMT string, slash format, etc.) to YYYY-MM-DD
 */
export function normalizeDateStr(val?: any): string {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';

  // 1. Exact YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 2. ISO string with T (e.g. 2026-08-15T00:00:00.000Z)
  if (str.includes('T')) {
    const part = str.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
      return part;
    }
  }

  // 3. String containing English month name (e.g. "Sat Aug 15 2026 00:00:00 GMT+0700 (Indochina Time)")
  const matchMonth = str.match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/i
  );
  if (matchMonth) {
    const monthKey = matchMonth[1].toLowerCase().slice(0, 3);
    const monthNum = MONTHS_MAP[monthKey] || '01';
    const day = matchMonth[2].padStart(2, '0');
    const year = matchMonth[3];
    return `${year}-${monthNum}-${day}`;
  }

  // 4. String format like "15 Aug 2026" or "15-Aug-2026"
  const matchDayMonth = str.match(
    /(\d{1,2})[\s\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\-](\d{4})/i
  );
  if (matchDayMonth) {
    const day = matchDayMonth[1].padStart(2, '0');
    const monthKey = matchDayMonth[2].toLowerCase().slice(0, 3);
    const monthNum = MONTHS_MAP[monthKey] || '01';
    const year = matchDayMonth[3];
    return `${year}-${monthNum}-${day}`;
  }

  // 5. Slash or hyphen format: DD/MM/YYYY or DD-MM-YYYY
  const matchSlash = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchSlash) {
    const day = matchSlash[1].padStart(2, '0');
    const month = matchSlash[2].padStart(2, '0');
    const year = matchSlash[3];
    return `${year}-${month}-${day}`;
  }

  // 6. Fallback via Date parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    try {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return str.split('T')[0] || str;
    }
  }

  return str;
}

/**
 * Returns today's date in YYYY-MM-DD
 */
export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
