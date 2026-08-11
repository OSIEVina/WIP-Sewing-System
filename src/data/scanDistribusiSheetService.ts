import { ScanDistribusiItem } from '../types';

export const SCAN_DISTRIBUSI_SPREADSHEET_ID = '1k2Oasyi6qV3OAwaFNn1KfJVZeDaJo2fstezaGWqd3_E';
export const SCAN_DISTRIBUSI_SPREADSHEET_GID = '1959856756';

export const SCAN_DISTRIBUSI_CSV_URL = `https://docs.google.com/spreadsheets/d/${SCAN_DISTRIBUSI_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${SCAN_DISTRIBUSI_SPREADSHEET_GID}`;

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

function normalizeDateStr(dateRaw: string): string {
  if (!dateRaw) return '';
  const clean = dateRaw.trim();
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
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  return clean;
}

export async function fetchLiveScanDistribusiItems(accessToken?: string | null): Promise<ScanDistribusiItem[]> {
  try {
    if (accessToken) {
      try {
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SCAN_DISTRIBUSI_SPREADSHEET_ID}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const matchingSheet = metaData.sheets?.find(
            (s: any) => String(s.properties?.sheetId) === SCAN_DISTRIBUSI_SPREADSHEET_GID
          );
          const sheetTitle = matchingSheet?.properties?.title || 'Scan Distribusi';

          const valuesRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SCAN_DISTRIBUSI_SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (valuesRes.ok) {
            const valuesData = await valuesRes.json();
            const rows: string[][] = valuesData.values || [];
            if (rows.length > 1) {
              return parseRows(rows);
            }
          }
        }
      } catch (err) {
        console.warn('OAuth Google Sheets REST API fetch failed for Scan Distribusi, falling back to CSV:', err);
      }
    }

    const res = await fetch(SCAN_DISTRIBUSI_CSV_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const parsedRows = lines.map(parseCsvLine);
    return parseRows(parsedRows);
  } catch (error) {
    console.error('Error fetching Scan Distribusi items:', error);
    try {
      const cached = localStorage.getItem('wip_sheet_scan_distribusi_cache');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  }
}

function parseRows(rows: string[][]): ScanDistribusiItem[] {
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const colLine = header.findIndex((h) => h.includes('line'));
  const colSpo = header.findIndex((h) => h.includes('spo'));
  const colDate = header.findIndex((h) => h.includes('tgl') || h.includes('tanggal') || h.includes('date'));
  const colSize = header.findIndex((h) => h.includes('size'));
  const colQty = header.findIndex((h) => h.includes('qty') || h.includes('pcs') || h.includes('jumlah'));

  const items: ScanDistribusiItem[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const getVal = (idx: number, fallback: string = '') =>
      idx !== -1 && row[idx] ? row[idx].replace(/^"|"$/g, '').trim() : fallback;

    const lineVal = getVal(colLine !== -1 ? colLine : 0, 'A01').toUpperCase();
    const spoVal = getVal(colSpo !== -1 ? colSpo : 1, '');
    const dateRaw = getVal(colDate !== -1 ? colDate : 2, '');
    const sizeVal = getVal(colSize !== -1 ? colSize : 3, '');
    const qtyVal = parseInt(getVal(colQty !== -1 ? colQty : 4, '0').replace(/\./g, '').replace(/,/g, ''), 10) || 0;

    if (!spoVal || !sizeVal) continue;

    items.push({
      id: `scan-dist-${lineVal}-${spoVal}-${sizeVal}-${dateRaw}-${i}`,
      line: lineVal,
      spo: spoVal,
      date: normalizeDateStr(dateRaw) || new Date().toISOString().split('T')[0],
      size: sizeVal,
      qtyPcs: qtyVal,
    });
  }

  if (items.length > 0) {
    try {
      localStorage.setItem('wip_sheet_scan_distribusi_cache', JSON.stringify(items));
    } catch {}
  }

  return items;
}
