import React, { useState, useRef } from 'react';
import { WipItem, ChkItem } from '../types';
import { getLineManpower, checkManpowerDeviation } from '../utils/manpower';
import { normalizeDateStr, getTodayDateStr } from '../utils/date';
import { X, FileText, Download, Calendar, Users, CheckCircle2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDates: string[];
  items: WipItem[];
  chkItems?: ChkItem[];
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  availableDates,
  items,
  chkItems = [],
}) => {
  const todayStr = getTodayDateStr();
  const [targetDate, setTargetDate] = useState<string>(availableDates[0] || todayStr);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Filter items for targetDate
  const normTargetDate = normalizeDateStr(targetDate);
  const dateItems = items.filter((i) => {
    const d = normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : todayStr));
    return d === normTargetDate;
  });

  // Group by Line ID
  const lineMap = new Map<string, WipItem[]>();
  dateItems.forEach((item) => {
    const lId = (item.lineId || 'A01').trim().toUpperCase();
    if (!lineMap.has(lId)) {
      lineMap.set(lId, []);
    }
    lineMap.get(lId)?.push(item);
  });

  const linesToRender = Array.from(lineMap.entries());

  const handleDownloadPdf = () => {
    setIsGenerating(true);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Popup diblokir oleh browser. Harap izinkan popup untuk situs ini.');
        setIsGenerating(false);
        return;
      }

      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Laporan WIP & Manpower - ${targetDate}</title>
          <style>
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
            body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 15px; background: #fff; }
            h1 { text-align: center; font-size: 15px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
            .subtitle { text-align: center; font-size: 11px; margin-bottom: 20px; font-weight: bold; }
            .line-box { border: 1px solid #475569; padding: 12px; margin-bottom: 20px; page-break-inside: avoid; background-color: #ffffff; }
            .line-header { background-color: #fef08a !important; padding: 6px 10px; font-weight: bold; font-size: 12px; border: 1px solid #ca8a04; margin-bottom: 10px; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
            th, td { border: 1px solid #64748b; padding: 5px 6px; text-align: center; }
            th { background-color: #e2e8f0 !important; font-weight: bold; }
            .bg-blue { background-color: #dbeafe !important; }
            .bg-emerald { background-color: #d1fae5 !important; }
            .bg-amber { background-color: #fef3c7 !important; }
            .bg-gray { background-color: #f1f5f9 !important; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 10px; font-size: 10px; }
            .summary-card { border: 1px solid #cbd5e1; padding: 6px; background: #f8fafc !important; }
            @media print {
              body { margin: 0; }
              @page { size: landscape; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <h1>LAPORAN HARIAN WIP & MAN POWER SEWING</h1>
          <div class="subtitle">PERIODE TANGGAL: ${targetDate}</div>
      `;

      if (linesToRender.length === 0) {
        htmlContent += `<div style="text-align: center; padding: 40px; color: #666;">Tidak ada data WIP untuk tanggal ${targetDate}.</div>`;
      } else {
        linesToRender.forEach(([lineId, itemsList]) => {
          const mp = getLineManpower(lineId, targetDate);
          const dev = checkManpowerDeviation(mp);

          const totalQty = itemsList.reduce((s, i) => s + i.qtyOrder, 0);
          const totalInHariIni = itemsList.reduce((s, i) => s + i.inHariIni, 0);
          const totalWip0 = itemsList.reduce((s, i) => s + (i.wip0 || 0), 0);
          const totalWip1 = itemsList.reduce((s, i) => s + (i.wip1 || 0), 0);
          const totalWip2 = itemsList.reduce((s, i) => s + (i.wip2 || 0), 0);
          const totalWip3 = itemsList.reduce((s, i) => s + (i.wip3 || 0), 0);
          const totalWip4 = itemsList.reduce((s, i) => s + (i.wip4 || 0), 0);
          const totalWip5 = itemsList.reduce((s, i) => s + (i.wip5 || 0), 0);
          const totalWipSewing = totalWip0 + totalWip1 + totalWip2 + totalWip3 + totalWip4 + totalWip5;
          const totalOutSewing = itemsList.reduce((s, i) => s + (i.outSewing || 0), 0);
          const totalWipFinish = itemsList.reduce((s, i) => s + (i.wipFinish || 0), 0);
          const totalOutPacking = itemsList.reduce((s, i) => s + (i.outPacking || 0), 0);

          htmlContent += `
            <div class="line-box">
              <div class="line-header">
                <span>WIP LINE ${lineId.toUpperCase()}</span>
                <span>TANGGAL: ${targetDate}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>LINE</th>
                    <th>SPO</th>
                    <th>STYLE</th>
                    <th>COLOR</th>
                    <th>SIZE</th>
                    <th>QTY ORDER</th>
                    <th>UNIT</th>
                    <th class="bg-blue">IN HARI</th>
                    <th>WIP0</th>
                    <th>WIP1</th>
                    <th>WIP2</th>
                    <th>WIP3</th>
                    <th>WIP4</th>
                    <th>WIP5</th>
                    <th class="bg-gray">WIP SEWIN</th>
                    <th class="bg-emerald">OUT SEW</th>
                    <th>CHK 10</th>
                    <th class="bg-amber">WIP FIN</th>
                    <th class="bg-blue">OUT PACK</th>
                    <th>CHECK</th>
                  </tr>
                </thead>
                <tbody>
          `;

          itemsList.forEach((item) => {
            const scanIn = item.inHariIni || 0;
            const wSum = (item.wip0 || 0) + (item.wip1 || 0) + (item.wip2 || 0) + (item.wip3 || 0) + (item.wip4 || 0) + (item.wip5 || 0);
            const wSew = wSum > 0 ? wSum : (item.wipSewing || 0);
            const outS = item.outSewing || 0;
            const chk = item.chk3d || 0;
            const chkVal = scanIn - (wSew + outS);

            htmlContent += `
              <tr>
                <td class="font-bold">${lineId.toUpperCase()}</td>
                <td class="font-bold" style="color: #1d4ed8;">${item.spo}</td>
                <td class="text-left">${item.style}</td>
                <td class="text-left">${item.color}</td>
                <td class="font-bold">${item.size}</td>
                <td class="text-right">${item.qtyOrder?.toLocaleString()}</td>
                <td>${item.unit}</td>
                <td class="bg-blue font-bold">${item.inHariIni || '-'}</td>
                <td>${item.wip0 || '-'}</td>
                <td>${item.wip1 || '-'}</td>
                <td>${item.wip2 || '-'}</td>
                <td>${item.wip3 || '-'}</td>
                <td>${item.wip4 || '-'}</td>
                <td>${item.wip5 || '-'}</td>
                <td class="bg-gray font-bold">${wSew}</td>
                <td class="bg-emerald font-bold" style="color: #065f46;">${item.outSewing || '-'}</td>
                <td>${chk || '-'}</td>
                <td class="bg-amber">${item.wipFinish || '-'}</td>
                <td class="bg-blue">${item.outPacking || '-'}</td>
                <td class="font-bold">${chkVal}</td>
              </tr>
            `;
          });

          htmlContent += `
                  <tr style="background-color: #e2e8f0; font-weight: bold;">
                    <td colspan="5" class="text-right">TOTAL:</td>
                    <td class="text-right">${totalQty.toLocaleString()}</td>
                    <td>PCE</td>
                    <td>${totalInHariIni}</td>
                    <td>${totalWip0}</td>
                    <td>${totalWip1}</td>
                    <td>${totalWip2}</td>
                    <td>${totalWip3}</td>
                    <td>${totalWip4}</td>
                    <td>${totalWip5}</td>
                    <td>${totalWipSewing}</td>
                    <td>${totalOutSewing}</td>
                    <td>-</td>
                    <td>${totalWipFinish}</td>
                    <td>${totalOutPacking}</td>
                    <td>-</td>
                  </tr>
                </tbody>
              </table>

              <div class="summary-grid">
                <div class="summary-card">
                  <span style="color: #64748b; display: block;">JAM KERJA NORMAL:</span>
                  <span class="font-bold" style="color: #1e40af;">${mp.normalHours} Jam</span>
                </div>
                <div class="summary-card">
                  <span style="color: #64748b; display: block;">MP NORMAL:</span>
                  <span class="font-bold" style="color: #1e40af;">${mp.normalMp} Orang</span>
                </div>
                <div class="summary-card">
                  <span style="color: #64748b; display: block;">JAM LEMBUR:</span>
                  <span class="font-bold" style="color: #6b21a8;">${mp.overtimeHours} Jam</span>
                </div>
                <div class="summary-card">
                  <span style="color: #64748b; display: block;">MP LEMBUR:</span>
                  <span class="font-bold" style="color: #6b21a8;">${mp.overtimeMp} Orang</span>
                </div>
                <div class="summary-card" style="grid-column: span 2;">
                  <span style="color: #64748b; display: block;">JAM KERJA & STATUS:</span>
                  <span class="font-bold" style="color: #312e81;">${dev.totalHours} Jam (${dev.isDeviation ? '⚠️ PENYIMPANGAN' : '✓ NORMAL'})</span>
                </div>
                <div class="summary-card" style="grid-column: span 2;">
                  <span style="color: #64748b; display: block;">WIP SEWING TOTAL:</span>
                  <span class="font-bold">${totalWipSewing} Pcs</span>
                </div>
              </div>
            </div>
          `;
        });
      }

      htmlContent += `
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 600);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-fadeIn">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600/30 rounded-xl border border-blue-400/30">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide">Download Laporan PDF Format Excel</h2>
              <p className="text-xs text-slate-400">Pilih tanggal dan unduh laporan format tabel resmi perusahaan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body & Controls */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Pilih Hari / Tanggal Laporan
                </label>
                <p className="text-[11px] text-slate-500">Pilih tanggal yang ingin diexport ke PDF</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === todayStr ? '(Hari Ini)' : ''}
                  </option>
                ))}
              </select>
              <div className="text-xs font-mono bg-blue-50 text-blue-800 px-3 py-2 rounded-xl border border-blue-200 font-bold shrink-0">
                {linesToRender.length} Line Aktif
              </div>
            </div>
          </div>

          {/* Hidden/Preview Printable Excel-Style Report Canvas */}
          <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-inner overflow-x-auto">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
              <span>Preview Tampilan PDF (Format Excel)</span>
              <span>Tanggal: {targetDate}</span>
            </div>

            <div ref={reportRef} style={{ backgroundColor: '#ffffff', color: '#0f172a' }} className="printable-report p-6 space-y-8 min-w-[1000px] font-sans text-xs">
              {/* Document Title Header */}
              <div className="text-center space-y-1 border-b-2 border-slate-900 pb-4">
                <h1 className="text-lg font-black tracking-wider uppercase text-slate-900">
                  LAPORAN HARIAN WIP & MAN POWER SEWING
                </h1>
                <p className="text-xs font-mono font-bold text-slate-600">
                  PERIODE TANGGAL: {targetDate}
                </p>
              </div>

              {linesToRender.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-mono">
                  Tidak ada data WIP untuk tanggal {targetDate}. Silakan pilih tanggal lain atau tambahkan data.
                </div>
              ) : (
                linesToRender.map(([lineId, itemsList]) => {
                  const mp = getLineManpower(lineId, targetDate);
                  const dev = checkManpowerDeviation(mp);

                  const totalQty = itemsList.reduce((s, i) => s + i.qtyOrder, 0);
                  const totalInHariIni = itemsList.reduce((s, i) => s + i.inHariIni, 0);
                  const totalWip0 = itemsList.reduce((s, i) => s + (i.wip0 || 0), 0);
                  const totalWip1 = itemsList.reduce((s, i) => s + (i.wip1 || 0), 0);
                  const totalWip2 = itemsList.reduce((s, i) => s + (i.wip2 || 0), 0);
                  const totalWip3 = itemsList.reduce((s, i) => s + (i.wip3 || 0), 0);
                  const totalWip4 = itemsList.reduce((s, i) => s + (i.wip4 || 0), 0);
                  const totalWip5 = itemsList.reduce((s, i) => s + (i.wip5 || 0), 0);
                  const totalWipSewing = totalWip0 + totalWip1 + totalWip2 + totalWip3 + totalWip4 + totalWip5;
                  const totalOutSewing = itemsList.reduce((s, i) => s + (i.outSewing || 0), 0);
                  const totalWipFinish = itemsList.reduce((s, i) => s + (i.wipFinish || 0), 0);
                  const totalOutPacking = itemsList.reduce((s, i) => s + (i.outPacking || 0), 0);

                  return (
                    <div key={lineId} className="space-y-3 border border-slate-400 p-4 rounded-lg bg-white">
                      {/* Line Header */}
                      <div className="flex items-center justify-between bg-yellow-200/60 px-3 py-1.5 border border-yellow-400 rounded">
                        <span className="font-black text-slate-900 tracking-wider text-sm">
                          WIP LINE {lineId.toUpperCase()}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-700">
                          TANGGAL : {targetDate}
                        </span>
                      </div>

                      {/* Data Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-slate-400 text-[10px] font-mono">
                          <thead>
                            <tr className="bg-slate-200 text-slate-900 font-bold text-center">
                              <th className="border border-slate-400 p-1.5">LINE</th>
                              <th className="border border-slate-400 p-1.5">SPO</th>
                              <th className="border border-slate-400 p-1.5">STYLE</th>
                              <th className="border border-slate-400 p-1.5">COLOR</th>
                              <th className="border border-slate-400 p-1.5">SIZE</th>
                              <th className="border border-slate-400 p-1.5">QTY ORDER</th>
                              <th className="border border-slate-400 p-1.5">UNIT</th>
                              <th className="border border-slate-400 p-1.5 bg-blue-100">IN HARI</th>
                              <th className="border border-slate-400 p-1.5">WIP0</th>
                              <th className="border border-slate-400 p-1.5">WIP1</th>
                              <th className="border border-slate-400 p-1.5">WIP2</th>
                              <th className="border border-slate-400 p-1.5">WIP3</th>
                              <th className="border border-slate-400 p-1.5">WIP4</th>
                              <th className="border border-slate-400 p-1.5">WIP5</th>
                              <th className="border border-slate-400 p-1.5 bg-slate-300">WIP SEWIN</th>
                              <th className="border border-slate-400 p-1.5 bg-emerald-100">OUT SEW</th>
                              <th className="border border-slate-400 p-1.5">CHK 10</th>
                              <th className="border border-slate-400 p-1.5 bg-amber-100">WIP FIN</th>
                              <th className="border border-slate-400 p-1.5 bg-blue-50">OUT PACK</th>
                              <th className="border border-slate-400 p-1.5">CHECK</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemsList.map((item, idx) => {
                              const scanIn = item.inHariIni || 0;
                              const wSum = (item.wip0 || 0) + (item.wip1 || 0) + (item.wip2 || 0) + (item.wip3 || 0) + (item.wip4 || 0) + (item.wip5 || 0);
                              const wSew = wSum > 0 ? wSum : (item.wipSewing || 0);
                              const outS = item.outSewing || 0;
                              const chk = item.chk3d || 0;
                              const chkVal = scanIn - (wSew + outS);

                              return (
                                <tr key={`pdf-item-${item.id || idx}-${idx}`} className="text-center hover:bg-slate-50">
                                  <td className="border border-slate-300 p-1 font-bold">{lineId.toUpperCase()}</td>
                                  <td className="border border-slate-300 p-1 text-blue-700 font-bold">{item.spo}</td>
                                  <td className="border border-slate-300 p-1 text-left truncate max-w-[140px]">{item.style}</td>
                                  <td className="border border-slate-300 p-1 text-left truncate max-w-[90px]">{item.color}</td>
                                  <td className="border border-slate-300 p-1 font-bold">{item.size}</td>
                                  <td className="border border-slate-300 p-1 text-right">{item.qtyOrder?.toLocaleString()}</td>
                                  <td className="border border-slate-300 p-1">{item.unit}</td>
                                  <td className="border border-slate-300 p-1 bg-blue-50 font-bold">{item.inHariIni || '-'}</td>
                                  <td className="border border-slate-300 p-1">{item.wip0 || '-'}</td>
                                  <td className="border border-slate-300 p-1">{item.wip1 || '-'}</td>
                                  <td className="border border-slate-300 p-1">{item.wip2 || '-'}</td>
                                  <td className="border border-slate-300 p-1">{item.wip3 || '-'}</td>
                                  <td className="border border-slate-300 p-1">{item.wip4 || '-'}</td>
                                  <td className="border border-slate-300 p-1">{item.wip5 || '-'}</td>
                                  <td className="border border-slate-300 p-1 bg-slate-100 font-bold">{wSew}</td>
                                  <td className="border border-slate-300 p-1 bg-emerald-50 text-emerald-800 font-bold">{item.outSewing || '-'}</td>
                                  <td className="border border-slate-300 p-1">{chk || '-'}</td>
                                  <td className="border border-slate-300 p-1 bg-amber-50">{item.wipFinish || '-'}</td>
                                  <td className="border border-slate-300 p-1 bg-blue-50/50">{item.outPacking || '-'}</td>
                                  <td className="border border-slate-300 p-1 font-bold">{chkVal}</td>
                                </tr>
                              );
                            })}

                            {/* TOTAL ROW */}
                            <tr className="bg-slate-200 font-black text-center text-slate-900">
                              <td colSpan={5} className="border border-slate-400 p-1 text-right">TOTAL:</td>
                              <td className="border border-slate-400 p-1 text-right">{totalQty.toLocaleString()}</td>
                              <td className="border border-slate-400 p-1">PCE</td>
                              <td className="border border-slate-400 p-1">{totalInHariIni}</td>
                              <td className="border border-slate-400 p-1">{totalWip0}</td>
                              <td className="border border-slate-400 p-1">{totalWip1}</td>
                              <td className="border border-slate-400 p-1">{totalWip2}</td>
                              <td className="border border-slate-400 p-1">{totalWip3}</td>
                              <td className="border border-slate-400 p-1">{totalWip4}</td>
                              <td className="border border-slate-400 p-1">{totalWip5}</td>
                              <td className="border border-slate-400 p-1">{totalWipSewing}</td>
                              <td className="border border-slate-400 p-1">{totalOutSewing}</td>
                              <td className="border border-slate-400 p-1">-</td>
                              <td className="border border-slate-400 p-1">{totalWipFinish}</td>
                              <td className="border border-slate-400 p-1">{totalOutPacking}</td>
                              <td className="border border-slate-400 p-1">-</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* NOTE / MANPOWER SUMMARY BLOCK (As in Screenshot) */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono bg-slate-50 p-3 rounded border border-slate-300">
                        <div className="bg-white p-2 border border-slate-200 rounded">
                          <span className="font-bold text-slate-500 block">JAM KERJA NORMAL:</span>
                          <span className="font-bold text-blue-800">{mp.normalHours} Jam</span>
                        </div>
                        <div className="bg-white p-2 border border-slate-200 rounded">
                          <span className="font-bold text-slate-500 block">MP NORMAL:</span>
                          <span className="font-bold text-blue-800">{mp.normalMp} Orang</span>
                        </div>
                        <div className="bg-white p-2 border border-slate-200 rounded">
                          <span className="font-bold text-slate-500 block">JAM LEMBUR:</span>
                          <span className="font-bold text-purple-800">{mp.overtimeHours} Jam</span>
                        </div>
                        <div className="bg-white p-2 border border-slate-200 rounded">
                          <span className="font-bold text-slate-500 block">MP LEMBUR:</span>
                          <span className="font-bold text-purple-800">{mp.overtimeMp} Orang</span>
                        </div>
                        <div className="bg-white p-2 border border-slate-200 rounded col-span-2">
                          <span className="font-bold text-slate-500 block">TOTAL JAM & STATUS:</span>
                          <span className="font-bold text-indigo-900">
                            {dev.totalHours} Jam ({dev.isDeviation ? '⚠️ PENYIMPANGAN' : '✓ NORMAL'})
                          </span>
                        </div>
                        <div className="bg-white p-2 border border-slate-200 rounded col-span-2">
                          <span className="font-bold text-slate-500 block">WIP SEWING TOTAL:</span>
                          <span className="font-bold text-slate-900">{totalWipSewing} Pcs</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-100 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl transition"
          >
            Batal
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isGenerating || linesToRender.length === 0}
            className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg transition disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Membuat PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Cetak / Simpan PDF (Print)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
