import React from 'react';
import type { KpiMetrics } from '../types/parking';

export function KpiStrip({ kpis }: { kpis: KpiMetrics }) {
  const items = [
    {
      label: 'Total Parking Capacity',
      value: kpis.totalCapacity.toLocaleString(),
      detail: 'Active physical bays',
      accent: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Currently Occupied Spaces',
      value: kpis.occupiedSpaces.toLocaleString(),
      detail: 'Avg occupied in selection',
      accent: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Available Parking Spaces',
      value: kpis.availableSpaces.toLocaleString(),
      detail: 'Open capacity remaining',
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Average Occupancy Rate',
      value: `${kpis.avgOccupancyPct.toFixed(1)}%`,
      detail: `${kpis.recordCount.toLocaleString()} matching records`,
      accent:
        kpis.avgOccupancyPct > 80
          ? 'text-red-600 dark:text-red-400'
          : kpis.avgOccupancyPct < 30
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-sky-600 dark:text-sky-400',
    },
    {
      label: 'Peak Parking Hours',
      value: kpis.peakHourLabel,
      detail: `${kpis.peakHourOccupancy.toFixed(1)}% peak load`,
      accent: 'text-amber-600 dark:text-amber-300',
    },
    {
      label: 'Most Crowded Location',
      value: kpis.mostCrowdedLocation.replace(' Parking', ''),
      detail: `${kpis.mostCrowdedOccupancy.toFixed(1)}% average occupancy`,
      accent: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Total Vehicles Recorded',
      value: kpis.totalVehiclesRecorded.toLocaleString(),
      detail: 'Cumulative parked entries',
      accent: 'text-cyan-700 dark:text-cyan-300',
    },
    {
      label: 'Parking Efficiency Score',
      value: `${kpis.parkingEfficiencyScore.toFixed(1)}/100`,
      detail: 'Balance & congestion index',
      accent:
        kpis.parkingEfficiencyScore >= 75
          ? 'text-emerald-600 dark:text-emerald-400'
          : kpis.parkingEfficiencyScore >= 55
            ? 'text-amber-600 dark:text-amber-300'
            : 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white dark:bg-gradient-to-br dark:from-[#111C31] dark:to-[#0E1729] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 shadow-sm dark:shadow-none transition-transform duration-150 hover:-translate-y-0.5 flex flex-col justify-between"
        >
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            {item.label}
          </span>
          <div className={`text-2xl font-bold font-mono-num mt-2 truncate ${item.accent}`}>
            {item.value}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 truncate">
            {item.detail}
          </span>
        </div>
      ))}
    </div>
  );
}
