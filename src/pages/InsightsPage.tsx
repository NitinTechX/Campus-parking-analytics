import React from 'react';
import { AlertTriangle, CheckCircle2, Download, Lightbulb, TrendingUp } from 'lucide-react';
import type {
  CleaningReport,
  KpiMetrics,
  ParkingRecord,
  SmartAlert,
  ThresholdConfig,
} from '../types/parking';
import { buildAnalysisReport } from '../utils/analytics';

interface InsightsPageProps {
  records: ParkingRecord[];
  cleaningReport: CleaningReport;
  thresholds: ThresholdConfig;
  isSimulated: boolean;
  kpis: KpiMetrics;
  alerts: SmartAlert[];
  insights: string[];
  recommendations: string[];
}

export function InsightsPage({
  records,
  cleaningReport,
  thresholds,
  isSimulated,
  kpis,
  alerts,
  insights,
  recommendations,
}: InsightsPageProps) {
  const highZoneAlerts = alerts.filter(
    (a) => a.id.startsWith('crit-') || a.id.startsWith('high-')
  );
  const lowZoneAlerts = alerts.filter((a) => a.id.startsWith('low-'));

  const handleDownloadReport = () => {
    const md = buildAnalysisReport(records, cleaningReport, isSimulated, thresholds);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campus_parking_analysis_report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 shadow-sm dark:shadow-none">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Automated Analytical Insights &amp; Recommendations
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            Computed dynamically from {kpis.recordCount.toLocaleString()} filtered records · Efficiency Score{' '}
            {kpis.parkingEfficiencyScore}/100
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadReport}
          disabled={records.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          Download Markdown Summary
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-sky-400" />
            <span>Calculated Parking Insights</span>
          </div>
          <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            {insights.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 pb-3 border-b border-slate-200 dark:border-slate-800/70 last:border-b-0 last:pb-0"
              >
                <span className="font-mono-num text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
                  0{idx + 1}
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Lightbulb className="w-4 h-4 text-amber-500 dark:text-amber-300" />
            <span>Smart Campus Recommendations</span>
          </div>
          <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            {recommendations.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 pb-3 border-b border-slate-200 dark:border-slate-800/70 last:border-b-0 last:pb-0"
              >
                <span className="font-mono-num text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  R{idx + 1}
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Occupancy Threshold Audit (&gt;{thresholds.highPct}% High · &lt;{thresholds.lowPct}% Low)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Congestion Zones (&gt;{thresholds.highPct}%)
            </div>
            {highZoneAlerts.length > 0 ? (
              highZoneAlerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between text-xs bg-red-50 dark:bg-red-950/35 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200 rounded-lg px-3.5 py-2.5"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    {a.location}
                  </span>
                  <span className="font-mono-num">{a.occupancyPct.toFixed(1)}%</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-lg px-3.5 py-2.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                No locations exceed {thresholds.highPct}% occupancy.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Underutilized Zones (&lt;{thresholds.lowPct}%)
            </div>
            {lowZoneAlerts.length > 0 ? (
              lowZoneAlerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between text-xs bg-sky-50 dark:bg-sky-950/35 border border-sky-200 dark:border-sky-900/50 text-sky-800 dark:text-sky-200 rounded-lg px-3.5 py-2.5"
                >
                  <span className="font-medium">{a.location}</span>
                  <span className="font-mono-num">{a.occupancyPct.toFixed(1)}%</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3.5 py-2.5">
                No zones fall below {thresholds.lowPct}% average occupancy under current filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
