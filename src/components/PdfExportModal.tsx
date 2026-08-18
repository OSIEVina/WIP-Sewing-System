import React, { useState, useRef } from 'react';
import { WipItem, ChkItem } from '../types';
import { getLineManpower, checkManpowerDeviation } from '../utils/manpower';
import { normalizeDateStr, getTodayDateStr } from '../utils/date';
import { X, FileText, Download, Calendar, Printer, Layers, Building2 } from 'lucide-react';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDates: string[];
  items: WipItem[];
  chkItems?: ChkItem[];
  globalReportDate?: string;
  setGlobalReportDate?: (date: string) => void;
}

const SIZE_ORDER: Record<string, number> = {
  '3XS': 1,
  '2XS': 2,
  'XS': 3,
  S: 4,
  M: 5,
  L: 6,
  XL: 7,
  '2XL': 8,
  XXL: 8,
  '3XL': 9,
  XXXL: 9,
  '4XL': 10,
  '5XL': 11,
};

function compareSizes(a: string, b: string): number {
  const cleanA = (a || '').toUpperCase().trim();
  const cleanB = (b || '').toUpperCase().trim();
  const orderA = SIZE_ORDER[cleanA] || 99;
  const orderB = SIZE_ORDER[cleanB] || 99;
  if (orderA !== orderB) return orderA - orderB;
  return cleanA.localeCompare(cleanB, undefined, { numeric: true });
}

function formatDateIndo(dateStr: string): string {
  const norm = normalizeDateStr(dateStr);
  if (!norm) return dateStr;
  const parts = norm.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[monthIdx] || parts[1];
  return `${day}-${monthName}-${year.slice(2)}`;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  availableDates,
  items,
  chkItems = [],
  globalReportDate,
  setGlobalReportDate,
}) => {
  const todayStr = getTodayDateStr();
  const [targetDate, setTargetDate] = useState<string>(
    globalReportDate || availableDates[0] || todayStr
  );
  const [selectedBuilding, setSelectedBuilding] = useState<'ALL' | 'AB' | 'CD'>('ALL');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const normTargetDate = normalizeDateStr(targetDate);

  const handleDateChange = (newDate: string) => {
    setTargetDate(newDate);
    if (setGlobalReportDate) {
      setGlobalReportDate(newDate);
    }
  };

  const getItemWipSewing = (item: WipItem): number => {
    const stationSum =
      (item.wip0 || 0) +
      (item.wip1 || 0) +
      (item.wip2 || 0) +
      (item.wip3 || 0) +
      (item.wip4 || 0) +
      (item.wip5 || 0);
    if (stationSum > 0) return stationSum;
    if (item.wipSewing !== undefined && item.wipSewing !== null && item.wipSewing > 0) {
      return item.wipSewing;
    }
    return 0;
  };

  // 1. Determine all unique line IDs across the system
  const allLineIds = Array.from(
    new Set(items.map((i) => (i.lineId || 'A01').trim().toUpperCase()))
  ).sort();
  if (allLineIds.length === 0) {
    allLineIds.push('A01');
  }

  // Process items for targetDate
  const processedLineMap = new Map<
    string,
    {
      itemsList: (WipItem & {
        incum: number;
        outcu: number;
        blcOrder: number;
        rowWipSewing: number;
      })[];
      hasExplicitData: boolean;
    }
  >();

  allLineIds.forEach((lineId) => {
    const lineItems = items.filter(
      (i) => (i.lineId || 'A01').trim().toUpperCase() === lineId
    );

    const explicitOnTarget = lineItems.filter((i) => {
      const d = normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : ''));
      return d === normTargetDate;
    });

    const hasExplicitData = explicitOnTarget.length > 0;

    const uniqueKeys = new Set<string>();
    lineItems.forEach((i) => {
      uniqueKeys.add(`${(i.spo || '').trim().toUpperCase()}|${(i.color || '').trim().toUpperCase()}|${(i.size || '').trim().toUpperCase()}`);
    });

    const computedItems: (WipItem & {
      incum: number;
      outcu: number;
      blcOrder: number;
      rowWipSewing: number;
    })[] = [];

    uniqueKeys.forEach((key) => {
      const explicit = explicitOnTarget.find(
        (i) => `${(i.spo || '').trim().toUpperCase()}|${(i.color || '').trim().toUpperCase()}|${(i.size || '').trim().toUpperCase()}` === key
      );

      const allPriorAndCurrent = lineItems.filter((i) => {
        const d = normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : ''));
        return (
          `${(i.spo || '').trim().toUpperCase()}|${(i.color || '').trim().toUpperCase()}|${(i.size || '').trim().toUpperCase()}` === key &&
          d <= normTargetDate
        );
      });

      const accumIn = allPriorAndCurrent.reduce((s, i) => s + (i.inHariIni || 0), 0);
      const accumOutPacking = allPriorAndCurrent.reduce((s, i) => s + (i.outPacking || 0), 0);
      const accumOutSewing = allPriorAndCurrent.reduce((s, i) => s + (i.outSewing || 0), 0);

      if (explicit) {
        const rowWipSewing = getItemWipSewing(explicit);
        const blcOrder = Math.max(0, (explicit.qtyOrder || 0) - accumOutPacking);

        computedItems.push({
          ...explicit,
          incum: accumIn,
          outcu: accumOutPacking || accumOutSewing,
          blcOrder,
          rowWipSewing,
        });
      } else {
        const priorItems = lineItems.filter((i) => {
          const d = normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : ''));
          return (
            `${(i.spo || '').trim().toUpperCase()}|${(i.color || '').trim().toUpperCase()}|${(i.size || '').trim().toUpperCase()}` === key &&
            d < normTargetDate
          );
        });

        if (priorItems.length > 0) {
          priorItems.sort((a, b) => {
            const dA = normalizeDateStr(a.date || '');
            const dB = normalizeDateStr(b.date || '');
            return dB.localeCompare(dA);
          });

          const latestPrior = priorItems[0];
          const pastScanIn = priorItems.reduce((s, i) => s + (i.inHariIni || 0), 0);
          const pastOutSewing = priorItems.reduce((s, i) => s + (i.outSewing || 0), 0);
          const pastOutPacking = priorItems.reduce((s, i) => s + (i.outPacking || 0), 0);

          let carryWipSewing = Math.max(0, pastScanIn - pastOutSewing);
          if (carryWipSewing === 0 && (latestPrior.wipSewing || 0) > 0) {
            carryWipSewing = latestPrior.wipSewing || 0;
          }

          let carryWipFinish = Math.max(0, pastOutSewing - pastOutPacking);
          if (carryWipFinish === 0 && (latestPrior.wipFinish || 0) > 0) {
            carryWipFinish = latestPrior.wipFinish || 0;
          }

          const blcOrder = Math.max(0, (latestPrior.qtyOrder || 0) - pastOutPacking);

          const projectedItem: WipItem & {
            incum: number;
            outcu: number;
            blcOrder: number;
            rowWipSewing: number;
          } = {
            id: `proj-${lineId}-${latestPrior.spo}-${latestPrior.size}-${normTargetDate}`,
            lineId,
            spo: latestPrior.spo,
            style: latestPrior.style,
            color: latestPrior.color,
            size: latestPrior.size,
            qtyOrder: latestPrior.qtyOrder,
            unit: latestPrior.unit || 'PCE',
            date: normTargetDate,
            inHariIni: 0,
            wip0: 0,
            wip1: 0,
            wip2: 0,
            wip3: 0,
            wip4: 0,
            wip5: 0,
            wipSewing: carryWipSewing,
            outSewing: 0,
            chk3d: 0,
            wipFinish: carryWipFinish,
            outPacking: 0,
            createdAt: `${normTargetDate}T00:00:00.000Z`,
            updatedAt: `${normTargetDate}T00:00:00.000Z`,
            incum: pastScanIn,
            outcu: pastOutPacking || pastOutSewing,
            blcOrder,
            rowWipSewing: carryWipSewing,
          };

          computedItems.push(projectedItem);
        }
      }
    });

    if (computedItems.length > 0) {
      processedLineMap.set(lineId, {
        itemsList: computedItems,
        hasExplicitData,
      });
    }
  });

  const allLinesToRender = Array.from(processedLineMap.entries());

  // Building classification helpers
  const isGedungAB = (lineId: string) => {
    const clean = lineId.replace(/line\s*/i, '').trim().toUpperCase();
    return clean.startsWith('A') || clean.startsWith('B');
  };

  const isGedungCD = (lineId: string) => {
    const clean = lineId.replace(/line\s*/i, '').trim().toUpperCase();
    return clean.startsWith('C') || clean.startsWith('D');
  };

  const abLines = allLinesToRender.filter(([lineId]) => isGedungAB(lineId));
  const cdLines = allLinesToRender.filter(([lineId]) => isGedungCD(lineId));
  const otherLines = allLinesToRender.filter(([lineId]) => !isGedungAB(lineId) && !isGedungCD(lineId));

  const handleDownloadPdf = () => {
    setIsGenerating(true);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Popup diblokir oleh browser. Harap izinkan popup untuk situs ini.');
        setIsGenerating(false);
        return;
      }

      const formattedDateHeader = formatDateIndo(targetDate);

      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>WIP LINE REPORT - ${targetDate}</title>
          <style>
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; box-sizing: border-box; }
            body { font-family: 'Arial Narrow', Arial, sans-serif; font-size: 10px; color: #000; margin: 10px; background: #fff; }
            .building-header-banner { background-color: #1e293b !important; color: #ffffff !important; font-size: 14px; font-weight: 900; padding: 6px 12px; margin-top: 20px; margin-bottom: 12px; border: 1.5px solid #000; text-transform: uppercase; letter-spacing: 1px; font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: space-between; }
            .line-container { margin-bottom: 25px; page-break-inside: avoid; border: 1px solid #000; }
            .line-header-banner { background-color: #ffff00 !important; color: #000 !important; font-size: 13px; font-weight: 900; padding: 4px 8px; border-bottom: 1px solid #000; font-family: Arial, sans-serif; text-transform: uppercase; }
            .periode-subtitle { font-size: 10px; font-weight: bold; margin-bottom: 2px; padding: 2px 8px; font-family: Arial, sans-serif; border-bottom: 1px solid #000; background-color: #ffffff; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; font-family: monospace; }
            th, td { border: 1px solid #000; padding: 3px 4px; text-align: center; }
            th { background-color: #e2e8f0 !important; font-weight: bold; font-family: Arial, sans-serif; font-size: 9px; }
            th.th-wip-finish { background-color: #dbeafe !important; }
            .bg-wip-finish-cell { background-color: #eff6ff !important; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .text-blue-total { color: #0000ff !important; font-weight: bold; }
            .font-bold { font-weight: bold; }
            .font-black { font-weight: 900; }
            .footer-summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; padding: 6px; background-color: #f8fafc; border-top: 1px solid #000; font-size: 9px; }
            .card-box { border: 1px solid #94a3b8; padding: 4px; background: #ffffff !important; }
            .card-yellow { background-color: #ffff00 !important; font-weight: bold; border: 1px solid #ca8a04; }
            .card-purple { background-color: #e9d5ff !important; font-weight: bold; border: 1px solid #a855f7; }
            .page-break { page-break-before: always !important; break-before: page !important; }
            @media print {
              body { margin: 0; }
              @page { size: landscape; margin: 8mm; }
            }
          </style>
        </head>
        <body>
      `;

      const generateLinesHtml = (linesGroup: typeof allLinesToRender) => {
        let grpHtml = '';
        linesGroup.forEach(([lineId, { itemsList, hasExplicitData }]) => {
          const mp = getLineManpower(lineId, targetDate);
          const dev = checkManpowerDeviation(mp);

          const spoGroups: Record<string, typeof itemsList> = {};
          itemsList.forEach((item) => {
            const key = item.spo || '-';
            if (!spoGroups[key]) spoGroups[key] = [];
            spoGroups[key].push(item);
          });

          Object.keys(spoGroups).forEach((k) => {
            spoGroups[k].sort((a, b) => compareSizes(a.size, b.size));
          });

          const totalQty = itemsList.reduce((s, i) => s + (i.qtyOrder || 0), 0);
          const totalInHariIni = itemsList.reduce((s, i) => s + (i.inHariIni || 0), 0);
          const totalWip0 = itemsList.reduce((s, i) => s + (i.wip0 || 0), 0);
          const totalWip1 = itemsList.reduce((s, i) => s + (i.wip1 || 0), 0);
          const totalWip2 = itemsList.reduce((s, i) => s + (i.wip2 || 0), 0);
          const totalWip3 = itemsList.reduce((s, i) => s + (i.wip3 || 0), 0);
          const totalWip4 = itemsList.reduce((s, i) => s + (i.wip4 || 0), 0);
          const totalWip5 = itemsList.reduce((s, i) => s + (i.wip5 || 0), 0);
          const totalWipSewing = itemsList.reduce((s, i) => s + i.rowWipSewing, 0);
          const totalOutSewing = itemsList.reduce((s, i) => s + (i.outSewing || 0), 0);
          const totalChk3d = itemsList.reduce((s, i) => s + (i.chk3d || 0), 0);
          const totalWipFinish = itemsList.reduce((s, i) => s + (i.wipFinish || 0), 0);
          const totalOutPacking = itemsList.reduce((s, i) => s + (i.outPacking || 0), 0);
          const totalIncum = itemsList.reduce((s, i) => s + i.incum, 0);
          const totalOutcu = itemsList.reduce((s, i) => s + i.outcu, 0);
          const totalBlcOrder = itemsList.reduce((s, i) => s + i.blcOrder, 0);

          grpHtml += `
            <div class="line-container">
              <div class="line-header-banner">
                WIP LINE ${lineId.toUpperCase()}
              </div>
              <div class="periode-subtitle">
                PERIODE: ${formattedDateHeader} ${
            !hasExplicitData
              ? ' (Carryover Data Kemarin - Hanya WIP Sewing & WIP Finishing)'
              : ''
          }
              </div>

              <table>
                <thead>
                  <tr>
                    <th>SPO</th>
                    <th>STYLE</th>
                    <th>COLOR</th>
                    <th>SIZE</th>
                    <th>QTY ORDE</th>
                    <th>UNIT</th>
                    <th>IN HARI</th>
                    <th>WIPO</th>
                    <th>WIP1</th>
                    <th>WIP2</th>
                    <th>WIP3</th>
                    <th>WIP4</th>
                    <th>WIP5</th>
                    <th>WIP SEWI</th>
                    <th>OUTP</th>
                    <th>CHK1</th>
                    <th class="th-wip-finish">WIP FINIS</th>
                    <th>OUT PACK</th>
                    <th>INCUM</th>
                    <th>OUTCU</th>
                    <th>BLC ORDER</th>
                  </tr>
                </thead>
                <tbody>
          `;

          Object.keys(spoGroups).forEach((spoKey) => {
            const grp = spoGroups[spoKey];
            const grpQty = grp.reduce((s, i) => s + (i.qtyOrder || 0), 0);
            const grpInHari = grp.reduce((s, i) => s + (i.inHariIni || 0), 0);
            const grpW0 = grp.reduce((s, i) => s + (i.wip0 || 0), 0);
            const grpW1 = grp.reduce((s, i) => s + (i.wip1 || 0), 0);
            const grpW2 = grp.reduce((s, i) => s + (i.wip2 || 0), 0);
            const grpW3 = grp.reduce((s, i) => s + (i.wip3 || 0), 0);
            const grpW4 = grp.reduce((s, i) => s + (i.wip4 || 0), 0);
            const grpW5 = grp.reduce((s, i) => s + (i.wip5 || 0), 0);
            const grpWipSew = grp.reduce((s, i) => s + i.rowWipSewing, 0);
            const grpOutSew = grp.reduce((s, i) => s + (i.outSewing || 0), 0);
            const grpChk3d = grp.reduce((s, i) => s + (i.chk3d || 0), 0);
            const grpWipFin = grp.reduce((s, i) => s + (i.wipFinish || 0), 0);
            const grpOutPack = grp.reduce((s, i) => s + (i.outPacking || 0), 0);
            const grpIncum = grp.reduce((s, i) => s + i.incum, 0);
            const grpOutcu = grp.reduce((s, i) => s + i.outcu, 0);
            const grpBlcOrder = grp.reduce((s, i) => s + i.blcOrder, 0);

            grp.forEach((item) => {
              grpHtml += `
                <tr>
                  <td class="font-bold text-left">${item.spo}</td>
                  <td class="text-left">${item.style}</td>
                  <td class="text-left">${item.color}</td>
                  <td class="font-bold">${item.size}</td>
                  <td class="text-right">${item.qtyOrder?.toLocaleString() || '-'}</td>
                  <td>${item.unit || 'PCE'}</td>
                  <td>${item.inHariIni || '-'}</td>
                  <td>${item.wip0 || '-'}</td>
                  <td>${item.wip1 || '-'}</td>
                  <td>${item.wip2 || '-'}</td>
                  <td>${item.wip3 || '-'}</td>
                  <td>${item.wip4 || '-'}</td>
                  <td>${item.wip5 || '-'}</td>
                  <td class="font-bold">${item.rowWipSewing || '0'}</td>
                  <td>${item.outSewing || '-'}</td>
                  <td>${item.chk3d || '-'}</td>
                  <td class="bg-wip-finish-cell font-bold">${item.wipFinish || '0'}</td>
                  <td>${item.outPacking || '-'}</td>
                  <td>${item.incum || '-'}</td>
                  <td>${item.outcu || '-'}</td>
                  <td>${item.blcOrder || '-'}</td>
                </tr>
              `;
            });

            // SPO TOTAL ROW
            const firstItem = grp[0];
            const spoLabel = `${firstItem.spo} ${firstItem.style} ${firstItem.color} TOTAL`;
            grpHtml += `
              <tr style="background-color: #f8fafc;">
                <td colspan="4" class="text-left text-blue-total">${spoLabel}</td>
                <td class="text-right text-blue-total">${grpQty.toLocaleString()}</td>
                <td class="text-blue-total">PCE</td>
                <td class="text-blue-total">${grpInHari || '-'}</td>
                <td class="text-blue-total">${grpW0 || '-'}</td>
                <td class="text-blue-total">${grpW1 || '-'}</td>
                <td class="text-blue-total">${grpW2 || '-'}</td>
                <td class="text-blue-total">${grpW3 || '-'}</td>
                <td class="text-blue-total">${grpW4 || '-'}</td>
                <td class="text-blue-total">${grpW5 || '-'}</td>
                <td class="text-blue-total">${grpWipSew}</td>
                <td class="text-blue-total">${grpOutSew || '-'}</td>
                <td class="text-blue-total">${grpChk3d || '-'}</td>
                <td class="text-blue-total">${grpWipFin}</td>
                <td class="text-blue-total">${grpOutPack || '-'}</td>
                <td class="text-blue-total">${grpIncum || '-'}</td>
                <td class="text-blue-total">${grpOutcu || '-'}</td>
                <td class="text-blue-total">${grpBlcOrder || '-'}</td>
              </tr>
            `;
          });

          // 10 BARIS KOSONG DI SETIAP LINE
          Array.from({ length: 10 }).forEach((_, idx) => {
            grpHtml += `
              <tr style="height: 22px;">
                <td class="text-left font-bold" style="color: #94a3b8;">${idx + 1}</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
                <td style="height: 22px;">&nbsp;</td>
              </tr>
            `;
          });

          // LINE GRAND TOTAL ROW
          grpHtml += `
                  <tr style="background-color: #e2e8f0; font-weight: 900;">
                    <td colspan="4" class="text-right font-black">TOTAL:</td>
                    <td class="text-right font-black">${totalQty.toLocaleString()}</td>
                    <td class="font-black">PCE</td>
                    <td class="font-black">${totalInHariIni}</td>
                    <td class="font-black">${totalWip0}</td>
                    <td class="font-black">${totalWip1}</td>
                    <td class="font-black">${totalWip2}</td>
                    <td class="font-black">${totalWip3}</td>
                    <td class="font-black">${totalWip4}</td>
                    <td class="font-black">${totalWip5}</td>
                    <td class="font-black">${totalWipSewing}</td>
                    <td class="font-black">${totalOutSewing}</td>
                    <td class="font-black">${totalChk3d}</td>
                    <td class="font-black">${totalWipFinish}</td>
                    <td class="font-black">${totalOutPacking}</td>
                    <td class="font-black">${totalIncum}</td>
                    <td class="font-black">${totalOutcu}</td>
                    <td class="font-black">${totalBlcOrder}</td>
                  </tr>
                </tbody>
              </table>

              <!-- NOTE & MANPOWER SUMMARY BLOCK -->
              <div class="footer-summary-grid">
                <div class="card-box">
                  <span style="color: #475569; font-weight: bold; display: block;">TARGET MP:</span>
                  <span>${mp.normalMp} Orang (${mp.normalHours} Jam)</span>
                </div>
                <div class="card-box">
                  <span style="color: #475569; font-weight: bold; display: block;">LEMBUR MP:</span>
                  <span>${mp.overtimeMp} Orang (${mp.overtimeHours} Jam)</span>
                </div>
                <div class="card-box card-yellow">
                  <span style="color: #000; font-weight: bold; display: block;">AKTUAL WIP SEWING:</span>
                  <span style="font-size: 11px; font-weight: 900;">${totalWipSewing} PCE</span>
                </div>
                <div class="card-box card-purple">
                  <span style="color: #000; font-weight: bold; display: block;">AKTUAL WIP FINISHING:</span>
                  <span style="font-size: 11px; font-weight: 900;">${totalWipFinish} PCE</span>
                </div>
                <div class="card-box">
                  <span style="color: #475569; font-weight: bold; display: block;">STATUS JAM KERJA:</span>
                  <span>${dev.totalHours} Jam (${dev.isDeviation ? '⚠️ DEVIASI' : 'NORMAL'})</span>
                </div>
              </div>
            </div>
          `;
        });
        return grpHtml;
      };

      if (allLinesToRender.length === 0) {
        htmlContent += `<div style="text-align: center; padding: 40px; color: #666;">Tidak ada data WIP untuk tanggal ${targetDate}.</div>`;
      } else {
        if (selectedBuilding === 'ALL' || selectedBuilding === 'AB') {
          if (abLines.length > 0) {
            htmlContent += `<div class="building-header-banner">🏢 LAPORAN WIP - GEDUNG A & B</div>`;
            htmlContent += generateLinesHtml(abLines);
          }
        }

        if (selectedBuilding === 'ALL' && abLines.length > 0 && cdLines.length > 0) {
          htmlContent += `<div class="page-break"></div>`;
        }

        if (selectedBuilding === 'ALL' || selectedBuilding === 'CD') {
          if (cdLines.length > 0) {
            htmlContent += `<div class="building-header-banner">🏢 LAPORAN WIP - GEDUNG C & D</div>`;
            htmlContent += generateLinesHtml(cdLines);
          }
        }

        if (otherLines.length > 0 && selectedBuilding === 'ALL') {
          htmlContent += `<div class="building-header-banner">🏢 LAPORAN WIP - LINE LAINNYA</div>`;
          htmlContent += generateLinesHtml(otherLines);
        }
      }

      htmlContent += `
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setIsGenerating(false);
      onClose();
    } catch (error) {
      console.error('Failed to open print window:', error);
      alert('Gagal membuka jendela cetak PDF. Silakan coba lagi.');
      setIsGenerating(false);
    }
  };

  // Determine lines to render in UI preview
  const previewLinesGroup =
    selectedBuilding === 'AB'
      ? [{ title: 'GEDUNG A & B', lines: abLines }]
      : selectedBuilding === 'CD'
      ? [{ title: 'GEDUNG C & D', lines: cdLines }]
      : [
          { title: 'GEDUNG A & B', lines: abLines },
          { title: 'GEDUNG C & D', lines: cdLines },
          { title: 'LINE LAINNYA', lines: otherLines },
        ].filter((g) => g.lines.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-yellow-400/20 rounded-xl border border-yellow-400/30">
              <FileText className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide flex items-center gap-2">
                Export Laporan WIP (Format Excel / PDF)
              </h2>
              <p className="text-xs text-slate-400">
                Pilih tanggal & filter Gedung (AB / CD). Kolom CHECK disembunyikan & ditambah 10 baris kosong per line untuk catatan manual.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date & Building Selector Controls Bar */}
        <div className="p-5 bg-slate-100 border-b border-slate-200 space-y-4 shrink-0">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Building Selection Tabs */}
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-300 shadow-xs">
              <span className="text-xs font-bold text-slate-500 px-2 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-600" />
                Gedung:
              </span>
              <button
                type="button"
                onClick={() => setSelectedBuilding('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedBuilding === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                🏢 Semua Gedung ({allLinesToRender.length} Line)
              </button>
              <button
                type="button"
                onClick={() => setSelectedBuilding('AB')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedBuilding === 'AB'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                🏭 Gedung AB ({abLines.length} Line)
              </button>
              <button
                type="button"
                onClick={() => setSelectedBuilding('CD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedBuilding === 'CD'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                🏭 Gedung CD ({cdLines.length} Line)
              </button>
            </div>

            {/* Date Selection Controls */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-xs">
                <span className="text-xs font-bold text-slate-600">Pilih Tanggal:</span>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none cursor-pointer"
                />
              </div>

              <select
                value={targetDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
              >
                <option value={targetDate}>
                  📅 Terpilih: {targetDate} {targetDate === todayStr ? '(Hari Ini)' : ''}
                </option>
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === todayStr ? '(Hari Ini)' : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleDateChange(todayStr)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                  targetDate === todayStr
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Hari Ini
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body & Interactive Preview */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-inner overflow-x-auto">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-slate-600" />
                Preview Tampilan Laporan (Tanpa Kolom Check + 10 Baris Kosong)
              </span>
              <span className="font-mono bg-yellow-100 text-yellow-900 px-2.5 py-1 rounded border border-yellow-300">
                TANGGAL: {formatDateIndo(targetDate)}
              </span>
            </div>

            <div
              ref={reportRef}
              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
              className="printable-report p-4 space-y-8 min-w-[1050px] font-mono text-xs border border-slate-300 rounded-lg"
            >
              {allLinesToRender.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-mono">
                  Tidak ada data WIP untuk tanggal {targetDate}.
                </div>
              ) : (
                previewLinesGroup.map((group) => (
                  <div key={group.title} className="space-y-6">
                    <div className="bg-slate-900 text-white px-4 py-2 font-black text-xs uppercase tracking-wider rounded-lg flex items-center justify-between shadow-xs">
                      <span className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-yellow-400" />
                        LAPORAN WIP - {group.title}
                      </span>
                      <span className="text-[11px] text-slate-300 font-normal">
                        Total {group.lines.length} Line Production
                      </span>
                    </div>

                    {group.lines.map(([lineId, { itemsList, hasExplicitData }]) => {
                      const mp = getLineManpower(lineId, targetDate);
                      const dev = checkManpowerDeviation(mp);

                      const spoGroups: Record<string, typeof itemsList> = {};
                      itemsList.forEach((item) => {
                        const key = item.spo || '-';
                        if (!spoGroups[key]) spoGroups[key] = [];
                        spoGroups[key].push(item);
                      });

                      Object.keys(spoGroups).forEach((k) => {
                        spoGroups[k].sort((a, b) => compareSizes(a.size, b.size));
                      });

                      const totalQty = itemsList.reduce((s, i) => s + (i.qtyOrder || 0), 0);
                      const totalInHariIni = itemsList.reduce((s, i) => s + (i.inHariIni || 0), 0);
                      const totalWip0 = itemsList.reduce((s, i) => s + (i.wip0 || 0), 0);
                      const totalWip1 = itemsList.reduce((s, i) => s + (i.wip1 || 0), 0);
                      const totalWip2 = itemsList.reduce((s, i) => s + (i.wip2 || 0), 0);
                      const totalWip3 = itemsList.reduce((s, i) => s + (i.wip3 || 0), 0);
                      const totalWip4 = itemsList.reduce((s, i) => s + (i.wip4 || 0), 0);
                      const totalWip5 = itemsList.reduce((s, i) => s + (i.wip5 || 0), 0);
                      const totalWipSewing = itemsList.reduce((s, i) => s + i.rowWipSewing, 0);
                      const totalOutSewing = itemsList.reduce((s, i) => s + (i.outSewing || 0), 0);
                      const totalChk3d = itemsList.reduce((s, i) => s + (i.chk3d || 0), 0);
                      const totalWipFinish = itemsList.reduce((s, i) => s + (i.wipFinish || 0), 0);
                      const totalOutPacking = itemsList.reduce((s, i) => s + (i.outPacking || 0), 0);
                      const totalIncum = itemsList.reduce((s, i) => s + i.incum, 0);
                      const totalOutcu = itemsList.reduce((s, i) => s + i.outcu, 0);
                      const totalBlcOrder = itemsList.reduce((s, i) => s + i.blcOrder, 0);

                      return (
                        <div key={lineId} className="space-y-0 border border-slate-900 rounded bg-white overflow-hidden shadow-xs">
                          {/* Yellow Line Header Banner */}
                          <div className="bg-yellow-300 border-b border-slate-900 px-3 py-1.5 font-black text-slate-900 text-xs tracking-wider uppercase">
                            WIP LINE {lineId.toUpperCase()}
                          </div>
                          <div className="bg-white border-b border-slate-900 px-3 py-1 font-bold text-slate-800 text-[11px] flex items-center justify-between">
                            <span>PERIODE: {formatDateIndo(targetDate)}</span>
                            {!hasExplicitData && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 font-normal">
                                ⚡ Carryover Data Kemarin (Hanya WIP Sewing & WIP Finishing)
                              </span>
                            )}
                          </div>

                          {/* Main Table without CHEC / CHEC CHK */}
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[10px]">
                              <thead>
                                <tr className="bg-slate-200 text-slate-900 font-bold text-center border-b border-slate-900">
                                  <th className="border border-slate-900 p-1">SPO</th>
                                  <th className="border border-slate-900 p-1">STYLE</th>
                                  <th className="border border-slate-900 p-1">COLOR</th>
                                  <th className="border border-slate-900 p-1">SIZE</th>
                                  <th className="border border-slate-900 p-1">QTY ORDE</th>
                                  <th className="border border-slate-900 p-1">UNIT</th>
                                  <th className="border border-slate-900 p-1">IN HARI</th>
                                  <th className="border border-slate-900 p-1">WIPO</th>
                                  <th className="border border-slate-900 p-1">WIP1</th>
                                  <th className="border border-slate-900 p-1">WIP2</th>
                                  <th className="border border-slate-900 p-1">WIP3</th>
                                  <th className="border border-slate-900 p-1">WIP4</th>
                                  <th className="border border-slate-900 p-1">WIP5</th>
                                  <th className="border border-slate-900 p-1">WIP SEWI</th>
                                  <th className="border border-slate-900 p-1">OUTP</th>
                                  <th className="border border-slate-900 p-1">CHK1</th>
                                  <th className="border border-slate-900 p-1 bg-sky-100">WIP FINIS</th>
                                  <th className="border border-slate-900 p-1">OUT PACK</th>
                                  <th className="border border-slate-900 p-1">INCUM</th>
                                  <th className="border border-slate-900 p-1">OUTCU</th>
                                  <th className="border border-slate-900 p-1">BLC ORDER</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.keys(spoGroups).map((spoKey) => {
                                  const grp = spoGroups[spoKey];
                                  const grpQty = grp.reduce((s, i) => s + (i.qtyOrder || 0), 0);
                                  const grpInHari = grp.reduce((s, i) => s + (i.inHariIni || 0), 0);
                                  const grpW0 = grp.reduce((s, i) => s + (i.wip0 || 0), 0);
                                  const grpW1 = grp.reduce((s, i) => s + (i.wip1 || 0), 0);
                                  const grpW2 = grp.reduce((s, i) => s + (i.wip2 || 0), 0);
                                  const grpW3 = grp.reduce((s, i) => s + (i.wip3 || 0), 0);
                                  const grpW4 = grp.reduce((s, i) => s + (i.wip4 || 0), 0);
                                  const grpW5 = grp.reduce((s, i) => s + (i.wip5 || 0), 0);
                                  const grpWipSew = grp.reduce((s, i) => s + i.rowWipSewing, 0);
                                  const grpOutSew = grp.reduce((s, i) => s + (i.outSewing || 0), 0);
                                  const grpChk3d = grp.reduce((s, i) => s + (i.chk3d || 0), 0);
                                  const grpWipFin = grp.reduce((s, i) => s + (i.wipFinish || 0), 0);
                                  const grpOutPack = grp.reduce((s, i) => s + (i.outPacking || 0), 0);
                                  const grpIncum = grp.reduce((s, i) => s + i.incum, 0);
                                  const grpOutcu = grp.reduce((s, i) => s + i.outcu, 0);
                                  const grpBlcOrder = grp.reduce((s, i) => s + i.blcOrder, 0);

                                  const firstItem = grp[0];

                                  return (
                                    <React.Fragment key={spoKey}>
                                      {grp.map((item, idx) => (
                                        <tr key={item.id || idx} className="text-center hover:bg-slate-50">
                                          <td className="border border-slate-900 p-1 font-bold text-left">{item.spo}</td>
                                          <td className="border border-slate-900 p-1 text-left truncate max-w-[120px]">{item.style}</td>
                                          <td className="border border-slate-900 p-1 text-left truncate max-w-[80px]">{item.color}</td>
                                          <td className="border border-slate-900 p-1 font-bold">{item.size}</td>
                                          <td className="border border-slate-900 p-1 text-right">{item.qtyOrder?.toLocaleString() || '-'}</td>
                                          <td className="border border-slate-900 p-1">{item.unit || 'PCE'}</td>
                                          <td className="border border-slate-900 p-1">{item.inHariIni || '-'}</td>
                                          <td className="border border-slate-900 p-1">{item.wip0 || '-'}</td>
                                          <td className="border border-slate-900 p-1">{item.wip1 || '-'}</td>
                                          <td className="border border-slate-900 p-1">{item.wip2 || '-'}</td>
                                          <td className="border border-slate-900 p-1">{item.wip3 || '-'}</td>
                                          <td className="border border-slate-900 p-1">{item.wip4 || '-'}</td>
                                          <td className="border border-slate-900 p-1">{item.wip5 || '-'}</td>
                                          <td className="border border-slate-900 p-1 font-bold">{item.rowWipSewing || '0'}</td>
                                          <td className="border border-slate-900 p-1">{item.outSewing || '-'}</td>
                                          <td className="border border-slate-900 p-1">{item.chk3d || '-'}</td>
                                          <td className="border border-slate-900 p-1 bg-sky-50 font-bold">{item.wipFinish || '0'}</td>
                                          <td className="border border-slate-900 p-1">{item.outPacking || '-'}</td>
                                          <td className="border border-slate-900 p-1">{item.incum || '-'}</td>
                                          <td className="border border-slate-900 p-1">{item.outcu || '-'}</td>
                                          <td className="border border-slate-900 p-1">{item.blcOrder || '-'}</td>
                                        </tr>
                                      ))}

                                      {/* SPO TOTAL ROW */}
                                      <tr className="bg-slate-50 font-bold text-blue-700 border-t border-b border-slate-900">
                                        <td colSpan={4} className="border border-slate-900 p-1 text-left uppercase text-blue-700">
                                          {firstItem.spo} {firstItem.style} TOTAL
                                        </td>
                                        <td className="border border-slate-900 p-1 text-right text-blue-700">{grpQty.toLocaleString()}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">PCE</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpInHari || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpW0 || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpW1 || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpW2 || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpW3 || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpW4 || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpW5 || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpWipSew}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpOutSew || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpChk3d || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpWipFin}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpOutPack || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpIncum || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpOutcu || '-'}</td>
                                        <td className="border border-slate-900 p-1 text-blue-700">{grpBlcOrder || '-'}</td>
                                      </tr>
                                    </React.Fragment>
                                  );
                                })}

                                {/* 10 BARIS KOSONG PER LINE UNTUK MANUALLING */}
                                {Array.from({ length: 10 }).map((_, emptyIdx) => (
                                  <tr key={`empty-${emptyIdx}`} className="text-center h-5 border-b border-slate-300">
                                    <td className="border border-slate-900 p-1 font-bold text-slate-400 text-left">{emptyIdx + 1}</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                    <td className="border border-slate-900 p-1">&nbsp;</td>
                                  </tr>
                                ))}

                                {/* LINE GRAND TOTAL ROW */}
                                <tr className="bg-slate-200 font-black text-slate-900 border-t-2 border-slate-900">
                                  <td colSpan={4} className="border border-slate-900 p-1 text-right">TOTAL:</td>
                                  <td className="border border-slate-900 p-1 text-right">{totalQty.toLocaleString()}</td>
                                  <td className="border border-slate-900 p-1">PCE</td>
                                  <td className="border border-slate-900 p-1">{totalInHariIni}</td>
                                  <td className="border border-slate-900 p-1">{totalWip0}</td>
                                  <td className="border border-slate-900 p-1">{totalWip1}</td>
                                  <td className="border border-slate-900 p-1">{totalWip2}</td>
                                  <td className="border border-slate-900 p-1">{totalWip3}</td>
                                  <td className="border border-slate-900 p-1">{totalWip4}</td>
                                  <td className="border border-slate-900 p-1">{totalWip5}</td>
                                  <td className="border border-slate-900 p-1">{totalWipSewing}</td>
                                  <td className="border border-slate-900 p-1">{totalOutSewing}</td>
                                  <td className="border border-slate-900 p-1">{totalChk3d}</td>
                                  <td className="border border-slate-900 p-1">{totalWipFinish}</td>
                                  <td className="border border-slate-900 p-1">{totalOutPacking}</td>
                                  <td className="border border-slate-900 p-1">{totalIncum}</td>
                                  <td className="border border-slate-900 p-1">{totalOutcu}</td>
                                  <td className="border border-slate-900 p-1">{totalBlcOrder}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Footer Notes & Manpower Summary Grid */}
                          <div className="grid grid-cols-5 gap-2 p-3 bg-slate-100 border-t border-slate-900 text-[10px] font-mono">
                            <div className="bg-white p-1.5 border border-slate-400 rounded">
                              <span className="font-bold text-slate-600 block">TARGET MP:</span>
                              <span className="font-bold text-slate-900">{mp.normalMp} Org ({mp.normalHours} Jam)</span>
                            </div>
                            <div className="bg-white p-1.5 border border-slate-400 rounded">
                              <span className="font-bold text-slate-600 block">LEMBUR MP:</span>
                              <span className="font-bold text-slate-900">{mp.overtimeMp} Org ({mp.overtimeHours} Jam)</span>
                            </div>
                            <div className="bg-yellow-300 p-1.5 border border-yellow-500 rounded font-bold text-slate-900">
                              <span className="block text-[9px] uppercase">AKTUAL WIP SEWING:</span>
                              <span className="text-xs font-black">{totalWipSewing} PCE</span>
                            </div>
                            <div className="bg-purple-200 p-1.5 border border-purple-400 rounded font-bold text-slate-900">
                              <span className="block text-[9px] uppercase">AKTUAL WIP FINISHING:</span>
                              <span className="text-xs font-black">{totalWipFinish} PCE</span>
                            </div>
                            <div className="bg-white p-1.5 border border-slate-400 rounded">
                              <span className="font-bold text-slate-600 block">STATUS JAM KERJA:</span>
                              <span className="font-bold text-slate-900">{dev.totalHours} Jam ({dev.isDeviation ? '⚠️ DEVIASI' : 'NORMAL'})</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-100 border-t border-slate-200 shrink-0">
          <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
            <span>Selected Date: </span>
            <strong className="text-slate-900">{targetDate}</strong>
            <span className="text-slate-300">|</span>
            <span>Gedung: </span>
            <strong className="text-slate-900">
              {selectedBuilding === 'ALL' ? 'Semua Gedung (AB & CD)' : `Gedung ${selectedBuilding}`}
            </strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl transition shadow-xs"
            >
              Batal
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating || allLinesToRender.length === 0}
              className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg transition disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memproses Laporan...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Cetak / Save PDF Format Excel</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
