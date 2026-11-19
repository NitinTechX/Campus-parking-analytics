import React, { useEffect, useState } from 'react';
import { GitCompare } from 'lucide-react';
import { CapacityVsOccupiedChart, LocationOccupancyBarChart } from '../components/Charts';
import type { LocationStat } from '../types/parking';

export function LocationComparisonPage({ locationStats }: { locationStats: LocationStat[] }) {
  const [selected, setSelected] = useState<string[]>(() =>
    locationStats.slice(0, Math.min(3, locationStats.length)).map((l) => l.location)
  );

  useEffect(() => {
    setSelected((prev) => {
      const valid = prev.filter((name) => locationStats.some((l) => l.location === name));
      if (valid.length >= 2) return valid;
      return locationStats.slice(0, Math.min(2, locationStats.length)).map((l) => l.location);
    });
  }, [locationStats]);

  const toggleLocation = (loc: string) => {
    setSelected((prev) => {
      if (prev.includes(loc)) {
        if (prev.length <= 2) return prev; // keep at least 2 when available
        return prev.filter((x) => x !== loc);
      }
      return [...prev, loc];
    });
  };

  const compared = locationStats.filter((l) => selected.includes(l.location));
  const mostCrowded = compared[0];
  const mostAvailable = [...compared].sort((a, b) => b.avgAvailable - a.avgAvailable)[0];

  return (
    <div className="space-y-6">
      {/* Selector Bar */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-3 shadow-sm dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <GitCompare className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <span>Select Two or More Locations to Compare</span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {compared.length} of {locationStats.length} zones selected
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {locationStats.map((loc) => {
            const active = selected.includes(loc.location);
            return (
              <button
                key={loc.location}
                type="button"
                onClick={() => toggleLocation(loc.location)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-[#0D1628] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-500'
                }`}
              >
                {loc.location}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <LocationOccupancyBarChart data={compared} />
        <CapacityVsOccupiedChart data={compared} />
      </div>

      {/* Comparison Table & Summary */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Side-by-Side Location Metrics
        </h3>

        {compared.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No locations available under current filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Location</th>
                  <th className="py-2.5 px-3 text-right font-medium">Total Capacity</th>
                  <th className="py-2.5 px-3 text-right font-medium">Avg Occupied</th>
                  <th className="py-2.5 px-3 text-right font-medium">Available Spaces</th>
                  <th className="py-2.5 px-3 text-right font-medium">Avg Occupancy %</th>
                  <th className="py-2.5 px-3 text-right font-medium">Peak Occupancy %</th>
                  <th className="py-2.5 pl-3 text-right font-medium">Congestion Freq</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
                {compared.map((loc) => (
                  <tr key={loc.location} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {loc.location}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-slate-600 dark:text-slate-300">
                      {loc.totalCapacity}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-blue-600 dark:text-blue-400">
                      {loc.avgOccupied.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-emerald-600 dark:text-emerald-400">
                      {loc.avgAvailable.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-white">
                      {loc.avgOccupancyPct.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-slate-700 dark:text-slate-300">
                      {loc.peakOccupancyPct.toFixed(1)}%
                    </td>
                    <td className="py-3 pl-3 text-right font-mono-num text-red-600 dark:text-red-400">
                      {loc.congestionFreqPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mostCrowded && mostAvailable && compared.length >= 2 && (
          <div className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <strong className="text-slate-900 dark:text-white">Comparison Summary:</strong> Among
            the selected zones, <strong>{mostCrowded.location}</strong> experiences the highest load
            at <strong>{mostCrowded.avgOccupancyPct.toFixed(1)}%</strong> average occupancy (peak{' '}
            {mostCrowded.peakOccupancyPct.toFixed(1)}%, congested{' '}
            {mostCrowded.congestionFreqPct.toFixed(1)}% of intervals), whereas{' '}
            <strong>{mostAvailable.location}</strong> provides the greatest spare capacity with an
            average of <strong>{mostAvailable.avgAvailable.toFixed(1)} available bays</strong> (
            {mostAvailable.avgOccupancyPct.toFixed(1)}% occupied). That is a{' '}
            <strong>
              {(mostCrowded.avgOccupancyPct - mostAvailable.avgOccupancyPct).toFixed(1)} percentage
              point
            </strong>{' '}
            utilization spread.
          </div>
        )}
      </div>
    </div>
  );
}
