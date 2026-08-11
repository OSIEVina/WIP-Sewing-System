export type BuildingId = 'A' | 'B' | 'C' | 'D';

export interface ProductionLine {
  id: string; // e.g. 'A01', 'A02', 'B01'
  building: BuildingId;
  name: string; // e.g. 'LINE A01'
  status: 'active' | 'idle' | 'in_progress';
  currentLeaderNik?: string;
  lastUpdated?: string;
}

export interface LineManpower {
  lineId: string;
  date: string; // YYYY-MM-DD
  normalHours: number; // Jam Kerja Normal (max 7)
  normalMp: number;    // MP Jam Kerja Normal
  overtimeHours: number; // Jam Kerja Lembur (max 4)
  overtimeMp: number;  // MP Jam Kerja Lembur
  updatedAt?: string;
}

export interface WipItem {
  id: string;
  lineId: string;
  spo: string;
  style: string;
  color: string;
  size: string;
  qtyOrder: number;
  unit: string;
  inHariIni: number;
  wip0: number;
  wip1: number;
  wip2: number;
  wip3: number;
  wip4: number;
  wip5: number;
  wipSewing: number;
  outSewing: number;
  chk3d: number;
  chk10Scan?: number;
  wipFinish: number;
  outPacking: number;
  normalHours?: number; // Jam Kerja Normal (max 7)
  normalMp?: number;    // MP Jam Kerja Normal
  overtimeHours?: number; // Jam Kerja Lembur (max 4)
  overtimeMp?: number;  // MP Jam Kerja Lembur
  date?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpoOption {
  spo: string;
  style: string;
  color: string;
  qtyOrder: number;
  unit: string;
  sizes: string[];
  sizeQtyMap?: Record<string, number>;
}

export interface ChkItem {
  id: string;
  week: number;
  day?: number;
  jamKe: number;
  line: string;
  spo: string;
  size: string;
  output: number;
  date?: string;
  createdAt: string;
}

export interface LeaderSession {
  nik: string;
  name?: string;
  lineId: string;
  loginTime: string;
}

export interface ScanDistribusiItem {
  id: string;
  line: string;
  spo: string;
  date: string; // YYYY-MM-DD
  size: string;
  qtyPcs: number;
}
