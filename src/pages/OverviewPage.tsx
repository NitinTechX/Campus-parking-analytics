import React from 'react';
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import {
  HourlyTrendLineChart,
  LocationOccupancyBarChart,
  OccupiedVsAvailablePieChart,
} from '../components/Charts';
import { KpiStrip } from '../components/KpiStrip';
import type {
  HourlyStat,
  KpiMetrics,
  LocationStat,
  PageId,
  SmartAlert,
  ThresholdConfig,
} from '../types/parking';

interface OverviewPageProps {
  kpis: KpiMetrics;
  locationStats: LocationStat[];
  hourlyStats: HourlyStat[];
  alerts: SmartAlert[];
  insights: string[];
  thresholds: ThresholdConfig;
  onNavigate: (page: PageId) => void;
}

export function OverviewPage({
  kpis,
  locationStats,
  hourlyStats,
  alerts,
  insights,
  thresholds,
  onNavigate,
}: OverviewPageProps) {
  const utilPct = Math.min(100, Math.max(0, kpis.avgOccupancyPct));
  const summaryAlerts = alerts.filter(
    (a) =>
      a.id.startsWith('crit-') ||
      a.id.startsWith('high-') ||
      a.id.startsWith('low-') ||
      a.id.startsWith('live-crit-') ||
      a.id.startsWith('live-high-')
  );

  return (
    <div className="space-y-6">
      <KpiStrip kpis={kpis} />

      {/* Utilization Indicator + Active Smart Alerts */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 shadow-sm dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Campus Parking Capacity Utilization &amp; Smart Alerts
          </h3>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono-num font-semibold text-blue-600 dark:text-cyan-300">
              {kpis.avgOccupancyPct.toFixed(1)}% ({kpis.occupiedSpaces.toLocaleString()} /{' '}
              {kpis.totalCapacity.toLocaleString()} bays)
            </span>
            <button
              type="button"
              onClick={() => onNavigate('alerts')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View All Alerts <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="w-full h-3 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
          <div
            className={`h-full transition-all duration-300 ${
              utilPct >= thresholds.criticalPct
                ? 'bg-red-600'
                : utilPct > thresholds.highPct
                  ? 'bg-amber-500'
                  : utilPct < thresholds.lowPct
                    ? 'bg-emerald-500'
                    : 'bg-blue-600'
            }`}
            style={{ width: `${utilPct}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {summaryAlerts.length > 0 ? (
            summaryAlerts.slice(0, 4).map((a) => (
              <div
                key={a.id}
                className={`flex items-start gap-2.5 text-xs rounded-lg px-3.5 py-2.5 border ${
                  a.severity === 'critical'
                    ? 'bg-red-50 dark:bg-red-950/35 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200'
                    : a.severity === 'high'
                      ? 'bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200'
                      : 'bg-sky-50 dark:bg-sky-950/35 border-sky-200 dark:border-sky-900/50 text-sky-800 dark:text-sky-200'
                }`}
              >
                {a.severity === 'critical' ? (
                  <AlertOctagon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                ) : a.severity === 'high' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                )}
                <span>
                  <strong className="font-semibold">{a.title}:</strong> {a.message}
                </span>
              </div>
            ))
          ) : (
            <div className="md:col-span-2 flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-200 rounded-lg px-3.5 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>All selected zones are within balanced threshold bounds ({thresholds.lowPct}%–{thresholds.highPct}%).</span>
            </div>
          )}
        </div>
      </div>

      {/* Primary Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7">
          <LocationOccupancyBarChart data={locationStats} />
        </div>
        <div className="xl:col-span-5">
          <OccupiedVsAvailablePieChart
            occupied={kpis.occupiedSpaces}
            available={kpis.availableSpaces}
          />
        </div>
      </div>

      {/* Hourly Trend + Key Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7">
          <HourlyTrendLineChart data={hourlyStats} />
        </div>
        <div className="xl:col-span-5 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Automated Dataset Insights
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('assistant')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Ask AI Assistant
            </button>
          </div>
          <ol className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
            {insights.map((text, idx) => (
              <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                <span className="font-mono-num text-xs font-semibold text-blue-600 dark:text-cyan-400 mt-1 shrink-0">
                  0{idx + 1}.
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
