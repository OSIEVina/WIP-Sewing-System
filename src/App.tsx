import React, { useState, useEffect, useRef } from 'react';
import { ProductionLine, WipItem, SpoOption, ChkItem, ScanDistribusiItem } from './types';
import { INITIAL_LINES, INITIAL_SPO_OPTIONS, INITIAL_WIP_ITEMS, INITIAL_CHK_ITEMS } from './data/initialData';
import { fetchLiveSpoOptions } from './data/spoSheetService';
import { fetchLiveChk10Items } from './data/chkSheetService';
import { fetchLiveScanDistribusiItems } from './data/scanDistribusiSheetService';
import {
  pushWebAppWipData,
  fetchWebAppWipData,
  fetchLiveWipSheetCsv,
  getEffectiveWebAppUrl,
  mergeDuplicateWipItems,
  clearSpreadsheetWipData,
} from './lib/googleSheetsService';
import { safeGetItem, safeSetItem, safeRemoveItem } from './utils/storage';
import { normalizeDateStr, getTodayDateStr } from './utils/date';
import { saveLineManpower, getLineManpower } from './utils/manpower';
import { Header } from './components/Header';
import { LineGrid } from './components/LineGrid';
import { LoginLeaderModal } from './components/LoginLeaderModal';
import { LineWipDetail } from './components/LineWipDetail';
import { WipTable } from './components/WipTable';
import { Chk10Table } from './components/Chk10Table';
import { OutputReconciliation } from './components/OutputReconciliation';
import { ScanDistribusiComparison } from './components/ScanDistribusiComparison';
import { DataSourceModal } from './components/DataSourceModal';
import { GoogleSheetsExportModal } from './components/GoogleSheetsExportModal';
import { LayoutDashboard, FileSpreadsheet, ArrowRightLeft, Calendar, Check, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<'dashboard' | 'line_detail'>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<'lines_wip' | 'chk_sheet' | 'scan_comparison'>('lines_wip');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [leaderNik, setLeaderNik] = useState<string>('9370');

  // Single Master Report Date State for the entire App
  const [globalReportDate, setGlobalReportDate] = useState<string>(
    () => getTodayDateStr()
  );

  // Modal States
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState<boolean>(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState<boolean>(false);

  // Persistent Data Stores
  const [lines, setLines] = useState<ProductionLine[]>(() => {
    const saved = safeGetItem('wip_sewing_lines');
    if (!saved) return INITIAL_LINES;
    try {
      const parsed: ProductionLine[] = JSON.parse(saved);
      if (parsed.length < INITIAL_LINES.length) {
        const existingIds = new Set(parsed.map((l) => l.id));
        const missingLines = INITIAL_LINES.filter((l) => !existingIds.has(l.id));
        return [...parsed, ...missingLines];
      }
      return parsed;
    } catch {
      return INITIAL_LINES;
    }
  });

  const [spoOptions, setSpoOptions] = useState<SpoOption[]>(() => {
    const saved = safeGetItem('wip_sewing_spos');
    if (!saved) return INITIAL_SPO_OPTIONS;
    try {
      return JSON.parse(saved);
    } catch {
      return INITIAL_SPO_OPTIONS;
    }
  });

  const [isRefreshingSpoSheet, setIsRefreshingSpoSheet] = useState(false);
  const [isRefreshingChkSheet, setIsRefreshingChkSheet] = useState(false);
  const [lastChkSyncTime, setLastChkSyncTime] = useState<string>('');

  const [wipItems, setWipItems] = useState<WipItem[]>(() => {
    const saved = safeGetItem('wip_sewing_items');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const userHasMutatedWipRef = useRef<boolean>(false);
  const lastLocalMutationTimeRef = useRef<number>(0);

  const [chkItems, setChkItems] = useState<ChkItem[]>(() => {
    const saved = safeGetItem('wip_sewing_chk_items');
    if (!saved) return INITIAL_CHK_ITEMS;
    try {
      const parsed: ChkItem[] = JSON.parse(saved);
      const existingIds = new Set(parsed.map((item) => item.id));
      const missingInitials = INITIAL_CHK_ITEMS.filter((item) => !existingIds.has(item.id));
      if (missingInitials.length > 0) {
        return [...parsed, ...missingInitials];
      }
      return parsed;
    } catch {
      return INITIAL_CHK_ITEMS;
    }
  });

  const [scanItems, setScanItems] = useState<ScanDistribusiItem[]>(() => {
    const saved = safeGetItem('wip_sheet_scan_distribusi_cache');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [isRefreshingScan, setIsRefreshingScan] = useState<boolean>(false);

  // Fetch live SPO options, CHK10 records, and Scan Distribusi records from Google Sheets on mount
  useEffect(() => {
    loadSpoSheetData();
    loadChkSheetData();
    loadScanDistribusiData();
    loadInitialWipData();
  }, []);

  const loadInitialWipData = async () => {
    const webAppUrl = getEffectiveWebAppUrl();
    try {
      if (webAppUrl) {
        const remoteWip = await fetchWebAppWipData(webAppUrl);
        if (remoteWip !== null && Array.isArray(remoteWip)) {
          setWipItems(remoteWip);
          safeSetItem('wip_sewing_items', JSON.stringify(remoteWip));
          safeSetItem('google_sheets_imported', 'true');
          return;
        }
      }
      const csvWip = await fetchLiveWipSheetCsv();
      if (csvWip !== null && Array.isArray(csvWip)) {
        setWipItems(csvWip);
        safeSetItem('wip_sewing_items', JSON.stringify(csvWip));
        safeSetItem('google_sheets_imported', 'true');
      }
    } catch (err) {
      console.warn('Background WIP sheet initial sync notice:', err);
    }
  };

  const loadSpoSheetData = async () => {
    setIsRefreshingSpoSheet(true);
    try {
      const liveSpos = await fetchLiveSpoOptions();
      if (liveSpos.length > 0) {
        setSpoOptions(liveSpos);
      }
    } catch (err) {
      console.warn('Failed to load live SPO sheet:', err);
    } finally {
      setIsRefreshingSpoSheet(false);
    }
  };

  const loadChkSheetData = async () => {
    setIsRefreshingChkSheet(true);
    try {
      const liveChk = await fetchLiveChk10Items();
      if (liveChk.length > 0) {
        setChkItems(liveChk);
        setLastChkSyncTime(
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
    } catch (err) {
      console.warn('Failed to load live CHK10 sheet:', err);
    } finally {
      setIsRefreshingChkSheet(false);
    }
  };

  const loadScanDistribusiData = async () => {
    setIsRefreshingScan(true);
    try {
      const liveScan = await fetchLiveScanDistribusiItems();
      if (liveScan.length > 0) {
        setScanItems(liveScan);
      }
    } catch (err) {
      console.warn('Failed to load live Scan Distribusi sheet:', err);
    } finally {
      setIsRefreshingScan(false);
    }
  };

  // Save to localStorage on state update
  useEffect(() => {
    safeSetItem('wip_sewing_lines', JSON.stringify(lines));
  }, [lines]);

  useEffect(() => {
    safeSetItem('wip_sewing_spos', JSON.stringify(spoOptions));
  }, [spoOptions]);

  useEffect(() => {
    safeSetItem('wip_sewing_items', JSON.stringify(wipItems));
  }, [wipItems]);

  useEffect(() => {
    safeSetItem('wip_sewing_chk_items', JSON.stringify(chkItems));
  }, [chkItems]);

  // Auto-sync background push to Google Sheets Web App whenever WIP is modified by user (Seamless, non-blocking)
  useEffect(() => {
    const webAppUrl = getEffectiveWebAppUrl();
    const autoSync = safeGetItem('google_sheets_autosync');
    if (!webAppUrl || autoSync === 'false' || !userHasMutatedWipRef.current) return;

    setSyncStatus('syncing');

    const timer = setTimeout(async () => {
      try {
        await pushWebAppWipData(webAppUrl, { wipItems, spoOptions, chkItems });
        setSyncStatus('synced');
        userHasMutatedWipRef.current = false;
        lastLocalMutationTimeRef.current = Date.now();
        setTimeout(() => {
          setSyncStatus((curr) => (curr === 'synced' ? 'idle' : curr));
        }, 3000);
      } catch (err) {
        console.warn('Auto push Google Sheets background notice:', err);
        setSyncStatus('error');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [wipItems]);

  const handleRetryPushSync = async () => {
    const webAppUrl = getEffectiveWebAppUrl();
    if (!webAppUrl) return;
    setSyncStatus('syncing');
    try {
      await pushWebAppWipData(webAppUrl, { wipItems, spoOptions, chkItems });
      setSyncStatus('synced');
      userHasMutatedWipRef.current = false;
      lastLocalMutationTimeRef.current = Date.now();
      setTimeout(() => {
        setSyncStatus((curr) => (curr === 'synced' ? 'idle' : curr));
      }, 3000);
    } catch (err) {
      console.warn('Retry Google Sheets push failed:', err);
      setSyncStatus('error');
    }
  };

  // Background Auto-Poll from Google Sheets Web App with conflict-free smart merge
  useEffect(() => {
    const pollBackgroundData = async () => {
      if (userHasMutatedWipRef.current) return;
      // Do not overwrite if user locally mutated within 25 seconds
      if (Date.now() - lastLocalMutationTimeRef.current < 25000) return;

      const webAppUrl = getEffectiveWebAppUrl();
      if (!webAppUrl) return;
      try {
        const fetchedWip = await fetchWebAppWipData(webAppUrl);
        if (fetchedWip !== null && Array.isArray(fetchedWip) && fetchedWip.length > 0) {
          setWipItems((current) => {
            const cleanLine = (l?: string) => (l ? l.trim().toUpperCase() : '');
            const cleanSpo = (s?: string) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
            const cleanSize = (sz?: string) => (sz ? sz.replace(/\s+/g, '').toLowerCase() : '');
            const getItemDate = (i: WipItem) =>
              normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : ''));

            const localMap = new Map<string, WipItem>();
            current.forEach((item) => {
              const key = `${cleanLine(item.lineId)}|${cleanSpo(item.spo)}|${cleanSize(item.size)}|${getItemDate(item)}`;
              localMap.set(key, item);
            });

            const merged: WipItem[] = [];
            const processedKeys = new Set<string>();

            fetchedWip.forEach((remoteItem) => {
              const key = `${cleanLine(remoteItem.lineId)}|${cleanSpo(remoteItem.spo)}|${cleanSize(remoteItem.size)}|${getItemDate(remoteItem)}`;
              processedKeys.add(key);
              const local = localMap.get(key);
              if (!local) {
                merged.push(remoteItem);
              } else {
                const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
                const remoteTime = new Date(remoteItem.updatedAt || remoteItem.createdAt || 0).getTime();
                // If local timestamp is newer or equal, preserve local data!
                if (localTime >= remoteTime) {
                  merged.push(local);
                } else {
                  merged.push(remoteItem);
                }
              }
            });

            // Keep any local item not present in remote yet
            current.forEach((localItem) => {
              const key = `${cleanLine(localItem.lineId)}|${cleanSpo(localItem.spo)}|${cleanSize(localItem.size)}|${getItemDate(localItem)}`;
              if (!processedKeys.has(key)) {
                merged.push(localItem);
              }
            });

            if (JSON.stringify(current) !== JSON.stringify(merged)) {
              safeSetItem('wip_sewing_items', JSON.stringify(merged));
              return merged;
            }
            return current;
          });

          // Sync lines leader info based on fetchedWip data
          setLines((prevLines) => {
            let changed = false;
            const updated = prevLines.map((line) => {
              const lineWips = fetchedWip.filter(
                (w) => w.lineId?.trim().toUpperCase() === line.id.trim().toUpperCase()
              );
              if (lineWips.length > 0) {
                const latestWip = [...lineWips].sort(
                  (a, b) =>
                    new Date(b.updatedAt || b.createdAt || 0).getTime() -
                    new Date(a.updatedAt || a.createdAt || 0).getTime()
                )[0];
                const latestLeader =
                  latestWip.updatedBy || latestWip.leaderNik || latestWip.leaderName;
                if (latestLeader && line.currentLeaderNik !== latestLeader) {
                  changed = true;
                  return {
                    ...line,
                    currentLeaderNik: latestLeader,
                    lastUpdatedBy: latestLeader,
                    status: 'in_progress' as const,
                  };
                }
              }
              return line;
            });
            return changed ? updated : prevLines;
          });
        }
      } catch (err) {
        // Ignore background polling network glitches
      }
    };

    pollBackgroundData();
    const interval = setInterval(pollBackgroundData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Handlers
  const handleSelectLineClick = (lineId: string) => {
    setSelectedLineId(lineId);
    setIsLoginModalOpen(true);
  };

  const handleLoginSubmit = (nik: string, userName?: string) => {
    const displayName = userName ? `${nik} (${userName})` : nik;
    setLeaderNik(displayName);
    setIsLoginModalOpen(false);

    // Update Line leader and status
    if (selectedLineId) {
      setLines((prev) =>
        prev.map((l) =>
          l.id === selectedLineId
            ? {
                ...l,
                status: 'in_progress',
                currentLeaderNik: displayName,
                lastUpdated: new Date().toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              }
            : l
        )
      );
    }

    setCurrentView('line_detail');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  const handleSaveWipItem = (newItemData: Omit<WipItem, 'createdAt' | 'updatedAt'> & { id?: string }) => {
    handleUpdateWipItem(newItemData as WipItem);
  };

  const handleAddNewSpoOption = (newSpo: SpoOption) => {
    setSpoOptions((prev) => {
      if (prev.some((s) => s.spo === newSpo.spo)) return prev;
      return [newSpo, ...prev];
    });
  };

  const handleDeleteWipItem = (id: string, targetItem?: WipItem) => {
    userHasMutatedWipRef.current = true;
    setWipItems((prev) => {
      const cleanLine = (l?: string) => (l ? l.trim().toUpperCase() : '');
      const cleanSpo = (s?: string) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
      const cleanSize = (sz?: string) => (sz ? sz.replace(/\s+/g, '').toLowerCase() : '');
      const getItemDate = (i: WipItem) =>
        normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : ''));

      let targetLine = '';
      let targetSpo = '';
      let targetSize = '';
      let targetDate = '';

      if (targetItem) {
        targetLine = cleanLine(targetItem.lineId);
        targetSpo = cleanSpo(targetItem.spo);
        targetSize = cleanSize(targetItem.size);
        targetDate = getItemDate(targetItem) || normalizeDateStr(globalReportDate) || getTodayDateStr();
      } else {
        const found = prev.find((i) => i.id === id);
        if (found) {
          targetLine = cleanLine(found.lineId);
          targetSpo = cleanSpo(found.spo);
          targetSize = cleanSize(found.size);
          targetDate = getItemDate(found) || normalizeDateStr(globalReportDate) || getTodayDateStr();
        } else if (id.startsWith('proj-')) {
          targetDate = normalizeDateStr(globalReportDate) || getTodayDateStr();
        }
      }

      const nextWip = prev.filter((item) => {
        // Direct ID match
        if (item.id === id || (targetItem && item.id === targetItem.id)) {
          const itemDate = getItemDate(item);
          // If item date is strictly before targetDate, keep previous history intact!
          if (targetDate && itemDate && itemDate < targetDate) {
            return true;
          }
          return false;
        }

        const itemLine = cleanLine(item.lineId);
        const itemSpo = cleanSpo(item.spo);
        const itemSize = cleanSize(item.size);
        const itemDate = getItemDate(item);

        if (
          targetLine &&
          targetSpo &&
          targetSize &&
          itemLine === targetLine &&
          itemSpo === targetSpo &&
          itemSize === targetSize
        ) {
          // Rule: Data hari sebelumnya (< targetDate) TETAP ADA!
          // Data hari ini (=== targetDate) dan selanjutnya (>= targetDate) dihapus!
          if (targetDate && itemDate) {
            if (itemDate >= targetDate) {
              return false;
            }
            return true;
          }
        }

        return true;
      });

      safeSetItem('wip_sewing_items', JSON.stringify(nextWip));
      return nextWip;
    });
  };

  const handleUpdateWipItem = (updatedItem: WipItem) => {
    userHasMutatedWipRef.current = true;
    const activeLeader = updatedItem.updatedBy || updatedItem.leaderNik || leaderNik || '';
    const nowIso = new Date().toISOString();

    setWipItems((prev) => {
      const cleanLine = (l?: string) => (l ? l.trim().toUpperCase() : '');
      const cleanSpo = (s?: string) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
      const cleanSize = (sz?: string) => (sz ? sz.replace(/\s+/g, '').toLowerCase() : '');
      const getItemDate = (i: WipItem) =>
        normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : '')) || getTodayDateStr();

      const targetDate = normalizeDateStr(updatedItem.date) || getItemDate(updatedItem) || getTodayDateStr();
      const targetLine = cleanLine(updatedItem.lineId);
      const targetSpo = cleanSpo(updatedItem.spo);
      const targetSize = cleanSize(updatedItem.size);

      // Check if item exists by id or STRICTLY by (lineId + spo + size + date)
      const existingMatch = prev.find(
        (item) =>
          (updatedItem.id && item.id === updatedItem.id && getItemDate(item) === targetDate) ||
          (cleanLine(item.lineId) === targetLine &&
            cleanSpo(item.spo) === targetSpo &&
            cleanSize(item.size) === targetSize &&
            getItemDate(item) === targetDate)
      );

      const finalId =
        (updatedItem.id && !updatedItem.id.startsWith('proj-'))
          ? updatedItem.id
          : (existingMatch ? existingMatch.id : `wip-${updatedItem.lineId}-${updatedItem.spo}-${updatedItem.size}-${targetDate}-${Date.now()}`);

      const itemWithMeta: WipItem = {
        ...updatedItem,
        date: targetDate,
        id: finalId,
        updatedBy: activeLeader,
        leaderNik: activeLeader,
        leaderName: activeLeader,
        updatedAt: nowIso,
      };

      // Filter out any existing item with the same Line, SPO, Size, and Date (or same final ID) to OVERWRITE it completely
      const filteredPrev = prev.filter(
        (item) =>
          item.id !== finalId &&
          !(
            cleanLine(item.lineId) === targetLine &&
            cleanSpo(item.spo) === targetSpo &&
            cleanSize(item.size) === targetSize &&
            getItemDate(item) === targetDate
          )
      );

      let next: WipItem[] = [itemWithMeta, ...filteredPrev];

      // Automatically cascade Manpower & Jam Kerja to ALL other entries on the SAME Line and Date!
      const nH = updatedItem.normalHours !== undefined ? updatedItem.normalHours : 7;
      const nM = updatedItem.normalMp !== undefined ? updatedItem.normalMp : 25;
      const oH = updatedItem.overtimeHours !== undefined ? updatedItem.overtimeHours : 0;
      const oM = updatedItem.overtimeMp !== undefined ? updatedItem.overtimeMp : 0;

      if (targetLine) {
        saveLineManpower({
          lineId: targetLine,
          date: targetDate,
          normalHours: nH,
          normalMp: nM,
          overtimeHours: oH,
          overtimeMp: oM,
        });

        next = next.map((item) => {
          if (cleanLine(item.lineId) === targetLine && getItemDate(item) === targetDate) {
            return {
              ...item,
              normalHours: nH,
              normalMp: nM,
              overtimeHours: oH,
              overtimeMp: oM,
            };
          }
          return item;
        });
      }

      const deduplicatedNext = mergeDuplicateWipItems(next);
      safeSetItem('wip_sewing_items', JSON.stringify(deduplicatedNext));
      return deduplicatedNext;
    });

    if (updatedItem.lineId && activeLeader) {
      setLines((prev) =>
        prev.map((l) =>
          l.id.toUpperCase() === updatedItem.lineId.toUpperCase()
            ? {
                ...l,
                currentLeaderNik: activeLeader,
                lastUpdatedBy: activeLeader,
                status: 'in_progress',
                lastUpdated: new Date().toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              }
            : l
        )
      );
    }
  };

  const handleImportWipItems = (importedItems: WipItem[], replaceMode: boolean = false) => {
    if (replaceMode) {
      setWipItems(mergeDuplicateWipItems(importedItems));
      return;
    }
    setWipItems((prev) => mergeDuplicateWipItems([...prev, ...importedItems]));
  };

  const handleAddChkItem = (newItemData: Omit<ChkItem, 'id' | 'createdAt'>) => {
    const newItem: ChkItem = {
      ...newItemData,
      id: `chk-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setChkItems((prev) => [newItem, ...prev]);
  };

  const handleUpdateChkItem = (updatedItem: ChkItem) => {
    setChkItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  };

  const handleDeleteChkItem = (id: string) => {
    setChkItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSyncWipOutput = (spo: string, size: string, newOutSewing: number) => {
    userHasMutatedWipRef.current = true;
    setWipItems((prev) =>
      prev.map((item) =>
        item.spo.trim().toLowerCase() === spo.trim().toLowerCase() &&
        item.size.trim().toLowerCase() === size.trim().toLowerCase()
          ? { ...item, outSewing: newOutSewing, updatedAt: new Date().toISOString() }
          : item
      )
    );
  };

  const handleClearAllWip = async () => {
    userHasMutatedWipRef.current = true;
    setWipItems([]);
    safeSetItem('wip_sewing_items', '[]');
    const webAppUrl = getEffectiveWebAppUrl();
    if (webAppUrl) {
      setSyncStatus('syncing');
      try {
        await clearSpreadsheetWipData(webAppUrl);
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } catch (e) {
        console.warn('Failed to clear remote spreadsheet:', e);
        setSyncStatus('error');
      }
    }
  };

  const handleResetData = () => {
    if (window.confirm('Reset semua data ke posisi default pabrik?')) {
      setLines(INITIAL_LINES);
      setSpoOptions(INITIAL_SPO_OPTIONS);
      setWipItems(INITIAL_WIP_ITEMS);
      setChkItems(INITIAL_CHK_ITEMS);
      safeRemoveItem('wip_sewing_lines');
      safeRemoveItem('wip_sewing_spos');
      safeRemoveItem('wip_sewing_items');
      safeRemoveItem('wip_sewing_chk_items');
    }
  };

  const handleImportBulkChkItems = (newItems: ChkItem[], append: boolean = false) => {
    if (append) {
      setChkItems((prev) => [...newItems, ...prev]);
    } else {
      setChkItems(newItems);
    }
  };

  const handleImportDataSource = (data: {
    lines?: ProductionLine[];
    wipItems?: WipItem[];
    spoOptions?: SpoOption[];
    chkItems?: ChkItem[];
  }) => {
    if (data.lines && Array.isArray(data.lines)) setLines(data.lines);
    if (data.spoOptions && Array.isArray(data.spoOptions)) setSpoOptions(data.spoOptions);
    if (data.wipItems && Array.isArray(data.wipItems)) setWipItems(data.wipItems);
    if (data.chkItems && Array.isArray(data.chkItems)) setChkItems(data.chkItems);
  };

  const activeLinesCount = lines.filter(
    (l) => l.status === 'in_progress' || l.status === 'active'
  ).length;

  const linesList = lines.map((l) => l.id);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <Header
        currentView={currentView}
        selectedLineId={selectedLineId || undefined}
        leaderNik={leaderNik}
        onOpenDataSource={() => setIsDataSourceModalOpen(true)}
        onOpenGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
        onResetData={handleResetData}
        onRetrySync={handleRetryPushSync}
        totalLines={lines.length}
        activeLinesCount={activeLinesCount}
        syncStatus={syncStatus}
      />

      {/* Main View Area */}
      <main className="flex-1 py-6 px-4 max-w-7xl mx-auto w-full space-y-6">
        {currentView === 'dashboard' ? (
          <>
            {/* Navigation Tabs on Dashboard */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6 flex-wrap gap-3">
              <div className="flex items-center gap-2 p-1 bg-slate-200/80 rounded-xl text-xs font-bold text-slate-700">
                <button
                  onClick={() => setDashboardTab('lines_wip')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    dashboardTab === 'lines_wip'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Line Grid & WIP Table</span>
                </button>

                <button
                  onClick={() => setDashboardTab('chk_sheet')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    dashboardTab === 'chk_sheet'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Rekonsiliasi CHK10 vs WIP (Semua Line)</span>
                </button>

                <button
                  onClick={() => setDashboardTab('scan_comparison')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    dashboardTab === 'scan_comparison'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Compare Scan In vs Scan Distribusi</span>
                </button>
              </div>
            </div>

            {/* Render selected Tab content */}
            {dashboardTab === 'lines_wip' && (
              <>
                <LineGrid lines={lines} wipItems={wipItems} onSelectLine={handleSelectLineClick} />
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <WipTable
                    items={wipItems}
                    chkItems={chkItems}
                    scanItems={scanItems}
                    globalReportDate={globalReportDate}
                    setGlobalReportDate={setGlobalReportDate}
                    onDeleteItem={handleDeleteWipItem}
                    onUpdateItem={handleUpdateWipItem}
                    onImportItems={handleImportWipItems}
                  />
                </div>
              </>
            )}

            {dashboardTab === 'chk_sheet' && (
              <OutputReconciliation
                wipItems={wipItems}
                chkItems={chkItems}
                onSyncWipOutput={handleSyncWipOutput}
                onImportBulkChkItems={handleImportBulkChkItems}
                onRefreshChkSheet={loadChkSheetData}
                isRefreshingChkSheet={isRefreshingChkSheet}
              />
            )}

            {dashboardTab === 'scan_comparison' && (
              <ScanDistribusiComparison
                wipItems={wipItems}
                scanItems={scanItems}
                onRefreshScan={loadScanDistribusiData}
                isRefreshingScan={isRefreshingScan}
              />
            )}
          </>
        ) : (
          <>
            {selectedLineId && (
              <LineWipDetail
                lineId={selectedLineId}
                leaderNik={leaderNik}
                spoOptions={spoOptions}
                wipItems={wipItems}
                globalReportDate={globalReportDate}
                setGlobalReportDate={setGlobalReportDate}
                onBackToDashboard={handleBackToDashboard}
                onSaveWip={handleSaveWipItem}
                onAddNewSpoOption={handleAddNewSpoOption}
                onRefreshSpoSheet={loadSpoSheetData}
                isRefreshingSpoSheet={isRefreshingSpoSheet}
              />
            )}

            {/* Line Specific WIP Table */}
            <div className="mt-8 border-t border-slate-200 pt-6">
              <WipTable
                activeLineId={selectedLineId || undefined}
                items={
                  selectedLineId
                    ? wipItems.filter((i) => i.lineId === selectedLineId)
                    : wipItems
                }
                chkItems={
                  selectedLineId
                    ? chkItems.filter((c) => c.line === selectedLineId)
                    : chkItems
                }
                globalReportDate={globalReportDate}
                setGlobalReportDate={setGlobalReportDate}
                onDeleteItem={handleDeleteWipItem}
                onUpdateItem={handleUpdateWipItem}
                onImportItems={handleImportWipItems}
                hideExportButtons={true}
              />
            </div>
          </>
        )}
      </main>

      {/* Login Leader Modal */}
      <LoginLeaderModal
        isOpen={isLoginModalOpen}
        lineId={selectedLineId}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLoginSubmit}
      />

      {/* Data Source Configuration Modal */}
      <DataSourceModal
        isOpen={isDataSourceModalOpen}
        onClose={() => setIsDataSourceModalOpen(false)}
        lines={lines}
        wipItems={wipItems}
        spoOptions={spoOptions}
        chkItems={chkItems}
        onImportData={handleImportDataSource}
      />

      {/* Google Sheets Direct Export Modal */}
      <GoogleSheetsExportModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        wipItems={wipItems}
        chkItems={chkItems}
        spoOptions={spoOptions}
        lines={lines}
        onImportWipItems={handleImportWipItems}
        onClearAllWip={handleClearAllWip}
      />

      {/* Non-blocking Floating Sync Indicator (Google Sheets / Docs style) */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end pointer-events-none">
        <div className="pointer-events-auto transition-all duration-300">
          {syncStatus === 'syncing' && (
            <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-900/90 text-white backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/80 text-xs animate-fadeIn">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
              <span className="font-medium">Menyimpan ke Google Sheets...</span>
            </div>
          )}

          {syncStatus === 'synced' && (
            <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-950/90 text-emerald-200 backdrop-blur-md rounded-2xl shadow-xl border border-emerald-700/60 text-xs animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">Semua perubahan tersimpan di Spreadsheet</span>
            </div>
          )}

          {syncStatus === 'error' && (
            <div className="flex items-center gap-3 px-4 py-2 bg-rose-950/95 text-rose-100 backdrop-blur-md rounded-2xl shadow-2xl border border-rose-700/80 text-xs animate-shake">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <p className="font-bold">Gagal tersambung ke Spreadsheet</p>
                <p className="text-[10px] text-rose-300">Data tersimpan di perangkat lokal</p>
              </div>
              <button
                type="button"
                onClick={handleRetryPushSync}
                className="flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ml-1 active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Ulangi</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 font-medium">
        WIP Sewing System &bull; Production Leader Portal &bull; Syncora Factory OS
      </footer>
    </div>
  );
}
