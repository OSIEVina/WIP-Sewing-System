import { ChkItem } from '../types';
import { safeGetItem, safeSetItem } from '../utils/storage';

export const CHK10_SPREADSHEET_ID = '1k2Oasyi6qV3OAwaFNn1KfJVZeDaJo2fstezaGWqd3_E';
export const CHK10_SPREADSHEET_GID = '1420133113';

export const CHK10_GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${CHK10_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${CHK10_SPREADSHEET_GID}`;

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Normalizes date strings like "27-July-2026" or "2026-07-27" to "YYYY-MM-DD" or standard readable string
 */
function normalizeDateStr(dateRaw: string): string {
  if (!dateRaw) return '';
  const clean = dateRaw.trim();
  // Handle 27-July-2026 or 27-Jul-2026
  const parts = clean.split(/[-/\s]+/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const monthRaw = parts[1].toLowerCase();
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];

    const monthsMap: Record<string, string> = {
      jan: '01', january: '01',
      feb: '02', february: '02',
      mar: '03', march: '03',
      apr: '04', april: '04',
      may: '05',
      jun: '06', june: '06',
      jul: '07', july: '07',
      aug: '08', august: '08',
      sep: '09', september: '09',
      oct: '10', october: '10',
      nov: '11', november: '11',
      dec: '12', december: '12',
    };

    if (monthsMap[monthRaw]) {
      return `${year}-${monthsMap[monthRaw]}-${day}`;
    }
  }
  return clean;
}

/**
 * Fetches CHK10 records directly from Google Sheets CSV GViz endpoint or Google Sheets REST API
 */
export async function fetchLiveChk10Items(accessToken?: string | null): Promise<ChkItem[]> {
  try {
    let text = '';

    // If an OAuth access token is provided, attempt Google Sheets REST API v4 first
    if (accessToken) {
      try {
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${CHK10_SPREADSHEET_ID}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          // Find sheet title matching GID 1420133113 or fallback to first sheet / 'CHK10'
          const matchingSheet = metaData.sheets?.find(
            (s: any) => String(s.properties?.sheetId) === CHK10_SPREADSHEET_GID
          );
          const sheetTitle = matchingSheet?.properties?.title || 'CHK10';

          const valuesRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${CHK10_SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (valuesRes.ok) {
            const valuesData = await valuesRes.json();
            const rows: string[][] = valuesData.values || [];
            if (rows.length > 1) {
              return parseChkRows(rows);
            }
          }
        }
      } catch (err) {
        console.warn('OAuth Google Sheets REST API fetch failed, falling back to public CSV endpoint:', err);
      }
    }

    // Direct fetch from GViz CSV URL
    const res = await fetch(CHK10_GOOGLE_SHEET_CSV_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();

    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const parsedRows = lines.map(parseCsvLine);
    return parseChkRows(parsedRows);
  } catch (error) {
    console.error('Error fetching live CHK10 data from Google Sheet:', error);
    // Return cached items if available
    try {
      const cached = safeGetItem('wip_sheet_chk10_cache');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  }
}

/**
 * Parses raw 2D array of string rows into ChkItem array
 */
function parseChkRows(rows: string[][]): ChkItem[] {
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
  
  // Find column indices dynamically
  const colWeek = header.findIndex((h) => h.includes('week'));
  const colDay = header.findIndex((h) => h.includes('day'));
  const colJamKe = header.findIndex((h) => h.includes('jam'));
  const colLine = header.findIndex((h) => h.includes('line'));
  const colSpo = header.findIndex((h) => h.includes('spo'));
  const colSize = header.findIndex((h) => h.includes('size'));
  const colOutput = header.findIndex((h) => h.includes('out') || h.includes('qty'));
  const colTanggal = header.findIndex((h) => h.includes('tgl') || h.includes('tanggal') || h.includes('date'));

  const items: ChkItem[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;

    const getVal = (idx: number, fallback: string = '') =>
      idx !== -1 && row[idx] ? row[idx].replace(/^"|"$/g, '').trim() : fallback;

    const weekVal = parseInt(getVal(colWeek !== -1 ? colWeek : 0, '31'), 10) || 31;
    const dayVal = parseInt(getVal(colDay !== -1 ? colDay : 1, '1'), 10) || 1;
    const jamKeVal = parseInt(getVal(colJamKe !== -1 ? colJamKe : 2, '1'), 10) || 1;
    const lineVal = getVal(colLine !== -1 ? colLine : 3, 'A01').toUpperCase();
    const spoVal = getVal(colSpo !== -1 ? colSpo : 4, '');
    const sizeVal = getVal(colSize !== -1 ? colSize : 5, '');
    const outputVal = parseInt(getVal(colOutput !== -1 ? colOutput : 6, '0').replace(/\./g, '').replace(/,/g, ''), 10) || 0;
    const dateRaw = getVal(colTanggal !== -1 ? colTanggal : 7, '');

    if (!spoVal || !sizeVal) continue;

    items.push({
      id: `chk-gsheet-${weekVal}-${dayVal}-${jamKeVal}-${lineVal}-${spoVal}-${sizeVal}-${i}`,
      week: weekVal,
      day: dayVal,
      jamKe: jamKeVal,
      line: lineVal,
      spo: spoVal,
      size: sizeVal,
      output: outputVal,
      date: normalizeDateStr(dateRaw) || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    });
  }

  if (items.length > 0) {
    safeSetItem('wip_sheet_chk10_cache', JSON.stringify(items));
  }

  return items;
}
