import { LineManpower, WipItem } from '../types';
import { safeGetItem, safeSetItem } from './storage';
import { normalizeDateStr } from './date';

const STORAGE_KEY = 'wip_sewing_line_manpower';

const cleanLineId = (id: string) => (id ? id.trim().toUpperCase() : '');

export function getAllLineManpower(): Record<string, LineManpower> {
  try {
    const saved = safeGetItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (err) {
    console.error('Failed to parse line manpower data:', err);
    return {};
  }
}

export function getLineManpower(lineId: string, date: string, wipItems?: WipItem[]): LineManpower {
  const normDate = normalizeDateStr(date);
  const cleanLine = cleanLineId(lineId);
  const all = getAllLineManpower();
  const key = `${cleanLine}_${normDate}`;
  
  if (all[key]) {
    return all[key];
  }

  // Fallback: check if any WIP item on this Line & Date already has manpower filled
  if (wipItems && Array.isArray(wipItems)) {
    const getItemDate = (i: WipItem) =>
      normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : ''));

    const found = wipItems.find(
      (item) =>
        cleanLineId(item.lineId) === cleanLine &&
        getItemDate(item) === normDate &&
        (item.normalHours !== undefined || item.normalMp !== undefined || item.overtimeHours !== undefined || item.overtimeMp !== undefined)
    );

    if (found) {
      const fromItem: LineManpower = {
        lineId: cleanLine,
        date: normDate,
        normalHours: found.normalHours !== undefined ? found.normalHours : 7,
        normalMp: found.normalMp !== undefined ? found.normalMp : 25,
        overtimeHours: found.overtimeHours !== undefined ? found.overtimeHours : 0,
        overtimeMp: found.overtimeMp !== undefined ? found.overtimeMp : 0,
      };
      // Save it so future calls are instantaneous
      saveLineManpower(fromItem);
      return fromItem;
    }
  }

  return {
    lineId: cleanLine,
    date: normDate,
    normalHours: 7,
    normalMp: 25,
    overtimeHours: 0,
    overtimeMp: 0,
  };
}

export function saveLineManpower(data: LineManpower): void {
  const normDate = normalizeDateStr(data.date);
  const cleanLine = cleanLineId(data.lineId);
  const all = getAllLineManpower();
  const key = `${cleanLine}_${normDate}`;
  all[key] = {
    ...data,
    lineId: cleanLine,
    date: normDate,
    updatedAt: new Date().toISOString(),
  };
  safeSetItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteLineManpower(lineId: string, date: string): void {
  const normDate = normalizeDateStr(date);
  const cleanLine = cleanLineId(lineId);
  const all = getAllLineManpower();
  const key = `${cleanLine}_${normDate}`;
  if (all[key]) {
    delete all[key];
    safeSetItem(STORAGE_KEY, JSON.stringify(all));
  }
}

export function checkManpowerDeviation(mp: { normalHours: number; overtimeHours: number }) {
  const reasons: string[] = [];
  const totalHours = (mp.normalHours || 0) + (mp.overtimeHours || 0);

  if ((mp.overtimeHours || 0) > 4) {
    reasons.push(`Jam kerja lembur (${mp.overtimeHours} jam) melebihi batas maksimal 4 jam dalam sehari!`);
  }
  if (totalHours > 11) {
    reasons.push(`Total jam kerja (${totalHours} jam) melebihi batas maksimal 11 jam dalam sehari (7 jam normal + 4 jam lembur)!`);
  }
  if ((mp.normalHours || 0) > 7) {
    reasons.push(`Jam kerja normal (${mp.normalHours} jam) melebihi batas standar 7 jam!`);
  }

  return {
    isDeviation: reasons.length > 0,
    reasons,
    totalHours,
  };
}
