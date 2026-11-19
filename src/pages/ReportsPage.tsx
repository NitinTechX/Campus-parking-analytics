import React, { useMemo, useState } from 'react';
import { Download, FileBarChart2, FileSpreadsheet, FileText } from 'lucide-react';
import type {
  CleaningReport,
  ParkingRecord,
  ReportType,
  ThresholdConfig,
} from '../types/parking';
import {
  buildStructuredReport,
  exportReportCsv,
  exportReportExcel,
  exportReportPdf,
  type LiveReportOverrides,
} from '../utils/reportGenerator';

interface ReportsPageProps {
  records: ParkingRecord[];
  cleaningReport: CleaningReport;
  thresholds: ThresholdConfig;
  isSimulated: boolean;
  liveOverrides?: LiveReportOverrides;
  onLogActivity: (action: string, details: string) => void;
}

const REPORT_TYPES: Array<{ id: ReportType; label: string; desc: string }> = [
  {
    id: 'detailed',
    label: 'Detailed Activity Log',
    desc: 'Date, time, location, vehicle count & occupancy %',
  },
  { id: 'location', label: 'Location-Wise Report', desc: 'Capacity, availability & status per zone' },
  { id: 'daily', label: 'Daily Parking Report', desc: 'Date-by-date average occupancy & volume' },
  { id: 'weekly', label: 'Weekly Parking Report', desc: 'Monday through Sunday demand breakdown' },
  { id: 'monthly', label: 'Monthly Parking Report', desc: 'Month-level utilization aggregation' },
  { id: 'vehicle', label: 'Vehicle-Wise Report', desc: 'Volume share across vehicle categories' },
  { id: 'occupancy', label: 'Occupancy Analysis Report', desc: 'Hourly utilization profile & findings' },
];

export function ReportsPage({
  records,
  cleaningReport,
  thresholds,
  isSimulated,
  liveOverrides,
  onLogActivity,
}: ReportsPageProps) {
  const [reportType, setReportType] = useState<ReportType>('detailed');

  const payload = useMemo(
    () =>
      buildStructuredReport(
        reportType,
        records,
        cleaningReport,
        thresholds,
        isSimulated,
        liveOverrides
      ),
    [reportType, records, cleaningReport, thresholds, isSimulated, liveOverrides]
  );

  const canExport = payload.rows.length > 0 || liveOverrides?.dataMode === 'live';
  const filePrefix = `campus_parking_${reportType}_report`;

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (!canExport) return;
    if (format === 'csv') exportReportCsv(payload, filePrefix);
    else if (format === 'excel') exportReportExcel(payload, filePrefix);
    else exportReportPdf(payload, filePrefix);
    onLogActivity('Report Exported', `Generated ${payload.title} in ${format.toUpperCase()} format.`);
  };

  return (
    <div className="space-y-6">
      {/* Report Type Selector */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <FileBarChart2 className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <span>Select Report Template</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canExport}
              onClick={() => handleExport('csv')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-100 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              disabled={!canExport}
              onClick={() => handleExport('excel')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Excel (.xlsx)
            </button>
            <button
              type="button"
              disabled={!canExport}
              onClick={() => handleExport('pdf')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Export PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPORT_TYPES.map((rt) => {
            const active = reportType === rt.id;
            return (
              <button
                key={rt.id}
                type="button"
                onClick={() => setReportType(rt.id)}
                className={`text-left p-3.5 rounded-xl border transition-colors ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-600/15 border-blue-500 text-slate-900 dark:text-white'
                    : 'bg-slate-50 dark:bg-[#0D1628] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                }`}
              >
                <div className="text-xs font-semibold">{rt.label}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{rt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Report Preview */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-6 space-y-5 shadow-sm dark:shadow-none">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{payload.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Date Range: {payload.dateRange} · {payload.subtitle}
            </p>
          </div>
          <span className="text-xs font-mono-num text-blue-600 dark:text-cyan-300 font-semibold">
            {payload.kpis.recordCount.toLocaleString()} records included
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800">
            <div className="text-slate-500 dark:text-slate-400">Avg Occupancy</div>
            <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {payload.kpis.avgOccupancyPct.toFixed(1)}%
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800">
            <div className="text-slate-500 dark:text-slate-400">Peak Hour</div>
            <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {payload.kpis.peakHourLabel}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800">
            <div className="text-slate-500 dark:text-slate-400">Available Bays</div>
            <div className="font-mono-num text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {payload.kpis.availableSpaces.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800">
            <div className="text-slate-500 dark:text-slate-400">Efficiency Score</div>
            <div className="font-mono-num text-base font-bold text-blue-600 dark:text-cyan-300 mt-0.5">
              {payload.kpis.parkingEfficiencyScore}/100
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                {payload.headers.map((h) => (
                  <th key={h} className="py-2.5 px-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
              {payload.rows.length === 0 ? (
                <tr>
                  <td colSpan={payload.headers.length} className="py-6 text-center text-slate-400">
                    No data rows for current filters.
                  </td>
                </tr>
              ) : (
                payload.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`py-2.5 px-3 ${
                          typeof cell === 'number'
                            ? 'font-mono-num text-slate-700 dark:text-slate-200'
                            : 'text-slate-900 dark:text-slate-100 font-medium'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Key Findings Included in Export
          </h4>
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400 list-disc pl-5">
            {payload.findings.map((f, idx) => (
              <li key={idx}>{f}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
