import React, { useState, useRef, useMemo } from 'react';
import { WipItem, ChkItem, ScanDistribusiItem } from '../types';
import { getLineManpower, getAllLineManpower, saveLineManpower, deleteLineManpower, checkManpowerDeviation } from '../utils/manpower';
import { Search, Download, Trash2, Edit3, Table, FileSpreadsheet, FileText, X, Check, Layers, Calendar, Upload, Users, Clock, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PdfExportModal } from './PdfExportModal';

interface WipTableProps {
  items: WipItem[];
  chkItems?: ChkItem[];
  scanItems?: ScanDistribusiItem[];
  globalReportDate?: string;
  setGlobalReportDate?: (d: string) => void;
  onDeleteItem?: (id: string, item?: WipItem) => void;
  onUpdateItem?: (updatedItem: WipItem) => void;
  onImportItems?: (newItems: WipItem[]) => void;
  hideExportButtons?: boolean;
  activeLineId?: string;
}

export const WipTable: React.FC<WipTableProps> = ({
  items,
  chkItems = [],
  scanItems = [],
  globalReportDate: propGlobalDate,
  setGlobalReportDate: propSetGlobalDate,
  onDeleteItem,
  onUpdateItem,
  onImportItems,
  hideExportButtons = false,
  activeLineId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tableFilter, setTableFilter] = useState('');
  const [localDate, setLocalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const globalReportDate = propGlobalDate !== undefined ? propGlobalDate : localDate;
  const setGlobalReportDate = propSetGlobalDate || setLocalDate;
  const [editingManpower, setEditingManpower] = useState<{ lineId: string; date: string; normalHours: number; normalMp: number; overtimeHours: number; overtimeMp: number } | null>(null);
  const [editModalItem, setEditModalItem] = useState<WipItem | null>(null);
  const [manpowerTick, setManpowerTick] = useState<number>(0);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  const getItemDate = (item: WipItem) =>
    item.date || (item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);

  // Extract list of unique dates available in items, plus today and tomorrow
  const rawDates = items.map(getItemDate);
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

  const availableDates = Array.from(new Set([...rawDates, todayStr, tomorrowStr])).sort().reverse();

  const cleanLine = (l?: string) => (l ? l.trim().toUpperCase() : '');
  const cleanSpo = (s?: string) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
  const cleanSize = (sz?: string) => (sz ? sz.replace(/\s+/g, '').toLowerCase() : '');

  // Helper to resolve dynamic CHK10 inspection value for a given WIP item
  const getChk10Value = (item: WipItem) => {
    const itemDate = getItemDate(item);
    const itemLine = cleanLine(item.lineId);
    const itemSpo = cleanSpo(item.spo);
    const itemSize = cleanSize(item.size);

    if (chkItems && chkItems.length > 0) {
      const dateMatches = chkItems.filter((c) => {
        const cLine = cleanLine(c.line);
        const cSpo = cleanSpo(c.spo);
        const cSize = cleanSize(c.size);
        const cDate = c.date ? c.date.trim() : (c.createdAt ? c.createdAt.split('T')[0] : '');
        const lineMatch = !itemLine || !cLine || cLine === itemLine;
        return lineMatch && cSpo === itemSpo && cSize === itemSize && (!itemDate || !cDate || cDate === itemDate);
      });

      const dateSum = dateMatches.reduce((sum, c) => sum + (c.output || 0), 0);
      if (dateSum > 0) return dateSum;
    }

    return item.chk3d || 0;
  };

  const getScanDistribusiValue = (item: WipItem) => {
    const itemDate = getItemDate(item);
    const itemLine = cleanLine(item.lineId);
    const itemSpo = cleanSpo(item.spo);
    const itemSize = cleanSize(item.size);

    if (scanItems && scanItems.length > 0) {
      const matches = scanItems.filter((s) => {
        const sLine = cleanLine(s.line);
        const sSpo = cleanSpo(s.spo);
        const sSize = cleanSize(s.size);
        const sDate = s.date ? s.date.trim() : '';
        const lineMatch = !itemLine || !sLine || sLine === itemLine;
        return lineMatch && sSpo === itemSpo && sSize === itemSize && (!itemDate || !sDate || sDate === itemDate);
      });
      const sheetSum = matches.reduce((sum, s) => sum + (s.qtyPcs || 0), 0);
      if (sheetSum > 0) return sheetSum;
    }
    return item.chk10Scan || 0;
  };

  // Formula: Akumulasi Output Sewing - Akumulasi Out Packing untuk SPO & Size ini di Line ini (tanpa memandang hari)
  const getItemWipFinish = (item: WipItem) => {
    const matchingItems = items.filter(
      (i) =>
        cleanLine(i.lineId) === cleanLine(item.lineId) &&
        cleanSpo(i.spo) === cleanSpo(item.spo) &&
        cleanSize(i.size) === cleanSize(item.size)
    );
    const totalOutSewing = matchingItems.reduce((sum, i) => sum + (i.outSewing || 0), 0);
    const totalOutPacking = matchingItems.reduce((sum, i) => sum + (i.outPacking || 0), 0);
    return Math.max(0, totalOutSewing - totalOutPacking);
  };

  // Helper to calculate carryover values for a specific SPO + Size combination up to a given date
  const getCarryoverValues = (lineId: string, spo: string, size: string, targetDate: string) => {
    const priorItems = items.filter(
      (i) =>
        cleanLine(i.lineId) === cleanLine(lineId) &&
        cleanSpo(i.spo) === cleanSpo(spo) &&
        cleanSize(i.size) === cleanSize(size) &&
        getItemDate(i) < targetDate
    );

    const pastScanIn = priorItems.reduce((sum, i) => sum + (i.inHariIni || 0), 0);
    const pastOutSewing = priorItems.reduce((sum, i) => sum + (i.outSewing || 0), 0);
    const pastOutPacking = priorItems.reduce((sum, i) => sum + (i.outPacking || 0), 0);

    const carryoverWipSewing = Math.max(0, pastScanIn - pastOutSewing);
    const carryoverWipFinish = Math.max(0, pastOutSewing - pastOutPacking);

    return {
      pastScanIn,
      pastOutSewing,
      pastOutPacking,
      carryoverWipSewing,
      carryoverWipFinish,
    };
  };

  // Process items: if globalReportDate is set and certain SPOs don't have records on that date,
  // carry over existing active SPOs into globalReportDate so the user can see and edit them directly!
  const processedItems = React.useMemo(() => {
    if (!globalReportDate) {
      return items;
    }

    const existingOnDate = items.filter((item) => getItemDate(item) === globalReportDate);
    const existingKeys = new Set(
      existingOnDate.map((i) => `${cleanLine(i.lineId)}|${cleanSpo(i.spo)}|${cleanSize(i.size)}`)
    );

    const uniqueCombinationMap = new Map<string, WipItem>();
    items.forEach((item) => {
      const key = `${cleanLine(item.lineId)}|${cleanSpo(item.spo)}|${cleanSize(item.size)}`;
      if (!uniqueCombinationMap.has(key)) {
        uniqueCombinationMap.set(key, item);
      }
    });

    const resultList = [...existingOnDate];

    uniqueCombinationMap.forEach((templateItem, key) => {
      if (!existingKeys.has(key)) {
        const { carryoverWipSewing, carryoverWipFinish } = getCarryoverValues(
          templateItem.lineId,
          templateItem.spo,
          templateItem.size,
          globalReportDate
        );

        const projectedItem: WipItem = {
          id: `proj-${templateItem.lineId}-${templateItem.spo}-${templateItem.size}-${globalReportDate}`,
          lineId: templateItem.lineId,
          spo: templateItem.spo,
          style: templateItem.style,
          color: templateItem.color,
          size: templateItem.size,
          qtyOrder: templateItem.qtyOrder,
          unit: templateItem.unit,
          date: globalReportDate,
          inHariIni: 0,
          wip0: 0,
          wip1: 0,
          wip2: 0,
          wip3: 0,
          wip4: 0,
          wip5: 0,
          wipSewing: carryoverWipSewing,
          outSewing: 0,
          chk3d: 0,
          wipFinish: carryoverWipFinish,
          outPacking: 0,
          createdAt: `${globalReportDate}T00:00:00.000Z`,
          updatedAt: `${globalReportDate}T00:00:00.000Z`,
        };

        resultList.push(projectedItem);
      }
    });

    return resultList;
  }, [items, globalReportDate]);

  const filteredItems = processedItems.filter((item) => {
    const itemDate = getItemDate(item);
    const matchesText =
      item.spo.toLowerCase().includes(tableFilter.toLowerCase()) ||
      item.style.toLowerCase().includes(tableFilter.toLowerCase()) ||
      item.color.toLowerCase().includes(tableFilter.toLowerCase()) ||
      item.size.toLowerCase().includes(tableFilter.toLowerCase()) ||
      itemDate.includes(tableFilter);
    const matchesDate = !globalReportDate || itemDate === globalReportDate;
    return matchesText && matchesDate;
  });

  // Extract distinct Line entries paired with the single globalReportDate for the Manpower Summary Table
  const lineDatePairs = useMemo(() => {
    const lineSet = new Set<string>();
    if (activeLineId) {
      lineSet.add(cleanLine(activeLineId));
    }
    items.forEach((item) => {
      if (item.lineId) {
        lineSet.add(cleanLine(item.lineId));
      }
    });

    const lines = Array.from(lineSet).sort();
    if (lines.length === 0) {
      lines.push(activeLineId ? cleanLine(activeLineId) : 'A01');
    }

    const targetDate = globalReportDate || todayStr;
    return lines.map((lineId) => ({
      lineId,
      date: targetDate,
    }));
  }, [items, globalReportDate, todayStr, manpowerTick, activeLineId]);

  // Compute overall deviations for warning notice
  const allDeviations = useMemo(() => {
    const list: { lineId: string; date: string; reasons: string[] }[] = [];
    lineDatePairs.forEach(({ lineId, date }) => {
      const mp = getLineManpower(lineId, date);
      const dev = checkManpowerDeviation(mp);
      if (dev.isDeviation) {
        list.push({ lineId, date, reasons: dev.reasons });
      }
    });
    return list;
  }, [lineDatePairs, manpowerTick]);

  // Group items by SPO to render TOTAL rows as seen in screenshot
  const spoGroups: Record<string, WipItem[]> = {};
  filteredItems.forEach((item) => {
    if (!spoGroups[item.spo]) {
      spoGroups[item.spo] = [];
    }
    spoGroups[item.spo].push(item);
  });

  const handleStartEdit = (item: WipItem) => {
    setEditModalItem({
      ...item,
      chk3d: getChk10Value(item),
      chk10Scan: item.chk10Scan !== undefined ? item.chk10Scan : getScanDistribusiValue(item),
    });
  };

  const handleSaveModalEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editModalItem && onUpdateItem) {
      const targetDate = getItemDate(editModalItem);
      const { pastScanIn, pastOutSewing, pastOutPacking, carryoverWipSewing } = getCarryoverValues(
        editModalItem.lineId,
        editModalItem.spo,
        editModalItem.size,
        targetDate
      );

      const stationSum =
        (editModalItem.wip0 || 0) +
        (editModalItem.wip1 || 0) +
        (editModalItem.wip2 || 0) +
        (editModalItem.wip3 || 0) +
        (editModalItem.wip4 || 0) +
        (editModalItem.wip5 || 0);

      // Total WIP Sewing = carryover WIP Sewing + Scan In Today - Output Sewing Today
      const computedWipSewing =
        stationSum > 0
          ? stationSum
          : Math.max(0, carryoverWipSewing + (editModalItem.inHariIni || 0) - (editModalItem.outSewing || 0));

      // Total WIP Finishing = (Past Out Sewing + Out Sewing Today) - (Past Out Packing + Out Packing Today)
      const totalCumulativeOutSewing = pastOutSewing + (editModalItem.outSewing || 0);
      const totalCumulativeOutPacking = pastOutPacking + (editModalItem.outPacking || 0);
      const computedWipFinish = Math.max(0, totalCumulativeOutSewing - totalCumulativeOutPacking);

      const realId = editModalItem.id.startsWith('proj-')
        ? `wip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
        : editModalItem.id;

      const updated: WipItem = {
        ...editModalItem,
        id: realId,
        date: targetDate,
        wipSewing: computedWipSewing,
        wipFinish: computedWipFinish,
        updatedAt: new Date().toISOString(),
      };

      onUpdateItem(updated);
    }
    setEditModalItem(null);
  };

  const handleExportCSV = () => {
    const headers = [
      'TANGGAL',
      'SPO',
      'STYLE',
      'COLOR',
      'SIZE',
      'QTY ORDER',
      'UNIT',
      'SCAN IN',
      'WIP0',
      'WIP1',
      'WIP2',
      'WIP3',
      'WIP4',
      'WIP5',
      'WIP SEWING',
      'OUTPUT SEWING',
      'CHECK (SCAN IN - WIP - OUT)',
      'CHK10',
      'CHK10 SCAN',
      'WIP FINISHING',
      'OUT PACKING',
    ];

    const rows = items.map((i) => {
      const scanInVal = i.inHariIni || 0;
      const wipStationSum = (i.wip0 || 0) + (i.wip1 || 0) + (i.wip2 || 0) + (i.wip3 || 0) + (i.wip4 || 0) + (i.wip5 || 0);
      const wipSewingVal = wipStationSum > 0 ? wipStationSum : (i.wipSewing || 0);
      const outSewingVal = i.outSewing || 0;
      const checkVal = scanInVal - (wipSewingVal + outSewingVal);

      return [
        getItemDate(i),
        i.spo,
        `"${i.style}"`,
        `"${i.color}"`,
        i.size,
        i.qtyOrder,
        i.unit,
        scanInVal,
        i.wip0,
        i.wip1,
        i.wip2,
        i.wip3,
        i.wip4,
        i.wip5,
        wipSewingVal,
        outSewingVal,
        checkVal,
        getChk10Value(i),
        getScanDistribusiValue(i),
        getItemWipFinish(i),
        i.outPacking,
      ];
    });

    const mpHeaders = [
      'LINE',
      'TANGGAL',
      'JAM NORMAL',
      'MP NORMAL',
      'JAM LEMBUR',
      'MP LEMBUR',
      'TOTAL JAM',
      'STATUS MP',
    ];

    const mpRows = lineDatePairs.map(({ lineId, date }) => {
      const mp = getLineManpower(lineId, date);
      const dev = checkManpowerDeviation(mp);
      return [
        `LINE ${lineId.toUpperCase()}`,
        date,
        mp.normalHours,
        mp.normalMp,
        mp.overtimeHours,
        mp.overtimeMp,
        dev.totalHours,
        dev.isDeviation ? 'PENYIMPANGAN' : 'NORMAL',
      ];
    });

    const wb = XLSX.utils.book_new();

    const wsWip = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, wsWip, 'WIP Production');

    const wsMp = XLSX.utils.aoa_to_sheet([mpHeaders, ...mpRows]);
    XLSX.utils.book_append_sheet(wb, wsMp, 'Man Power');

    XLSX.writeFile(wb, `wip_production_data_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportExcelClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawData || rawData.length === 0) {
          alert('File Excel kosong atau format tidak sesuai.');
          return;
        }

        const parsedItems: WipItem[] = rawData.map((row, index) => {
          const getItemVal = (keys: string[], defaultVal: any = '') => {
            for (const key of keys) {
              const matchedKey = Object.keys(row).find(
                (k) => k.trim().toLowerCase() === key.toLowerCase()
              );
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') {
                return row[matchedKey];
              }
            }
            return defaultVal;
          };

          const dateStr = String(getItemVal(['Tanggal', 'Date'], new Date().toISOString().split('T')[0]));
          const lineId = String(getItemVal(['Line', 'LineID', 'Line Id'], 'A19')).toUpperCase();
          const spo = String(getItemVal(['SPO', 'Nomor SPO', 'SPO Code'], 'SPO-1001'));
          const style = String(getItemVal(['Style', 'Model'], 'JACKET URBAN'));
          const color = String(getItemVal(['Color', 'Warna'], 'BLACK'));
          const size = String(getItemVal(['Size', 'Ukuran'], 'M'));
          const qtyOrder = Number(getItemVal(['Qty Order', 'Qty', 'Order Qty'], 1000)) || 0;
          const unit = String(getItemVal(['Unit', 'Satuan'], 'PCE'));

          const normalHours = Number(getItemVal(['Jam Normal', 'Jam Kerja Normal', 'Normal Hours'], 7));
          const normalMp = Number(getItemVal(['MP Normal', 'MP Jam Normal', 'Normal MP'], 25));
          const overtimeHours = Number(getItemVal(['Jam Lembur', 'Jam Kerja Lembur', 'Overtime Hours'], 0));
          const overtimeMp = Number(getItemVal(['MP Lembur', 'MP Jam Lembur', 'Overtime MP'], 0));

          const inHariIni = Number(getItemVal(['Scan In', 'Scan In Hari Ini', 'In Hari Ini'], 0)) || 0;
          const wip0 = Number(getItemVal(['WIP0'], 0)) || 0;
          const wip1 = Number(getItemVal(['WIP1'], 0)) || 0;
          const wip2 = Number(getItemVal(['WIP2'], 0)) || 0;
          const wip3 = Number(getItemVal(['WIP3'], 0)) || 0;
          const wip4 = Number(getItemVal(['WIP4'], 0)) || 0;
          const wip5 = Number(getItemVal(['WIP5'], 0)) || 0;

          const outSewing = Number(getItemVal(['Output Sewing', 'Out Sewing'], 0)) || 0;
          const outPacking = Number(getItemVal(['Out Packing', 'Output Packing'], 0)) || 0;
          const chk3d = Number(getItemVal(['CHK10', 'CHK3D'], 0)) || 0;

          const stationSum = wip0 + wip1 + wip2 + wip3 + wip4 + wip5;
          const computedWipSewing = stationSum > 0 ? stationSum : Math.max(0, inHariIni - outSewing);
          const computedWipFinish = Math.max(0, outSewing - outPacking);

          return {
            id: `excel-${Date.now()}-${index}`,
            lineId,
            spo,
            style,
            color,
            size,
            qtyOrder,
            unit,
            date: dateStr,
            normalHours,
            normalMp,
            overtimeHours,
            overtimeMp,
            inHariIni,
            wip0,
            wip1,
            wip2,
            wip3,
            wip4,
            wip5,
            wipSewing: computedWipSewing,
            outSewing,
            chk3d,
            wipFinish: computedWipFinish,
            outPacking,
            createdAt: `${dateStr}T00:00:00.000Z`,
            updatedAt: `${dateStr}T00:00:00.000Z`,
          };
        });

        if (onImportItems) {
          onImportItems(parsedItems);
          alert(`Berhasil mengimpor ${parsedItems.length} baris data dari Excel!`);
        }
      } catch (error) {
        console.error('Failed to read Excel file:', error);
        alert('Gagal membaca file Excel. Pastikan format file .xlsx, .xls, atau .csv');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 pb-12 space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* DEDICATED MAN POWER & JAM KERJA SUMMARY TABLE */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 card-shadow space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                Data Man Power & Jam Kerja Line
                <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold border border-blue-200">
                  1 Entry / Line / Hari
                </span>
              </h2>
              <p className="text-xs text-slate-500">Ringkasan alokasi man power & jam kerja per line per tanggal</p>
            </div>
          </div>
        </div>

        {/* Table of Line Manpower Entries */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-mono text-[10px] uppercase tracking-wider font-bold border-b border-slate-200">
                <th className="p-2.5 border-r border-slate-200 min-w-[100px]">LINE / GEDUNG</th>
                <th className="p-2.5 border-r border-slate-200 min-w-[100px]">TANGGAL</th>
                <th className="p-2.5 border-r border-slate-200 text-center bg-blue-50/70 text-blue-900 min-w-[100px]">JAM NORMAL</th>
                <th className="p-2.5 border-r border-slate-200 text-center bg-blue-50/70 text-blue-900 min-w-[90px]">MP NORMAL</th>
                <th className="p-2.5 border-r border-slate-200 text-center bg-purple-50/70 text-purple-900 min-w-[100px]">JAM LEMBUR</th>
                <th className="p-2.5 border-r border-slate-200 text-center bg-purple-50/70 text-purple-900 min-w-[90px]">MP LEMBUR</th>
                <th className="p-2.5 border-r border-slate-200 text-center bg-indigo-50/70 text-indigo-900 min-w-[90px]">TOTAL JAM</th>
                <th className="p-2.5 border-r border-slate-200 text-center bg-slate-100 text-slate-800 min-w-[120px]">STATUS MP</th>
                <th className="p-2.5 text-center bg-slate-100 text-slate-800 min-w-[90px]">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-xs">
              {(() => {
                const allMpMap = getAllLineManpower();
                return lineDatePairs.map(({ lineId, date }, pairIdx) => {
                  const key = `${cleanLine(lineId)}_${date}`;
                  const hasMp = !!allMpMap[key];
                  const mp = getLineManpower(lineId, date);
                  const devInfo = checkManpowerDeviation(mp);

                  return (
                    <tr key={`${lineId}_${date}_${pairIdx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 border-r border-slate-200 font-bold text-slate-900 bg-slate-50/50">
                        LINE {lineId.toUpperCase()}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-slate-700 font-semibold">
                        {date}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center font-bold text-slate-800">
                        {hasMp ? `${mp.normalHours} jam` : <span className="text-slate-400 font-normal italic">-</span>}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center font-bold text-slate-800">
                        {hasMp ? `${mp.normalMp} org` : <span className="text-slate-400 font-normal italic">-</span>}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center font-bold text-purple-900">
                        {hasMp ? `${mp.overtimeHours} jam` : <span className="text-slate-400 font-normal italic">-</span>}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center font-bold text-purple-900">
                        {hasMp ? `${mp.overtimeMp} org` : <span className="text-slate-400 font-normal italic">-</span>}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center font-black text-indigo-900">
                        {hasMp ? `${devInfo.totalHours} Jam` : <span className="text-slate-400 font-normal italic">-</span>}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center">
                        {!hasMp ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full border border-slate-200">
                            Belum Diinput
                          </span>
                        ) : devInfo.isDeviation ? (
                          <span
                            className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 inline-flex items-center gap-1"
                            title={devInfo.reasons.join(' | ')}
                          >
                            ⚠️ PENYIMPANGAN
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ NORMAL
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingManpower({ ...mp })}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 inline-flex items-center gap-1 transition shadow-xs"
                            title="Edit Man Power & Jam Kerja"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          {hasMp && (
                            <button
                              type="button"
                              onClick={() => {
                                deleteLineManpower(lineId, date);
                                setManpowerTick((t) => t + 1);
                                setEditingManpower(null);
                              }}
                              className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 inline-flex items-center gap-1 transition shadow-xs"
                              title="Hapus Data Man Power"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        {/* Alert for Manpower Deviation */}
        {allDeviations.length > 0 && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold tracking-wide uppercase text-red-900">
                PERINGATAN PENYIMPANGAN MAN POWER & JAM KERJA!
              </div>
              <div className="text-[11px] text-red-700 space-y-0.5">
                {allDeviations.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1">
                    <span className="font-bold text-red-800">&bull; Line {item.lineId.toUpperCase()} ({item.date}):</span>
                    <span>{item.reasons.join(' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 card-shadow">
        <div className="flex items-center space-x-2">
          <Table className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Data Production Summary ({filteredItems.length} Entries)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Global Date Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700 hidden sm:inline">Tanggal:</span>
            <input
              type="date"
              value={globalReportDate}
              onChange={(e) => setGlobalReportDate(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Table Search */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter SPO / Size / Tanggal..."
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              id="input-filter-table"
              className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-transparent rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          {!hideExportButtons && (
            <>
              <button
                onClick={handleImportExcelClick}
                id="btn-import-excel"
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-xl transition"
                title="Import data dari file Excel (.xlsx / .csv)"
              >
                <Upload className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Import Excel</span>
              </button>

              <button
                onClick={handleExportCSV}
                id="btn-export-csv"
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-xl transition"
                title="Export ke file Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Export Excel</span>
              </button>

              <button
                onClick={() => setIsPdfModalOpen(true)}
                id="btn-export-pdf"
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold rounded-xl transition"
                title="Download PDF Laporan Sesuai Format Excel"
              >
                <FileText className="w-4 h-4 text-purple-600" />
                <span className="hidden sm:inline">Download PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* High-density Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto card-shadow">
        <table className="w-full text-left text-[11px] font-sans border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 font-mono border-b border-slate-200 text-[10px] uppercase tracking-wider font-semibold">
              <th className="p-2.5 border-r border-slate-200 min-w-[95px] text-slate-800 bg-slate-100/60">TANGGAL</th>
              <th className="p-2.5 border-r border-slate-200">SPO</th>
              <th className="p-2.5 border-r border-slate-200 min-w-[200px]">STYLE</th>
              <th className="p-2.5 border-r border-slate-200 min-w-[120px]">COLOR</th>
              <th className="p-2.5 border-r border-slate-200">SIZE</th>
              <th className="p-2.5 border-r border-slate-200 text-right">QTY ORDER</th>
              <th className="p-2.5 border-r border-slate-200 text-center">UNIT</th>
              <th className="p-2.5 border-r border-slate-200 text-center bg-blue-50/50 text-blue-800">SCAN IN</th>
              <th className="p-2.5 border-r border-slate-200 text-center">WIP0</th>
              <th className="p-2.5 border-r border-slate-200 text-center">WIP1</th>
              <th className="p-2.5 border-r border-slate-200 text-center">WIP2</th>
              <th className="p-2.5 border-r border-slate-200 text-center">WIP3</th>
              <th className="p-2.5 border-r border-slate-200 text-center">WIP4</th>
              <th className="p-2.5 border-r border-slate-200 text-center">WIP5</th>
              <th className="p-2.5 border-r border-slate-200 text-center bg-slate-100/50">WIP SEWING</th>
              <th className="p-2.5 border-r border-slate-200 text-center text-emerald-700 bg-emerald-50/50">OUTPUT SEWING</th>
              <th className="p-2.5 border-r border-slate-200 text-center text-teal-800 bg-teal-50/60 min-w-[110px]" title="Check: Scan In - (WIP Sewing + Output Sewing)">CHECK</th>
              <th className="p-2.5 border-r border-slate-200 text-center text-purple-700 bg-purple-50/30">CHK10</th>
              <th className="p-2.5 border-r border-slate-200 text-center text-indigo-700 bg-indigo-50/30" title="Scan Distribusi (CHK10 Scan)">CHK10 SCAN</th>
              <th className="p-2.5 border-r border-slate-200 text-center text-amber-700 bg-amber-50/30">WIP FINISHING</th>
              <th className="p-2.5 border-r border-slate-200 text-center text-blue-700 bg-blue-50/30">OUT PACKING</th>
              <th className="p-2.5 text-center">AKSI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 font-mono text-slate-700">
            {Object.keys(spoGroups).length === 0 ? (
              <tr>
                <td colSpan={22} className="p-8 text-center text-slate-400 text-xs font-sans">
                  Tidak ada data WIP untuk ditampilkan.
                </td>
              </tr>
            ) : (
              (Object.entries(spoGroups) as [string, WipItem[]][]).map(([spoCode, groupItems], groupIdx) => {
                // Calculate Totals for this SPO
                const totalQty = groupItems.reduce((s, i) => s + i.qtyOrder, 0);
                const totalInHariIni = groupItems.reduce((s, i) => s + i.inHariIni, 0);
                const totalWip0 = groupItems.reduce((s, i) => s + (i.wip0 || 0), 0);
                const totalWip1 = groupItems.reduce((s, i) => s + (i.wip1 || 0), 0);
                const totalWip2 = groupItems.reduce((s, i) => s + (i.wip2 || 0), 0);
                const totalWip3 = groupItems.reduce((s, i) => s + (i.wip3 || 0), 0);
                const totalWip4 = groupItems.reduce((s, i) => s + (i.wip4 || 0), 0);
                const totalWip5 = groupItems.reduce((s, i) => s + (i.wip5 || 0), 0);
                const totalWipSewing = totalWip0 + totalWip1 + totalWip2 + totalWip3 + totalWip4 + totalWip5;
                const totalOutSewing = groupItems.reduce((s, i) => s + (i.outSewing || 0), 0);
                const totalChk3d = groupItems.reduce((s, i) => s + getChk10Value(i), 0);
                const totalScanDist = groupItems.reduce((s, i) => s + getScanDistribusiValue(i), 0);
                const totalWipFinish = groupItems.reduce((s, i) => s + getItemWipFinish(i), 0);
                const totalOutPacking = groupItems.reduce((s, i) => s + (i.outPacking || 0), 0);
                const totalCheck = groupItems.reduce((s, item) => {
                  const scanInVal = item.inHariIni || 0;
                  const wipStationSum = (item.wip0 || 0) + (item.wip1 || 0) + (item.wip2 || 0) + (item.wip3 || 0) + (item.wip4 || 0) + (item.wip5 || 0);
                  const outSewingVal = item.outSewing || 0;
                  return s + (scanInVal - (wipStationSum + outSewingVal));
                }, 0);

                return (
                  <React.Fragment key={`spo-grp-${spoCode}-${groupIdx}`}>
                    {groupItems.map((item, itemIdx) => {
                      const scanInVal = item.inHariIni || 0;
                      const wipStationSum = (item.wip0 || 0) + (item.wip1 || 0) + (item.wip2 || 0) + (item.wip3 || 0) + (item.wip4 || 0) + (item.wip5 || 0);
                      const wipSewingVal = wipStationSum > 0 ? wipStationSum : (item.wipSewing || 0);
                      const outSewingVal = item.outSewing || 0;
                      const rowCheckValue = scanInVal - (wipSewingVal + outSewingVal);

                      return (
                        <tr
                          key={`wip-row-${item.id}-${itemIdx}`}
                          className="hover:bg-slate-50 transition-colors text-[11px]"
                        >
                          <td className="p-2.5 border-r border-slate-200 text-slate-600 font-semibold bg-slate-50/30">
                            {getItemDate(item)}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-blue-700 font-semibold">
                            {item.spo}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-slate-900 truncate max-w-[220px]">
                            {item.style}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-slate-600">
                            {item.color}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 font-bold text-slate-900 text-center">
                            {item.size}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-right font-bold text-slate-900">
                            {item.qtyOrder.toLocaleString()}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center text-slate-500">
                            {item.unit}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center bg-blue-50/20 font-medium text-blue-900">
                            {item.inHariIni || '-'}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center">{item.wip0 || '-'}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center">{item.wip1 || '-'}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center">{item.wip2 || '-'}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center">{item.wip3 || '-'}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center">{item.wip4 || '-'}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center">{item.wip5 || '-'}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center font-bold bg-slate-50 text-slate-800">
                            {item.wipSewing || '-'}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center font-bold text-emerald-700 bg-emerald-50/60">
                            {item.outSewing || '-'}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center font-bold">
                            {rowCheckValue === 0 ? (
                              <span
                                className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block font-mono"
                                title={`Scan In (${scanInVal}) - [Jumlah (WIP0 s/d WIP5) (${wipSewingVal}) + Output Sewing (${outSewingVal})] = 0`}
                              >
                                ✓ 0
                              </span>
                            ) : (
                              <span
                                className={`px-1.5 py-0.5 rounded border inline-block font-mono ${
                                  rowCheckValue > 0
                                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                                    : 'text-red-700 bg-red-50 border-red-200'
                                }`}
                                title={`Scan In (${scanInVal}) - [Jumlah (WIP0 s/d WIP5) (${wipSewingVal}) + Output Sewing (${outSewingVal})] = ${rowCheckValue}`}
                              >
                                {rowCheckValue > 0 ? `+${rowCheckValue}` : rowCheckValue}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center text-purple-700 font-semibold">{getChk10Value(item) || '-'}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center text-indigo-700 font-semibold bg-indigo-50/20">{getScanDistribusiValue(item) || '-'}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center text-amber-700 font-semibold">{getItemWipFinish(item) || '-'}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center text-blue-700">{item.outPacking || '-'}</td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                title="Edit via Form Pop-up"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {onDeleteItem && (
                                <button
                                  onClick={() => onDeleteItem(item.id, item)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                  title="Hapus baris"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* SPO TOTAL ROW */}
                    <tr className="bg-slate-100/90 font-bold text-blue-800 text-[11px] border-y border-slate-300">
                      <td colSpan={5} className="p-2.5 border-r border-slate-200 text-right">
                        {spoCode} TOTAL:
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-right text-emerald-700 font-black">
                        {totalQty.toLocaleString()}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center">PCE</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{totalInHariIni}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{totalWip0}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{totalWip1}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{totalWip2}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{totalWip3}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{totalWip4}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{totalWip5}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{totalWipSewing}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center text-emerald-700">{totalOutSewing}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center font-black">
                        {totalCheck === 0 ? (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block font-mono">
                            ✓ 0
                          </span>
                        ) : (
                          <span className={totalCheck > 0 ? 'text-amber-700' : 'text-red-700'}>
                            {totalCheck > 0 ? `+${totalCheck}` : totalCheck}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{totalChk3d}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center text-indigo-700 font-bold">{totalScanDist}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{totalWipFinish}</td>
                      <td className="p-2.5 border-r border-slate-200 text-center">{totalOutPacking}</td>
                      <td className="p-2.5"></td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pop-up Edit Modal Form (Form Menurun yang Cantik) */}
      {editModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-blue-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl border border-white/10">
                  <Layers className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    Edit Data WIP
                    <span className="text-xs bg-blue-500/30 text-blue-200 px-2.5 py-0.5 rounded-full font-mono border border-blue-400/30">
                      {editModalItem.spo}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 truncate max-w-md">
                    {editModalItem.style} &bull; {editModalItem.color} ({editModalItem.size})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalItem(null)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body Form */}
            <form onSubmit={handleSaveModalEdit} className="p-6 space-y-6 overflow-y-auto">
              {/* Group 1: Informasi Order */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Informasi Order
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-blue-600" />
                      <span>Tanggal</span>
                    </label>
                    <input
                      type="date"
                      value={getItemDate(editModalItem)}
                      onChange={(e) =>
                        setEditModalItem({ ...editModalItem, date: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      SPO
                    </label>
                    <input
                      type="text"
                      value={editModalItem.spo}
                      onChange={(e) =>
                        setEditModalItem({ ...editModalItem, spo: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Style
                    </label>
                    <input
                      type="text"
                      value={editModalItem.style}
                      onChange={(e) =>
                        setEditModalItem({ ...editModalItem, style: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Color
                    </label>
                    <input
                      type="text"
                      value={editModalItem.color}
                      onChange={(e) =>
                        setEditModalItem({ ...editModalItem, color: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Size
                    </label>
                    <input
                      type="text"
                      value={editModalItem.size}
                      onChange={(e) =>
                        setEditModalItem({ ...editModalItem, size: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Qty Order
                    </label>
                    <input
                      type="number"
                      value={editModalItem.qtyOrder || ''}
                      onChange={(e) =>
                        setEditModalItem({
                          ...editModalItem,
                          qtyOrder: e.target.value === '' ? 0 : Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={editModalItem.unit}
                      onChange={(e) =>
                        setEditModalItem({ ...editModalItem, unit: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: WIP Stations Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    WIP Stations Input
                  </h4>
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                    Total WIP Sewing:{' '}
                    {(editModalItem.wip0 || 0) +
                      (editModalItem.wip1 || 0) +
                      (editModalItem.wip2 || 0) +
                      (editModalItem.wip3 || 0) +
                      (editModalItem.wip4 || 0) +
                      (editModalItem.wip5 || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                  {[
                    {
                      label: 'Scan In',
                      key: 'inHariIni' as const,
                      val: editModalItem.inHariIni,
                      bg: 'bg-blue-50/50',
                    },
                    { label: 'WIP 0', key: 'wip0' as const, val: editModalItem.wip0 },
                    { label: 'WIP 1', key: 'wip1' as const, val: editModalItem.wip1 },
                    { label: 'WIP 2', key: 'wip2' as const, val: editModalItem.wip2 },
                    { label: 'WIP 3', key: 'wip3' as const, val: editModalItem.wip3 },
                    { label: 'WIP 4', key: 'wip4' as const, val: editModalItem.wip4 },
                    { label: 'WIP 5', key: 'wip5' as const, val: editModalItem.wip5 },
                  ].map((st) => (
                    <div
                      key={st.key}
                      className={`p-2.5 rounded-xl border border-slate-200 text-center space-y-1.5 ${
                        st.bg || 'bg-slate-50'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-600 uppercase">
                        {st.label}
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={st.val || ''}
                        onChange={(e) =>
                          setEditModalItem({
                            ...editModalItem,
                            [st.key]: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0),
                          })
                        }
                        className="w-full py-1 text-center font-mono text-sm font-bold bg-white border border-slate-200 rounded text-blue-700 focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditModalItem({
                              ...editModalItem,
                              [st.key]: Math.max(0, st.val - 1),
                            })
                          }
                          className="px-1 py-0.5 bg-white text-[10px] rounded border border-slate-200 text-slate-600"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditModalItem({
                              ...editModalItem,
                              [st.key]: st.val + 1,
                            })
                          }
                          className="px-1 py-0.5 bg-white text-[10px] rounded border border-slate-200 text-slate-600"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 3: Hasil Sewing & Quality Check */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Hasil Sewing & Quality Check
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {[
                    {
                      label: 'Output Sewing',
                      key: 'outSewing' as const,
                      val: editModalItem.outSewing,
                      color: 'text-emerald-700',
                      border: 'border-emerald-300',
                      bg: 'bg-emerald-50/40',
                    },
                    {
                      label: 'CHK10',
                      key: 'chk3d' as const,
                      val: editModalItem.chk3d,
                      color: 'text-purple-700',
                      border: 'border-purple-200',
                      bg: 'bg-purple-50/30',
                    },
                    {
                      label: 'CHK10 SCAN',
                      key: 'chk10Scan' as const,
                      val: editModalItem.chk10Scan !== undefined ? editModalItem.chk10Scan : 0,
                      color: 'text-indigo-700',
                      border: 'border-indigo-300',
                      bg: 'bg-indigo-50/30',
                    },
                    {
                      label: 'WIP Finishing',
                      key: 'wipFinish' as const,
                      val: editModalItem.wipFinish,
                      color: 'text-amber-700',
                      border: 'border-amber-200',
                      bg: 'bg-amber-50/30',
                    },
                    {
                      label: 'Out Packing',
                      key: 'outPacking' as const,
                      val: editModalItem.outPacking,
                      color: 'text-blue-700',
                      border: 'border-blue-200',
                      bg: 'bg-blue-50/30',
                    },
                  ].map((st) => (
                    <div
                      key={st.key}
                      className={`p-3 rounded-xl border ${st.border} ${st.bg} text-center space-y-2`}
                    >
                      <div className={`text-xs font-bold uppercase ${st.color}`}>{st.label}</div>
                      <input
                        type="number"
                        min="0"
                        value={st.val || ''}
                        onChange={(e) =>
                          setEditModalItem({
                            ...editModalItem,
                            [st.key]: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0),
                          })
                        }
                        className={`w-full py-1 text-center font-mono text-base font-bold bg-white border border-slate-200 rounded-lg ${st.color} focus:outline-none focus:border-blue-500`}
                      />
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditModalItem({
                              ...editModalItem,
                              [st.key]: Math.max(0, st.val - 1),
                            })
                          }
                          className="px-1.5 py-0.5 bg-white text-[10px] rounded border border-slate-200 text-slate-600 font-medium"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditModalItem({
                              ...editModalItem,
                              [st.key]: st.val + 1,
                            })
                          }
                          className="px-1.5 py-0.5 bg-white text-[10px] rounded border border-slate-200 text-slate-600 font-medium"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditModalItem({
                              ...editModalItem,
                              [st.key]: st.val + 10,
                            })
                          }
                          className="px-1.5 py-0.5 bg-blue-50 text-[10px] rounded border border-blue-200 text-blue-700 font-semibold"
                        >
                          +10
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditModalItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manpower Edit Modal Popup */}
      {editingManpower && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5" />
                <h3 className="text-sm font-bold tracking-wide uppercase">
                  Edit Man Power & Jam Kerja (Line {editingManpower.lineId.toUpperCase()} - {editingManpower.date})
                </h3>
              </div>
              <button
                onClick={() => setEditingManpower(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveLineManpower(editingManpower);
                setManpowerTick((prev) => prev + 1);
                setEditingManpower(null);
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-slate-700">Tanggal</label>
                  <input
                    type="date"
                    value={editingManpower.date}
                    onChange={(e) => setEditingManpower({ ...editingManpower, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Jam Kerja Normal</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="12"
                      value={editingManpower.normalHours || ''}
                      onChange={(e) => setEditingManpower({ ...editingManpower, normalHours: e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-500 font-medium">jam</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">MP Normal</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={editingManpower.normalMp || ''}
                      onChange={(e) => setEditingManpower({ ...editingManpower, normalMp: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-500 font-medium">org</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Jam Lembur</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="8"
                      value={editingManpower.overtimeHours || ''}
                      onChange={(e) => setEditingManpower({ ...editingManpower, overtimeHours: e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-purple-900 focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-xs text-purple-600 font-medium">jam</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">MP Lembur</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={editingManpower.overtimeMp || ''}
                      onChange={(e) => setEditingManpower({ ...editingManpower, overtimeMp: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-purple-900 focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-xs text-purple-600 font-medium">org</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingManpower(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Manpower</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Export Modal */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        availableDates={availableDates}
        items={items}
        chkItems={chkItems}
      />
    </div>
  );
};
