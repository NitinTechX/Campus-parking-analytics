import React from 'react';
import {
  CapacityVsOccupiedChart,
  DateTrendLineChart,
  DayHourHeatmapChart,
  VehicleDonutChart,
  WeekdayVsWeekendChart,
} from '../components/Charts';
import type {
  DateTrendStat,
  LocationStat,
  StatisticalSummaryRow,
  VehicleStat,
  WeekdayVsWeekendStat,
} from '../types/parking';

interface ParkingAnalyticsPageProps {
  locationStats: LocationStat[];
  vehicleStats: VehicleStat[];
  dateTrends: DateTrendStat[];
  weekdayVsWeekend: WeekdayVsWeekendStat[];
  heatmap: { days: string[]; hours: string[]; values: (number | null)[][] };
  statSummary: StatisticalSummaryRow[];
}

export function ParkingAnalyticsPage({
  locationStats,
  vehicleStats,
  dateTrends,
  weekdayVsWeekend,
  heatmap,
  statSummary,
}: ParkingAnalyticsPageProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7">
          <CapacityVsOccupiedChart data={locationStats} />
        </div>
        <div className="xl:col-span-5">
          <VehicleDonutChart data={vehicleStats} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7">
          <DateTrendLineChart data={dateTrends} />
        </div>
        <div className="xl:col-span-5">
          <WeekdayVsWeekendChart data={weekdayVsWeekend} />
        </div>
      </div>

      <DayHourHeatmapChart
        days={heatmap.days}
        hours={heatmap.hours}
        values={heatmap.values}
        title="Congestion & Hourly Demand Heatmap"
      />

      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Descriptive Statistical Summary
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Distribution metrics across filtered records
          </span>
        </div>

        {statSummary.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No records available for summary statistics.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Metric</th>
                  <th className="py-2.5 px-3 text-right font-medium">Count</th>
                  <th className="py-2.5 px-3 text-right font-medium">Mean</th>
                  <th className="py-2.5 px-3 text-right font-medium">Std Dev</th>
                  <th className="py-2.5 px-3 text-right font-medium">Min</th>
                  <th className="py-2.5 px-3 text-right font-medium">25%</th>
                  <th className="py-2.5 px-3 text-right font-medium">Median</th>
                  <th className="py-2.5 px-3 text-right font-medium">75%</th>
                  <th className="py-2.5 pl-3 text-right font-medium">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70 font-mono-num">
                {statSummary.map((row) => (
                  <tr key={row.metric} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 pr-4 font-sans font-medium text-slate-900 dark:text-slate-200">
                      {row.metric}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300">
                      {row.count}
                    </td>
                    <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-300">
                      {row.mean.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300">
                      {row.std.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300">
                      {row.min.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300">
                      {row.p25.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900 dark:text-slate-100 font-semibold">
                      {row.median.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300">
                      {row.p75.toFixed(2)}
                    </td>
                    <td className="py-2.5 pl-3 text-right text-slate-600 dark:text-slate-300">
                      {row.max.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
