import React, { useState, useEffect, useRef } from 'react';
import { SpoOption, WipItem } from '../types';
import { getLineManpower, saveLineManpower } from '../utils/manpower';
import {
  ArrowLeft,
  Save,
  Plus,
  CheckCircle2,
  ChevronDown,
  Package,
  Search,
  RefreshCw,
  Calendar,
  Users,
  Clock,
  AlertTriangle,
  Layers,
  Check,
} from 'lucide-react';

interface LineWipDetailProps {
  lineId: string;
  leaderNik: string;
  spoOptions: SpoOption[];
  wipItems?: WipItem[];
  globalReportDate?: string;
  setGlobalReportDate?: (d: string) => void;
  onBackToDashboard: () => void;
  onSaveWip: (newItem: Omit<WipItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onAddNewSpoOption: (spo: SpoOption) => void;
  onRefreshSpoSheet?: () => void;
  isRefreshingSpoSheet?: boolean;
}

export const LineWipDetail: React.FC<LineWipDetailProps> = ({
  lineId,
  leaderNik,
  spoOptions,
  wipItems = [],
  globalReportDate,
  setGlobalReportDate,
  onBackToDashboard,
  onSaveWip,
  onAddNewSpoOption,
  onRefreshSpoSheet,
  isRefreshingSpoSheet = false,
}) => {
  // Selected SPO State
  const [selectedSpo, setSelectedSpo] = useState<string>(spoOptions[0]?.spo || '0299A/26');
  const [style, setStyle] = useState<string>(
    spoOptions[0]?.style || 'FA26-JR286-ALPHA ELITE 2.0 KOBE'
  );
  const [color, setColor] = useState<string>(
    spoOptions[0]?.color || 'HYP.ROYAL/HYP.ROYAL/UNIV.RED/MET.SILVER'
  );
  const [size, setSize] = useState<string>(spoOptions[0]?.sizes[0] || 'S-PR');
  const [qtyOrder, setQtyOrder] = useState<number>(spoOptions[0]?.qtyOrder || 333);
  const [unit, setUnit] = useState<string>(spoOptions[0]?.unit || 'NPR');

  // Single Top Master Date State for Line Input
  const [entryDate, setEntryDate] = useState<string>(
    () => globalReportDate || new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    if (globalReportDate) {
      setEntryDate(globalReportDate);
    }
  }, [globalReportDate]);

  // SPO Search & Dropdown State
  const [spoSearchQuery, setSpoSearchQuery] = useState('');
  const [isSpoDropdownOpen, setIsSpoDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsSpoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync state if initial spoOptions change and no SPO is selected yet
  useEffect(() => {
    if (spoOptions.length > 0 && !selectedSpo) {
      handleSpoChange(spoOptions[0].spo);
    }
  }, [spoOptions]);

  // New SPO Modal state
  const [showAddSpoModal, setShowAddSpoModal] = useState(false);
  const [newSpoInput, setNewSpoInput] = useState('');
  const [newStyleInput, setNewStyleInput] = useState('');
  const [newColorInput, setNewColorInput] = useState('');
  const [newQtyInput, setNewQtyInput] = useState(1000);
  const [newUnitInput, setNewUnitInput] = useState('PCE');

  // WIP Counts & Process Stations
  const [scanIn, setScanIn] = useState<number>(0);
  const [wip0, setWip0] = useState<number>(0);
  const [wip1, setWip1] = useState<number>(0);
  const [wip2, setWip2] = useState<number>(0);
  const [wip3, setWip3] = useState<number>(0);
  const [wip4, setWip4] = useState<number>(0);
  const [wip5, setWip5] = useState<number>(0);

  // Outputs & Quality Check
  const [outSewing, setOutSewing] = useState<number>(0);
  const [chk10, setChk10] = useState<number>(0);
  const [wipFinish, setWipFinish] = useState<number>(0);
  const [outPacking, setOutPacking] = useState<number>(0);

  // Man Power & Jam Kerja
  const [normalHours, setNormalHours] = useState<number>(7);
  const [normalMp, setNormalMp] = useState<number>(25);
  const [overtimeHours, setOvertimeHours] = useState<number>(0);
  const [overtimeMp, setOvertimeMp] = useState<number>(0);

  // Helpers for string normalization
  const cleanLine = (l?: string) => (l ? l.trim().toUpperCase() : '');
  const cleanSpo = (s?: string) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
  const cleanSize = (sz?: string) => (sz ? sz.replace(/\s+/g, '').toLowerCase() : '');

  // Load line-level Manpower data on lineId or entryDate change
  useEffect(() => {
    const mp = getLineManpower(lineId, entryDate);
    setNormalHours(mp.normalHours);
    setNormalMp(mp.normalMp);
    setOvertimeHours(mp.overtimeHours);
    setOvertimeMp(mp.overtimeMp);
  }, [lineId, entryDate]);

  // Save manpower whenever inputs change
  const handleManpowerChange = (
    nH: number,
    nM: number,
    oH: number,
    oM: number
  ) => {
    setNormalHours(nH);
    setNormalMp(nM);
    setOvertimeHours(oH);
    setOvertimeMp(oM);

    saveLineManpower({
      lineId,
      date: entryDate,
      normalHours: nH,
      normalMp: nM,
      overtimeHours: oH,
      overtimeMp: oM,
    });
  };

  // Auto load existing entry when entryDate, selectedSpo, size, or lineId changes
  useEffect(() => {
    const existing = (wipItems || []).find(
      (item) =>
        cleanLine(item.lineId) === cleanLine(lineId) &&
        cleanSpo(item.spo) === cleanSpo(selectedSpo) &&
        cleanSize(item.size) === cleanSize(size) &&
        item.date === entryDate
    );

    if (existing) {
      setScanIn(existing.inHariIni || 0);
      setWip0(existing.wip0 || 0);
      setWip1(existing.wip1 || 0);
      setWip2(existing.wip2 || 0);
      setWip3(existing.wip3 || 0);
      setWip4(existing.wip4 || 0);
      setWip5(existing.wip5 || 0);
      setOutSewing(existing.outSewing || 0);
      setChk10(existing.chk3d || 0);
      setOutPacking(existing.outPacking || 0);
    } else {
      setScanIn(0);
      setWip0(0);
      setWip1(0);
      setWip2(0);
      setWip3(0);
      setWip4(0);
      setWip5(0);
      setOutSewing(0);
      setChk10(0);
      setOutPacking(0);
    }
  }, [entryDate, selectedSpo, size, lineId]);

  // Matching items for this SPO & Size on this Line
  const matchingItems = (wipItems || []).filter(
    (item) =>
      cleanLine(item.lineId) === cleanLine(lineId) &&
      cleanSpo(item.spo) === cleanSpo(selectedSpo) &&
      cleanSize(item.size) === cleanSize(size)
  );

  // Items from previous dates (before entryDate)
  const previousDaysItems = matchingItems.filter((item) => item.date < entryDate);
  const pastScanInSum = previousDaysItems.reduce((sum, item) => sum + (item.inHariIni || 0), 0);
  const pastOutSewingSum = previousDaysItems.reduce((sum, item) => sum + (item.outSewing || 0), 0);
  const carryoverWipSewing = Math.max(0, pastScanInSum - pastOutSewingSum);

  // Total WIP Sewing = Carryover from past days + Scan In today
  const totalWipSewingComputed = carryoverWipSewing + (scanIn || 0);

  // Verification Check: Sum of WIP 0..5 + Output Sewing MUST equal Total WIP Sewing
  const totalWipBreakdownPlusOutput = wip0 + wip1 + wip2 + wip3 + wip4 + wip5 + (outSewing || 0);
  const isWipSewingMatch = totalWipBreakdownPlusOutput === totalWipSewingComputed;
  const wipSewingDiff = totalWipSewingComputed - totalWipBreakdownPlusOutput;

  // Formula: WIP Finishing = (Akumulasi Output Sewing) - (Akumulasi Out Packing)
  // Items from other days (excluding current entryDate)
  const otherDaysItems = matchingItems.filter((item) => item.date !== entryDate);
  const cumulativeOutSewing =
    otherDaysItems.reduce((sum, item) => sum + (item.outSewing || 0), 0) + (outSewing || 0);
  const cumulativeOutPacking =
    otherDaysItems.reduce((sum, item) => sum + (item.outPacking || 0), 0) + (outPacking || 0);

  const calculatedWipFinish = Math.max(0, cumulativeOutSewing - cumulativeOutPacking);

  // Auto-sync wipFinish to (cumulative Output Sewing - cumulative Out Packing)
  useEffect(() => {
    setWipFinish(calculatedWipFinish);
  }, [selectedSpo, size, outSewing, outPacking, cumulativeOutSewing, cumulativeOutPacking]);

  // Success Notification state
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // When SPO dropdown changes, auto fill Style, Color, QtyOrder, Unit & sizes
  const handleSpoChange = (spoCode: string) => {
    setSelectedSpo(spoCode);
    setIsSpoDropdownOpen(false);
    setSpoSearchQuery('');
    const found = spoOptions.find((s) => s.spo.toLowerCase() === spoCode.toLowerCase());
    if (found) {
      setStyle(found.style);
      setColor(found.color);
      setUnit(found.unit);
      if (found.sizes.length > 0) {
        const firstSize = found.sizes[0];
        setSize(firstSize);
        if (found.sizeQtyMap && found.sizeQtyMap[firstSize] !== undefined) {
          setQtyOrder(found.sizeQtyMap[firstSize]);
        } else {
          setQtyOrder(found.qtyOrder);
        }
      } else {
        setQtyOrder(found.qtyOrder);
      }
    }
  };

  // When Size dropdown changes, update size and auto-fill Qty Order for that specific size
  const handleSizeChange = (newSize: string) => {
    setSize(newSize);
    const found = spoOptions.find((s) => s.spo.toLowerCase() === selectedSpo.toLowerCase());
    if (found && found.sizeQtyMap && found.sizeQtyMap[newSize] !== undefined) {
      setQtyOrder(found.sizeQtyMap[newSize]);
    }
  };

  const handleCreateSpo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpoInput.trim()) return;
    const newSpoObj: SpoOption = {
      spo: newSpoInput.trim(),
      style: newStyleInput.trim() || 'AW26-QUECHUA-SKI-P GL 100 LIGHT',
      color: newColorInput.trim() || 'DKT-N07A BLACK',
      qtyOrder: newQtyInput,
      unit: newUnitInput,
      sizes: ['XS-PR', 'S-PR', 'M-PR', 'L-PR', 'XL-PR', '2XL-PR'],
    };
    onAddNewSpoOption(newSpoObj);
    handleSpoChange(newSpoObj.spo);
    setShowAddSpoModal(false);
    setNewSpoInput('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveWip({
      lineId,
      spo: selectedSpo,
      style,
      color,
      size,
      qtyOrder,
      unit,
      inHariIni: scanIn,
      wip0,
      wip1,
      wip2,
      wip3,
      wip4,
      wip5,
      wipSewing: totalWipSewingComputed,
      outSewing,
      chk3d: chk10,
      wipFinish,
      outPacking,
      normalHours,
      normalMp,
      overtimeHours,
      overtimeMp,
      date: entryDate,
    });

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const currentSpoOption = spoOptions.find((s) => s.spo === selectedSpo);
  const availableSizes = currentSpoOption?.sizes || [
    'XS-PR',
    'S-PR',
    'M-PR',
    'L-PR',
    'XL-PR',
    '2XL-PR',
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6 text-slate-900">
      {/* Top Banner Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl card-shadow">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-black font-mono tracking-wider text-blue-600">
              LINE {lineId}
            </h1>
            <span className="text-xs font-mono font-semibold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
              NIK: {leaderNik}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Input WIP Production &bull; Leader Entry Dashboard
          </p>
        </div>

        <button
          onClick={onBackToDashboard}
          id="btn-back-dashboard"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
      </div>

      {/* 1 SINGLE MASTER DATE CONTROL AT THE VERY TOP FOR ALL DATA IN THIS LINE */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 card-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Tanggal Laporan Produksi Line {lineId}
            </h2>
            <p className="text-[11px] text-slate-500">
              Satu tanggal terpusat di atas untuk seluruh data WIP, Scan In, Output, & Manpower
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="date"
            id="input-entry-date"
            value={entryDate}
            onChange={(e) => {
              const newDate = e.target.value;
              setEntryDate(newDate);
              if (setGlobalReportDate) {
                setGlobalReportDate(newDate);
              }
            }}
            className="bg-slate-50 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 shadow-xs cursor-pointer w-full sm:w-auto"
          />
        </div>
      </div>

      {/* Main Form Box */}
      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-6 card-shadow space-y-6">
        {/* Row 1: SPO, Style, Color Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* SPO Selector with Search */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span>SPO</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-mono">
                  {spoOptions.length} SPO
                </span>
              </label>
              <div className="flex items-center gap-2">
                {onRefreshSpoSheet && (
                  <button
                    type="button"
                    onClick={onRefreshSpoSheet}
                    disabled={isRefreshingSpoSheet}
                    className="text-[10px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-semibold disabled:opacity-50"
                    title="Sync data dari Google Sheet SPO"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingSpoSheet ? 'animate-spin' : ''}`} />
                    <span>Sync Sheet</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddSpoModal(true)}
                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Plus className="w-3 h-3" /> SPO Baru
                </button>
              </div>
            </div>

            {/* SPO Search / Select Trigger Button */}
            <div
              onClick={() => setIsSpoDropdownOpen(!isSpoDropdownOpen)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 cursor-pointer flex items-center justify-between hover:bg-slate-100/80 transition-all focus-within:ring-2 focus-within:ring-blue-500/20"
            >
              <span className="truncate">{selectedSpo || 'Pilih SPO...'}</span>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            </div>

            {/* Dropdown Menu */}
            {isSpoDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl p-2 space-y-2 animate-fadeIn max-h-80 overflow-y-auto">
                <div className="relative sticky top-0 bg-white z-10 pb-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari SPO, Style, atau Warna..."
                    value={spoSearchQuery}
                    onChange={(e) => setSpoSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="divide-y divide-slate-100">
                  {spoOptions
                    .filter((opt) => {
                      const q = spoSearchQuery.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        opt.spo.toLowerCase().includes(q) ||
                        opt.style.toLowerCase().includes(q) ||
                        opt.color.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 40)
                    .map((opt) => (
                      <button
                        key={`${opt.spo}-${opt.style}-${opt.color}`}
                        type="button"
                        onClick={() => handleSpoChange(opt.spo)}
                        className={`w-full text-left p-2 rounded-lg text-xs transition flex flex-col gap-0.5 hover:bg-blue-50 ${
                          opt.spo === selectedSpo ? 'bg-blue-50/80 border-l-2 border-blue-600' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">{opt.spo}</span>
                          <span className="text-[10px] font-mono text-blue-700 font-semibold bg-blue-100/60 px-1.5 py-0.5 rounded">
                            {opt.qtyOrder} {opt.unit}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 font-mono truncate">{opt.style}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{opt.color}</p>
                      </button>
                    ))}

                  {spoOptions.filter((opt) => {
                    const q = spoSearchQuery.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      opt.spo.toLowerCase().includes(q) ||
                      opt.style.toLowerCase().includes(q) ||
                      opt.color.toLowerCase().includes(q)
                    );
                  }).length === 0 && (
                    <div className="py-4 text-center text-xs text-slate-400">
                      SPO tidak ditemukan.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Style */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Style</label>
            <input
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              id="input-style"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono truncate transition-all"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Color</label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              id="input-color"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono transition-all"
            />
          </div>
        </div>

        {/* Row 2: Size, Qty Order, Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
          {/* Size */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Size</label>
            <select
              value={size}
              onChange={(e) => handleSizeChange(e.target.value)}
              id="select-size"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-blue-700 focus:outline-none focus:border-blue-500"
            >
              {availableSizes.map((s) => {
                const qtyForSize = currentSpoOption?.sizeQtyMap?.[s];
                return (
                  <option key={s} value={s}>
                    {s} {qtyForSize !== undefined ? `(Qty: ${qtyForSize})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Qty Order */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Qty Order</label>
            <input
              type="number"
              value={qtyOrder || ''}
              onChange={(e) => setQtyOrder(e.target.value === '' ? 0 : Number(e.target.value))}
              id="input-qty-order"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Unit</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              id="input-unit"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>



        {/* Submit Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {showSuccessToast && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-fadeIn font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Data WIP & Manpower berhasil disimpan!</span>
            </div>
          )}

          <button
            type="submit"
            id="btn-simpan-wip"
            className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition active:scale-[0.98] cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Laporan</span>
          </button>
        </div>
      </form>

      {/* Modal for adding a new SPO */}
      {showAddSpoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 card-shadow">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Tambah SPO Baru
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-600 font-semibold block mb-1">SPO Code</label>
                <input
                  type="text"
                  placeholder="misal: R3088/26"
                  value={newSpoInput}
                  onChange={(e) => setNewSpoInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-semibold block mb-1">Style Name</label>
                <input
                  type="text"
                  placeholder="Style Name"
                  value={newStyleInput}
                  onChange={(e) => setNewStyleInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-semibold block mb-1">Color Name</label>
                <input
                  type="text"
                  placeholder="Color Name"
                  value={newColorInput}
                  onChange={(e) => setNewColorInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-600 font-semibold block mb-1">Qty Order</label>
                  <input
                    type="number"
                    value={newQtyInput || ''}
                    onChange={(e) => setNewQtyInput(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-semibold block mb-1">Unit</label>
                  <input
                    type="text"
                    value={newUnitInput}
                    onChange={(e) => setNewUnitInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSpoModal(false)}
                className="px-4 py-2 bg-slate-100 text-xs text-slate-600 font-semibold rounded-lg hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateSpo}
                className="px-4 py-2 bg-blue-600 text-xs text-white font-bold rounded-lg hover:bg-blue-700 shadow-md shadow-blue-600/20"
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
