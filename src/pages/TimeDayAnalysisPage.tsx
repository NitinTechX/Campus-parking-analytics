import React from 'react';
import {
  DayHourHeatmapChart,
  HourlyTrendLineChart,
  WeekdayBarChart,
  WeekdayVsWeekendChart,
} from '../components/Charts';
import type { DayStat, HourlyStat, WeekdayVsWeekendStat } from '../types/parking';

interface TimeDayAnalysisPageProps {
  hourlyStats: HourlyStat[];
  dayStats: DayStat[];
  weekdayVsWeekend: WeekdayVsWeekendStat[];
  heatmap: {
    days: string[];
    hours: string[];
    values: (number | null)[][];
  };
}

export function TimeDayAnalysisPage({
  hourlyStats,
  dayStats,
  weekdayVsWeekend,
  heatmap,
}: TimeDayAnalysisPageProps) {
  const topHours = [...hourlyStats]
    .sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct)
    .slice(0, 3);
  const sortedDays = [...dayStats].sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct);
  const busiestDay = sortedDays[0];
  const quietestDay = sortedDays[sortedDays.length - 1];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 shadow-sm dark:shadow-none">
          <div className="text-xs text-slate-500 dark:text-slate-400">Top Peak Hours</div>
          <div className="text-sm font-semibold font-mono-num text-amber-600 dark:text-amber-300 mt-1.5">
            {topHours.length > 0
              ? topHours.map((h) => `${h.timeLabel} (${h.avgOccupancyPct.toFixed(1)}%)`).join(' · ')
              : 'N/A'}
          </div>
        </div>
        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 shadow-sm dark:shadow-none">
          <div className="text-xs text-slate-500 dark:text-slate-400">Busiest Day of Week</div>
          <div className="text-sm font-semibold text-blue-600 dark:text-blue-300 mt-1.5 tabular-nums">
            {busiestDay
              ? `${busiestDay.day} · ${busiestDay.avgOccupancyPct.toFixed(1)}% avg occupancy`
              : 'N/A'}
          </div>
        </div>
        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 shadow-sm dark:shadow-none">
          <div className="text-xs text-slate-500 dark:text-slate-400">Quietest Day of Week</div>
          <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-300 mt-1.5 tabular-nums">
            {quietestDay
              ? `${quietestDay.day} · ${quietestDay.avgOccupancyPct.toFixed(1)}% avg occupancy`
              : 'N/A'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <HourlyTrendLineChart data={hourlyStats} />
        <WeekdayBarChart data={dayStats} />
      </div>

      <WeekdayVsWeekendChart data={weekdayVsWeekend} />

      <DayHourHeatmapChart
        days={heatmap.days}
        hours={heatmap.hours}
        values={heatmap.values}
        title="Hourly Demand & Day-of-Week Heatmap"
      />
    </div>
  );
}
