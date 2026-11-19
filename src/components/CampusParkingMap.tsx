import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import type { LocationStat, ThresholdConfig, ZoneConfig } from '../types/parking';

interface CampusParkingMapProps {
  zones: ZoneConfig[];
  locationStats: LocationStat[];
  thresholds: ThresholdConfig;
  isSimulated: boolean;
  dataMode?: 'demo' | 'live';
}

export function CampusParkingMap({
  zones,
  locationStats,
  thresholds,
  isSimulated,
  dataMode = 'demo',
}: CampusParkingMapProps) {
  const activeZones = zones.filter((z) => z.active);
  const statMap = new Map<string, LocationStat>();
  locationStats.forEach((s) => statMap.set(s.location, s));

  const [selectedName, setSelectedName] = useState<string>(
    activeZones[0]?.name ?? locationStats[0]?.location ?? ''
  );

  // Merge zones registered in admin with any extra locations present in uploaded CSVs
  const mappedNodes = activeZones.map((z) => ({
    name: z.name,
    code: z.code,
    category: z.category,
    mapX: z.mapX,
    mapY: z.mapY,
    capacity: statMap.get(z.name)?.totalCapacity ?? z.capacity,
    stat: statMap.get(z.name) ?? null,
  }));

  let extraIdx = 0;
  for (const s of locationStats) {
    if (!mappedNodes.some((n) => n.name === s.location)) {
      mappedNodes.push({
        name: s.location,
        code: `CSV-${extraIdx + 1}`,
        category: 'Academic',
        mapX: 18 + ((extraIdx * 23) % 66),
        mapY: 48 + ((extraIdx * 15) % 30),
        capacity: s.totalCapacity,
        stat: s,
      });
      extraIdx += 1;
    }
  }

  const selectedNode =
    mappedNodes.find((n) => n.name === selectedName) ?? mappedNodes[0] ?? null;

  const getTone = (pct: number | null) => {
    if (pct === null) {
      return {
        ring: 'border-slate-400 dark:border-slate-600',
        dot: 'bg-slate-400',
        badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
        label: 'No filtered records',
      };
    }
    if (pct > thresholds.highPct) {
      return {
        ring: 'border-red-500/80',
        dot: 'bg-red-500',
        badge: 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60',
        label: pct >= thresholds.criticalPct ? 'Critical (>95%)' : `High (>${thresholds.highPct}%)`,
      };
    }
    if (pct >= thresholds.lowPct) {
      return {
        ring: 'border-amber-500/80',
        dot: 'bg-amber-400',
        badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60',
        label: 'Moderate',
      };
    }
    return {
      ring: 'border-emerald-500/80',
      dot: 'bg-emerald-500',
      badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60',
      label: `Low (<${thresholds.lowPct}%)`,
    };
  };

  return (
    <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Interactive Campus Parking Map (Illustrative Schematic)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {dataMode === 'live'
              ? 'Schematic zone map driven by persisted live database vehicle records.'
              : isSimulated
                ? 'Schematic zone map driven by simulated dataset values — not live GPS or IoT bay sensors.'
                : 'Schematic zone map driven by your uploaded CSV dataset — not live GPS or IoT bay sensors.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Low (&lt;{thresholds.lowPct}%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            Moderate ({thresholds.lowPct}–{thresholds.highPct}%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            High (&gt;{thresholds.highPct}%)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Schematic Interactive Canvas */}
        <div className="xl:col-span-8 relative min-h-[340px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A1324] overflow-hidden">
          {/* Illustrative Campus Roadway & Building Footprint SVG */}
          <svg
            viewBox="0 0 800 420"
            className="w-full h-full absolute inset-0 pointer-events-none opacity-65 dark:opacity-50"
            preserveAspectRatio="none"
          >
            {/* Campus Perimeter Road */}
            <rect
              x="36"
              y="32"
              width="728"
              height="356"
              rx="22"
              fill="none"
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
              strokeWidth="10"
            />
            {/* Cross Campus Spine Road */}
            <line
              x1="400"
              y1="32"
              x2="400"
              y2="388"
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
              strokeWidth="8"
            />
            <line
              x1="36"
              y1="210"
              x2="764"
              y2="210"
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
              strokeWidth="8"
            />
            {/* Central Quad Green */}
            <rect
              x="310"
              y="150"
              width="180"
              height="120"
              rx="14"
              fill="currentColor"
              className="text-emerald-100/70 dark:text-emerald-950/35"
            />
            <text
              x="400"
              y="214"
              textAnchor="middle"
              className="fill-slate-500 dark:fill-slate-400 text-[12px] font-medium"
            >
              Central Academic Quad
            </text>
          </svg>

          {mappedNodes.map((node) => {
            const pct = node.stat ? node.stat.avgOccupancyPct : null;
            const tone = getTone(pct);
            const isSelected = selectedNode?.name === node.name;
            const avail = node.stat ? Math.round(node.stat.avgAvailable) : node.capacity;

            return (
              <button
                key={node.name}
                type="button"
                onClick={() => setSelectedName(node.name)}
                style={{ left: `${node.mapX}%`, top: `${node.mapY}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 text-left rounded-xl px-3 py-2 bg-white/95 dark:bg-[#131F36]/95 border-2 transition-all duration-150 shadow-md min-w-[136px] max-w-[170px] cursor-pointer ${
                  tone.ring
                } ${isSelected ? 'ring-2 ring-blue-500 scale-105 z-10' : 'hover:scale-102'}`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {node.name.replace(' Parking', '')}
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tone.dot}`} />
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-1 font-mono-num text-[11px]">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {avail}/{node.capacity} free
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Zone Inspector Card */}
        <div className="xl:col-span-4 bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>
                      {selectedNode.code} · {selectedNode.category}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {selectedNode.name}
                  </h4>
                </div>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${
                    getTone(selectedNode.stat?.avgOccupancyPct ?? null).badge
                  }`}
                >
                  {getTone(selectedNode.stat?.avgOccupancyPct ?? null).label}
                </span>
              </div>

              {selectedNode.stat ? (
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Total Capacity</span>
                    <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                      {selectedNode.stat.totalCapacity} bays
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Avg Occupied</span>
                    <span className="font-mono-num font-semibold text-blue-600 dark:text-blue-400">
                      {selectedNode.stat.avgOccupied.toFixed(1)} bays
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Avg Available</span>
                    <span className="font-mono-num font-semibold text-emerald-600 dark:text-emerald-400">
                      {selectedNode.stat.avgAvailable.toFixed(1)} bays
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Average Occupancy</span>
                    <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                      {selectedNode.stat.avgOccupancyPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Peak Occupancy</span>
                    <span className="font-mono-num font-semibold text-red-600 dark:text-red-400">
                      {selectedNode.stat.peakOccupancyPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500 dark:text-slate-400">
                      Congestion Frequency (&gt;{thresholds.highPct}%)
                    </span>
                    <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                      {selectedNode.stat.congestionFreqPct.toFixed(1)}% of windows
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No records match this zone under the active filters. Capacity configured:{' '}
                  {selectedNode.capacity} bays.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a parking zone on the schematic map to inspect detailed statistics.
            </p>
          )}

          <div className="pt-3 mt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            Click any zone marker on the map to inspect capacity, availability, and peak congestion.
          </div>
        </div>
      </div>
    </div>
  );
}
