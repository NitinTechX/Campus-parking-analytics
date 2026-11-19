import React, { useMemo, useState } from 'react';
import { AlertOctagon, AlertTriangle, Check, CheckCheck, Clock, Info } from 'lucide-react';
import type { AlertSeverity, SmartAlert, ThresholdConfig } from '../types/parking';

interface AlertsPageProps {
  alerts: SmartAlert[];
  readAlertIds: string[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: (ids: string[]) => void;
  thresholds: ThresholdConfig;
}

export function AlertsPage({
  alerts,
  readAlertIds,
  onMarkRead,
  onMarkAllRead,
  thresholds,
}: AlertsPageProps) {
  const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');

  const readSet = useMemo(() => new Set(readAlertIds), [readAlertIds]);
  const locations = useMemo(
    () => Array.from(new Set(alerts.map((a) => a.location))).sort(),
    [alerts]
  );

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
      if (locationFilter !== 'all' && a.location !== locationFilter) return false;
      if (dateFilter && a.date !== dateFilter) return false;
      const isRead = readSet.has(a.id);
      if (readFilter === 'unread' && isRead) return false;
      if (readFilter === 'read' && !isRead) return false;
      return true;
    });
  }, [alerts, severityFilter, locationFilter, dateFilter, readFilter, readSet]);

  const counts = useMemo(() => {
    return {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      high: alerts.filter((a) => a.severity === 'high').length,
      low: alerts.filter((a) => a.severity === 'low').length,
      unread: alerts.filter((a) => !readSet.has(a.id)).length,
    };
  }, [alerts, readSet]);

  const getIcon = (sev: AlertSeverity) => {
    if (sev === 'critical') return <AlertOctagon className="w-4 h-4 text-red-500 shrink-0" />;
    if (sev === 'high') return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    if (sev === 'peak') return <Clock className="w-4 h-4 text-cyan-500 shrink-0" />;
    return <Info className="w-4 h-4 text-emerald-500 shrink-0" />;
  };

  return (
    <div className="space-y-6">
      {/* Alert Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Critical (&ge;{thresholds.criticalPct}%)
          </div>
          <div className="text-2xl font-bold font-mono-num text-red-600 dark:text-red-400 mt-1">
            {counts.critical}
          </div>
        </div>
        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            High (&gt;{thresholds.highPct}%)
          </div>
          <div className="text-2xl font-bold font-mono-num text-amber-600 dark:text-amber-300 mt-1">
            {counts.high}
          </div>
        </div>
        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Low (&lt;{thresholds.lowPct}%)
          </div>
          <div className="text-2xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1">
            {counts.low}
          </div>
        </div>
        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Unread Alerts</div>
          <div className="text-2xl font-bold font-mono-num text-blue-600 dark:text-blue-400 mt-1">
            {counts.unread}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as 'all' | AlertSeverity)}
            className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical (&ge;{thresholds.criticalPct}%)</option>
            <option value="high">High (&gt;{thresholds.highPct}%)</option>
            <option value="peak">Peak Hour Warnings</option>
            <option value="low">Low (&lt;{thresholds.lowPct}%)</option>
          </select>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="all">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono-num text-slate-800 dark:text-slate-200"
          />

          <select
            value={readFilter}
            onChange={(e) => setReadFilter(e.target.value as 'all' | 'unread' | 'read')}
            className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="all">Read & Unread</option>
            <option value="unread">Unread Only</option>
            <option value="read">Read Only</option>
          </select>

          {(severityFilter !== 'all' ||
            locationFilter !== 'all' ||
            dateFilter !== '' ||
            readFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSeverityFilter('all');
                setLocationFilter('all');
                setDateFilter('');
                setReadFilter('all');
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2"
            >
              Clear Alert Filters
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onMarkAllRead(alerts.map((a) => a.id))}
          disabled={counts.unread === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          Mark All Read
        </button>
      </div>

      {/* Alert History List */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl divide-y divide-slate-200 dark:divide-slate-800/80">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No alerts match the selected criteria.
          </div>
        ) : (
          filtered.map((alert) => {
            const isRead = readSet.has(alert.id);
            return (
              <div
                key={alert.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isRead ? 'opacity-70' : 'bg-blue-50/40 dark:bg-blue-950/15'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getIcon(alert.severity)}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {alert.title}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {alert.location}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono-num text-slate-500 dark:text-slate-400">
                        {alert.date} {alert.time}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {alert.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono-num text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {alert.occupancyPct.toFixed(1)}%
                  </span>
                  {!isRead ? (
                    <button
                      type="button"
                      onClick={() => onMarkRead(alert.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Check className="w-3 h-3" />
                      Mark Read
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400">Read</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
