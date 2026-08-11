import { SpoOption } from '../types';
import { safeGetItem, safeSetItem } from '../utils/storage';

export const SPO_GOOGLE_SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1k2Oasyi6qV3OAwaFNn1KfJVZeDaJo2fstezaGWqd3_E/gviz/tq?tqx=out:csv&gid=672991499';

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
 * Fetches SPO options live from the provided Google Sheet CSV.
 */
export async function fetchLiveSpoOptions(): Promise<SpoOption[]> {
  try {
    const res = await fetch(SPO_GOOGLE_SHEET_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.split(/\r?\n/);

    if (lines.length < 2) return [];

    const spoMap = new Map<
      string,
      {
        spo: string;
        style: string;
        color: string;
        qtyOrder: number;
        unit: string;
        sizesSet: Set<string>;
        sizeQtyMap: Record<string, number>;
      }
    >();

    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      if (row.length < 4) continue;

      const spo = row[0].replace(/^"|"$/g, '');
      const style = row[1].replace(/^"|"$/g, '');
      const color = row[2].replace(/^"|"$/g, '');
      const size = row[3].replace(/^"|"$/g, '');
      const qtyStr = row[5] ? row[5].replace(/^"|"$/g, '') : '0';
      const unit = row[6] ? row[6].replace(/^"|"$/g, '') : 'PCE';

      if (!spo || spo === 'SPO#') continue;

      const cleanQty =
        parseInt(qtyStr.replace(/\./g, '').replace(/,/g, ''), 10) || 0;
      const key = `${spo}|${style}|${color}`;

      if (!spoMap.has(key)) {
        spoMap.set(key, {
          spo,
          style,
          color,
          qtyOrder: 0,
          unit: unit || 'PCE',
          sizesSet: new Set(),
          sizeQtyMap: {},
        });
      }

      const item = spoMap.get(key)!;
      item.qtyOrder += cleanQty;
      if (size) {
        item.sizesSet.add(size);
        item.sizeQtyMap[size] = (item.sizeQtyMap[size] || 0) + cleanQty;
      }
    }

    const result: SpoOption[] = Array.from(spoMap.values()).map((item) => ({
      spo: item.spo,
      style: item.style,
      color: item.color,
      qtyOrder: item.qtyOrder,
      unit: item.unit,
      sizes: Array.from(item.sizesSet),
      sizeQtyMap: item.sizeQtyMap,
    }));

    if (result.length > 0) {
      // Save cache in localStorage for instant offline/fast load
      safeSetItem('wip_sheet_spo_options', JSON.stringify(result));
      return result;
    }
  } catch (err) {
    console.warn('Failed to fetch live SPO spreadsheet, using cached/fallback data:', err);
  }

  // Fallback to cache if network fails
  try {
    const cached = safeGetItem('wip_sheet_spo_options');
    if (cached) return JSON.parse(cached);
  } catch {}

  return [];
}
