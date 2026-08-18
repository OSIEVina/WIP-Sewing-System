import { LineManpower, WipItem } from '../types';
import { safeGetItem, safeSetItem } from './storage';
import { normalizeDateStr } from './date';

const STORAGE_KEY = 'wip_sewing_line_manpower';

const cleanLineId = (id: string) => (id ? id.trim().toUpperCase() : '');

export function getAllLineManpower(wipItems?: WipItem[]): Record<string, LineManpower> {
  let all: Record<string, LineManpower> = {};
  try {
    const saved = safeGetItem(STORAGE_KEY);
    all = saved ? JSON.parse(saved) : {};
  } catch (err) {
    console.error('Failed to parse line manpower data:', err);
    all = {};
  }

  // If wipItems provided or available in storage, ensure all entries are synchronized from spreadsheet data
  let itemsToSearch = wipItems;
  if (!itemsToSearch || !Array.isArray(itemsToSearch)) {
    try {
      const savedItems = safeGetItem('wip_sewing_items');
      if (savedItems) {
        itemsToSearch = JSON.parse(savedItems);
      }
    } catch {}
  }

  if (itemsToSearch && Array.isArray(itemsToSearch) && itemsToSearch.length > 0) {
    const getItemDate = (i: WipItem) =>
      normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : ''));

    itemsToSearch.forEach((item) => {
      if (!item.lineId) return;
      const cleanLine = cleanLineId(item.lineId);
      const normDate = getItemDate(item);
      if (!normDate) return;
      const key = `${cleanLine}_${normDate}`;

      const itemTimestamp = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const existing = all[key];
      const existingTimestamp = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;

      const hasMpValues =
        (item.normalHours !== undefined && item.normalHours > 0) ||
        (item.normalMp !== undefined && item.normalMp > 0) ||
        (item.overtimeHours !== undefined && item.overtimeHours > 0) ||
        (item.overtimeMp !== undefined && item.overtimeMp > 0);

      if (hasMpValues && (!existing || itemTimestamp >= existingTimestamp)) {
        all[key] = {
          lineId: cleanLine,
          date: normDate,
          normalHours: item.normalHours !== undefined ? Number(item.normalHours) : (existing?.normalHours ?? 7),
          normalMp: item.normalMp !== undefined ? Number(item.normalMp) : (existing?.normalMp ?? 25),
          overtimeHours: item.overtimeHours !== undefined ? Number(item.overtimeHours) : (existing?.overtimeHours ?? 0),
          overtimeMp: item.overtimeMp !== undefined ? Number(item.overtimeMp) : (existing?.overtimeMp ?? 0),
          updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
        };
      }
    });
  }

  return all;
}

export function syncManpowerFromWipItems(items: WipItem[]): void {
  if (!items || !Array.isArray(items) || items.length === 0) return;
  const all = getAllLineManpower();
  let changed = false;

  const getItemDate = (i: WipItem) =>
    normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : ''));

  // Group items by Line + Date
  const groupMap = new Map<string, WipItem[]>();
  items.forEach((item) => {
    if (!item.lineId) return;
    const cleanLine = cleanLineId(item.lineId);
    const normDate = getItemDate(item);
    if (!normDate) return;
    const key = `${cleanLine}_${normDate}`;
    const list = groupMap.get(key) || [];
    list.push(item);
    groupMap.set(key, list);
  });

  groupMap.forEach((lineItems, key) => {
    const sorted = [...lineItems].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    );

    const latestWithMp = sorted.find(
      (i) =>
        (i.normalHours !== undefined && i.normalHours > 0) ||
        (i.normalMp !== undefined && i.normalMp > 0) ||
        (i.overtimeHours !== undefined && i.overtimeHours > 0) ||
        (i.overtimeMp !== undefined && i.overtimeMp > 0)
    ) || sorted[0];

    if (
      latestWithMp &&
      (latestWithMp.normalHours !== undefined ||
        latestWithMp.normalMp !== undefined ||
        latestWithMp.overtimeHours !== undefined ||
        latestWithMp.overtimeMp !== undefined)
    ) {
      const [cleanLine, normDate] = key.split('_');
      const itemTimestamp = new Date(latestWithMp.updatedAt || latestWithMp.createdAt || 0).getTime();
      const existing = all[key];
      const existingTimestamp = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;

      if (!existing || itemTimestamp >= existingTimestamp || (latestWithMp.normalHours && !existing.normalHours)) {
        all[key] = {
          lineId: cleanLine,
          date: normDate,
          normalHours: latestWithMp.normalHours !== undefined ? Number(latestWithMp.normalHours) : (existing?.normalHours ?? 7),
          normalMp: latestWithMp.normalMp !== undefined ? Number(latestWithMp.normalMp) : (existing?.normalMp ?? 25),
          overtimeHours: latestWithMp.overtimeHours !== undefined ? Number(latestWithMp.overtimeHours) : (existing?.overtimeHours ?? 0),
          overtimeMp: latestWithMp.overtimeMp !== undefined ? Number(latestWithMp.overtimeMp) : (existing?.overtimeMp ?? 0),
          updatedAt: latestWithMp.updatedAt || latestWithMp.createdAt || new Date().toISOString(),
        };
        changed = true;
      }
    }
  });

  if (changed) {
    safeSetItem(STORAGE_KEY, JSON.stringify(all));
  }
}

export function getLineManpower(lineId: string, date: string, wipItems?: WipItem[]): LineManpower {
  const normDate = normalizeDateStr(date);
  const cleanLine = cleanLineId(lineId);
  const all = getAllLineManpower(wipItems);
  const key = `${cleanLine}_${normDate}`;
  const localCached = all[key];

  // Resolve items: from parameter, or from localStorage synced items
  let itemsToSearch = wipItems;
  if (!itemsToSearch || !Array.isArray(itemsToSearch)) {
    try {
      const savedItems = safeGetItem('wip_sewing_items');
      if (savedItems) {
        itemsToSearch = JSON.parse(savedItems);
      }
    } catch {}
  }

  if (itemsToSearch && Array.isArray(itemsToSearch) && itemsToSearch.length > 0) {
    const getItemDate = (i: WipItem) =>
      normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : ''));

    const matching = itemsToSearch
      .filter((item) => cleanLineId(item.lineId) === cleanLine && getItemDate(item) === normDate)
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
      );

    const found = matching.find(
      (item) =>
        (item.normalHours !== undefined && item.normalHours > 0) ||
        (item.normalMp !== undefined && item.normalMp > 0) ||
        (item.overtimeHours !== undefined && item.overtimeHours > 0) ||
        (item.overtimeMp !== undefined && item.overtimeMp > 0)
    ) || matching[0];

    if (
      found &&
      (found.normalHours !== undefined ||
        found.normalMp !== undefined ||
        found.overtimeHours !== undefined ||
        found.overtimeMp !== undefined)
    ) {
      const itemTimestamp = new Date(found.updatedAt || found.createdAt || 0).getTime();
      const localTimestamp = localCached?.updatedAt ? new Date(localCached.updatedAt).getTime() : 0;

      // If remote item timestamp is newer or equal, or local cache was empty/default, use spreadsheet item!
      if (itemTimestamp >= localTimestamp || !localCached) {
        const fromItem: LineManpower = {
          lineId: cleanLine,
          date: normDate,
          normalHours: found.normalHours !== undefined ? Number(found.normalHours) : (localCached?.normalHours ?? 7),
          normalMp: found.normalMp !== undefined ? Number(found.normalMp) : (localCached?.normalMp ?? 25),
          overtimeHours: found.overtimeHours !== undefined ? Number(found.overtimeHours) : (localCached?.overtimeHours ?? 0),
          overtimeMp: found.overtimeMp !== undefined ? Number(found.overtimeMp) : (localCached?.overtimeMp ?? 0),
          updatedAt: found.updatedAt || found.createdAt || new Date().toISOString(),
        };
        saveLineManpower(fromItem);
        return fromItem;
      }
    }
  }

  if (localCached) {
    return localCached;
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
    updatedAt: data.updatedAt || new Date().toISOString(),
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
