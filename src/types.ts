export type BuildingId = 'A' | 'B' | 'C' | 'D';

export interface ProductionLine {
  id: string; // e.g. 'A01', 'A02', 'B01'
  building: BuildingId;
  name: string; // e.g. 'LINE A01'
  status: 'active' | 'idle' | 'in_progress';
  currentLeaderNik?: string;
  lastUpdated?: string;
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
  wipFinish: number;
  outPacking: number;
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
