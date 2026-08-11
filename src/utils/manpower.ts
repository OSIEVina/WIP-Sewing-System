import { LineManpower } from '../types';

const STORAGE_KEY = 'wip_sewing_line_manpower';

const cleanLineId = (id: string) => (id ? id.trim().toUpperCase() : '');

export function getAllLineManpower(): Record<string, LineManpower> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (err) {
    console.error('Failed to parse line manpower data:', err);
    return {};
  }
}

export function getLineManpower(lineId: string, date: string): LineManpower {
  const all = getAllLineManpower();
  const key = `${cleanLineId(lineId)}_${date}`;
  if (all[key]) {
    return all[key];
  }
  return {
    lineId,
    date,
    normalHours: 7,
    normalMp: 25,
    overtimeHours: 0,
    overtimeMp: 0,
  };
}

export function saveLineManpower(data: LineManpower): void {
  const all = getAllLineManpower();
  const key = `${cleanLineId(data.lineId)}_${data.date}`;
  all[key] = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteLineManpower(lineId: string, date: string): void {
  const all = getAllLineManpower();
  const key = `${cleanLineId(lineId)}_${date}`;
  if (all[key]) {
    delete all[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
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
