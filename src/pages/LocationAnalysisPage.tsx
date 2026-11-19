import React from 'react';
import { CampusParkingMap } from '../components/CampusParkingMap';
import { CapacityVsOccupiedChart, LocationOccupancyBarChart } from '../components/Charts';
import type { LocationStat, ThresholdConfig, ZoneConfig } from '../types/parking';

interface LocationAnalysisPageProps {
  locationStats: LocationStat[];
  zones: ZoneConfig[];
  thresholds: ThresholdConfig;
  isSimulated: boolean;
  dataMode?: 'demo' | 'live';
}

export function LocationAnalysisPage({
  locationStats,
  zones,
  thresholds,
  isSimulated,
  dataMode = 'demo',
}: LocationAnalysisPageProps) {
  const availabilityRanked = [...locationStats].sort((a, b) => b.avgAvailable - a.avgAvailable);

  return (
    <div className="space-y-6">
      <CampusParkingMap
        zones={zones}
        locationStats={locationStats}
        thresholds={thresholds}
        isSimulated={isSimulated}
        dataMode={dataMode}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <LocationOccupancyBarChart data={locationStats} />
        <CapacityVsOccupiedChart data={locationStats} />
      </div>

      {/* Parking Availability Ranking */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Parking Availability Ranking &amp; Congestion Matrix
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Ranked from most open spaces to most congested
          </span>
        </div>

        {availabilityRanked.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No location data matches the active filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-3 font-medium">Rank</th>
                  <th className="py-2.5 px-3 font-medium">Parking Location</th>
                  <th className="py-2.5 px-3 text-right font-medium">Capacity</th>
                  <th className="py-2.5 px-3 text-right font-medium">Avg Occupied</th>
                  <th className="py-2.5 px-3 text-right font-medium">Avg Available</th>
                  <th className="py-2.5 px-3 text-right font-medium">Avg Occupancy</th>
                  <th className="py-2.5 px-3 text-right font-medium">Peak Occupancy</th>
                  <th className="py-2.5 px-3 font-medium">Utilization</th>
                  <th className="py-2.5 pl-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
                {availabilityRanked.map((loc, idx) => {
                  const statusTone =
                    loc.avgOccupancyPct >= thresholds.criticalPct || loc.avgOccupancyPct > thresholds.highPct
                      ? 'text-red-600 dark:text-red-400'
                      : loc.avgOccupancyPct < thresholds.lowPct
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-blue-600 dark:text-blue-300';
                  const barTone =
                    loc.avgOccupancyPct > thresholds.highPct
                      ? 'bg-red-500'
                      : loc.avgOccupancyPct < thresholds.lowPct
                        ? 'bg-emerald-500'
                        : 'bg-blue-500';
                  return (
                    <tr key={loc.location} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 pr-3 font-mono-num text-slate-500 dark:text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {loc.location}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-600 dark:text-slate-300">
                        {loc.totalCapacity}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-700 dark:text-slate-200">
                        {loc.avgOccupied.toFixed(1)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-semibold text-emerald-600 dark:text-emerald-400">
                        {loc.avgAvailable.toFixed(1)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                        {loc.avgOccupancyPct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-600 dark:text-slate-300">
                        {loc.peakOccupancyPct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 w-32">
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barTone}`}
                            style={{ width: `${Math.min(100, loc.avgOccupancyPct)}%` }}
                          />
                        </div>
                      </td>
                      <td className={`py-3 pl-3 font-medium whitespace-nowrap ${statusTone}`}>
                        {loc.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
