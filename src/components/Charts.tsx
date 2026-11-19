import React, { useState } from 'react';
import type {
  DateTrendStat,
  DayStat,
  HourlyStat,
  LocationStat,
  PredictionPoint,
  VehicleStat,
  WeekdayVsWeekendStat,
} from '../types/parking';

const CHART_CARD =
  'bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 shadow-sm dark:shadow-none';

function EmptyChart({ title }: { title: string }) {
  return (
    <div className={CHART_CARD}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-4">{title}</h3>
      <div className="h-56 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-lg">
        No matching records for the active filters.
      </div>
    </div>
  );
}

export function LocationOccupancyBarChart({ data }: { data: LocationStat[] }) {
  const [hovered, setHovered] = useState<LocationStat | null>(null);
  if (data.length === 0) return <EmptyChart title="Parking Occupancy by Location" />;

  const width = 620;
  const height = 270;
  const padL = 44;
  const padR = 16;
  const padT = 24;
  const padB = 56;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const barStep = innerW / data.length;
  const barW = Math.min(48, barStep * 0.56);

  const yPos = (pct: number) => padT + innerH * (1 - Math.min(100, Math.max(0, pct)) / 100);

  return (
    <div className={`${CHART_CARD} relative`}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Average Parking Occupancy by Location
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {hovered
            ? `${hovered.location}: ${hovered.avgOccupancyPct.toFixed(1)}% (Peak ${hovered.peakOccupancyPct.toFixed(1)}%)`
            : '80% high alert · 30% low threshold'}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = yPos(tick);
          return (
            <g key={tick}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="rgba(148,163,184,0.22)" />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono-num"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        <line
          x1={padL}
          x2={width - padR}
          y1={yPos(80)}
          y2={yPos(80)}
          stroke="#EF4444"
          strokeDasharray="4 4"
          strokeWidth={1.25}
        />
        <line
          x1={padL}
          x2={width - padR}
          y1={yPos(30)}
          y2={yPos(30)}
          stroke="#10B981"
          strokeDasharray="3 3"
          strokeWidth={1.1}
        />

        {data.map((d, i) => {
          const x = padL + i * barStep + (barStep - barW) / 2;
          const y = yPos(d.avgOccupancyPct);
          const barH = padT + innerH - y;
          const color =
            d.avgOccupancyPct > 80 ? '#EF4444' : d.avgOccupancyPct < 30 ? '#10B981' : '#3B82F6';
          const shortName = d.location.replace(' Parking', '');
          return (
            <g
              key={d.location}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, barH)}
                rx={4}
                fill={color}
                opacity={hovered && hovered.location !== d.location ? 0.55 : 0.95}
                className="transition-opacity duration-150"
              />
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-slate-700 dark:fill-slate-200 text-[10px] font-mono-num font-medium"
              >
                {d.avgOccupancyPct.toFixed(1)}%
              </text>
              <text
                x={x + barW / 2}
                y={padT + innerH + 16}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 text-[10px]"
              >
                {shortName.length > 13 ? `${shortName.slice(0, 12)}…` : shortName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function HourlyTrendLineChart({ data }: { data: HourlyStat[] }) {
  const [hovered, setHovered] = useState<HourlyStat | null>(null);
  if (data.length === 0) return <EmptyChart title="Hourly Parking Usage Trends" />;

  const width = 620;
  const height = 260;
  const padL = 44;
  const padR = 20;
  const padT = 20;
  const padB = 38;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const getX = (idx: number) =>
    data.length === 1 ? padL + innerW / 2 : padL + (idx / (data.length - 1)) * innerW;
  const getY = (pct: number) => padT + innerH * (1 - Math.min(100, Math.max(0, pct)) / 100);

  const linePoints = data.map((d, i) => `${getX(i)},${getY(d.avgOccupancyPct)}`).join(' ');
  const areaPath =
    data.length > 0
      ? `M ${getX(0)},${padT + innerH} L ${data
          .map((d, i) => `${getX(i)},${getY(d.avgOccupancyPct)}`)
          .join(' L ')} L ${getX(data.length - 1)},${padT + innerH} Z`
      : '';

  return (
    <div className={CHART_CARD}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Hourly Parking Usage Trends
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {hovered
            ? `${hovered.timeLabel} · ${hovered.avgOccupancyPct.toFixed(1)}% avg (${hovered.avgOccupied.toFixed(0)} spaces)`
            : 'Average occupancy across active hours'}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="hourlyAreaGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 25, 50, 75, 100].map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="rgba(148,163,184,0.22)" />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono-num"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill="url(#hourlyAreaGrad)" />}
        {data.length > 1 && (
          <polyline
            fill="none"
            stroke="#0EA5E9"
            strokeWidth={2.5}
            strokeLinejoin="round"
            points={linePoints}
          />
        )}

        {data.map((d, i) => {
          const cx = getX(i);
          const cy = getY(d.avgOccupancyPct);
          const isActive = hovered?.hour === d.hour;
          return (
            <g
              key={d.hour}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <circle
                cx={cx}
                cy={cy}
                r={isActive ? 6.5 : 4.5}
                fill="#3B82F6"
                stroke="#F8FAFC"
                strokeWidth={1.8}
              />
              <text
                x={cx}
                y={padT + innerH + 18}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono-num"
              >
                {d.timeLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function OccupiedVsAvailablePieChart({
  occupied,
  available,
}: {
  occupied: number;
  available: number;
}) {
  const [hoverSlice, setHoverSlice] = useState<'occupied' | 'available' | null>(null);
  const total = occupied + available;
  if (total === 0) return <EmptyChart title="Occupied vs Available Spaces" />;

  const occFrac = occupied / total;
  const occAngle = occFrac * 360;
  const cx = 100;
  const cy = 100;
  const r = 74;

  const polarToCartesian = (angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const describeSector = (startAngle: number, endAngle: number) => {
    if (endAngle - startAngle >= 359.99) {
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
    }
    const start = polarToCartesian(startAngle);
    const end = polarToCartesian(endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
  };

  return (
    <div className={CHART_CARD}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
        Occupied vs Available Spaces
      </h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <svg viewBox="0 0 200 200" className="w-44 h-44 shrink-0">
          {occupied > 0 && (
            <path
              d={describeSector(0, occAngle)}
              fill="#3B82F6"
              stroke="currentColor"
              className="text-white dark:text-[#0A1120] cursor-pointer transition-opacity duration-150"
              strokeWidth={2}
              opacity={hoverSlice === 'available' ? 0.65 : 1}
              onMouseEnter={() => setHoverSlice('occupied')}
              onMouseLeave={() => setHoverSlice(null)}
            />
          )}
          {available > 0 && (
            <path
              d={describeSector(occAngle, 360)}
              fill="#1E3A5F"
              stroke="currentColor"
              className="text-white dark:text-[#0A1120] cursor-pointer transition-opacity duration-150"
              strokeWidth={2}
              opacity={hoverSlice === 'occupied' ? 0.65 : 1}
              onMouseEnter={() => setHoverSlice('available')}
              onMouseLeave={() => setHoverSlice(null)}
            />
          )}
        </svg>

        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded-sm bg-[#3B82F6] inline-block" />
              Occupied Spaces
            </span>
            <span className="font-mono-num text-sm font-semibold text-slate-900 dark:text-slate-100">
              {occupied.toLocaleString()} ({(occFrac * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded-sm bg-[#1E3A5F] inline-block" />
              Available Spaces
            </span>
            <span className="font-mono-num text-sm font-semibold text-slate-900 dark:text-slate-100">
              {available.toLocaleString()} ({((1 - occFrac) * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Zone Capacity</span>
            <span className="font-mono-num text-slate-800 dark:text-slate-200">
              {total.toLocaleString()} bays
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DayHourHeatmapChart({
  days,
  hours,
  values,
  title = 'Parking Occupancy Heatmap by Day and Hour',
}: {
  days: string[];
  hours: string[];
  values: (number | null)[][];
  title?: string;
}) {
  const [hoveredCell, setHoveredCell] = useState<{
    day: string;
    hour: string;
    val: number;
  } | null>(null);

  if (days.length === 0 || hours.length === 0) {
    return <EmptyChart title={title} />;
  }

  const cellColor = (val: number | null) => {
    if (val === null) return 'bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-600';
    if (val >= 80) return 'bg-red-500/90 text-white';
    if (val >= 65) return 'bg-blue-500/90 text-white';
    if (val >= 45) return 'bg-blue-700/80 text-white';
    if (val >= 30) return 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200';
    return 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200';
  };

  return (
    <div className={CHART_CARD}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {hoveredCell
            ? `${hoveredCell.day} at ${hoveredCell.hour} · ${hoveredCell.val.toFixed(1)}% occupancy`
            : 'Hover any cell to inspect exact rate'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1.5 text-xs">
          <thead>
            <tr>
              <th className="text-left text-slate-500 dark:text-slate-400 font-medium py-1 pr-2 w-28">
                Day
              </th>
              {hours.map((h) => (
                <th
                  key={h}
                  className="text-center text-slate-500 dark:text-slate-400 font-mono-num font-medium py-1"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, rIdx) => (
              <tr key={day}>
                <td className="text-slate-800 dark:text-slate-200 font-medium py-1 pr-2 whitespace-nowrap">
                  {day}
                </td>
                {hours.map((h, cIdx) => {
                  const val = values[rIdx]?.[cIdx] ?? null;
                  return (
                    <td key={`${day}-${h}`} className="p-0">
                      <div
                        onMouseEnter={() => val !== null && setHoveredCell({ day, hour: h, val })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`h-9 rounded-md flex items-center justify-center font-mono-num text-[11px] font-medium transition-transform duration-150 hover:scale-[1.03] ${cellColor(
                          val
                        )}`}
                      >
                        {val !== null ? `${val.toFixed(0)}%` : '—'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WeekdayBarChart({ data }: { data: DayStat[] }) {
  const [hovered, setHovered] = useState<DayStat | null>(null);
  if (data.length === 0) return <EmptyChart title="Average Occupancy by Weekday" />;

  const width = 560;
  const height = 250;
  const padL = 42;
  const padR = 14;
  const padT = 22;
  const padB = 42;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const step = innerW / data.length;
  const barW = Math.min(44, step * 0.56);

  const yPos = (pct: number) => padT + innerH * (1 - Math.min(100, Math.max(0, pct)) / 100);

  return (
    <div className={CHART_CARD}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Average Occupancy by Weekday
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {hovered
            ? `${hovered.day}: ${hovered.avgOccupancyPct.toFixed(1)}% (${hovered.avgOccupied.toFixed(0)} avg spaces)`
            : 'Monday through Sunday comparison'}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = yPos(tick);
          return (
            <g key={tick}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="rgba(148,163,184,0.22)" />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono-num"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const x = padL + i * step + (step - barW) / 2;
          const y = yPos(d.avgOccupancyPct);
          const h = padT + innerH - y;
          const fill = d.avgOccupancyPct >= 70 ? '#38BDF8' : '#2563EB';
          return (
            <g
              key={d.day}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx={4}
                fill={fill}
                opacity={hovered && hovered.day !== d.day ? 0.55 : 0.95}
              />
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-slate-700 dark:fill-slate-200 text-[10px] font-mono-num"
              >
                {d.avgOccupancyPct.toFixed(1)}%
              </text>
              <text
                x={x + barW / 2}
                y={padT + innerH + 18}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 text-[10px]"
              >
                {d.day.slice(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const VEHICLE_COLORS = ['#3B82F6', '#0EA5E9', '#10B981', '#F59E0B', '#A855F7'];

export function VehicleDonutChart({ data }: { data: VehicleStat[] }) {
  const [hovered, setHovered] = useState<VehicleStat | null>(null);
  if (data.length === 0) return <EmptyChart title="Vehicle Type Distribution" />;

  const total = data.reduce((acc, d) => acc + d.totalOccupied, 0);
  const cx = 100;
  const cy = 100;
  const r = 72;
  const innerR = 46;

  const pt = (angleDeg: number, radius: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  let curAngle = 0;
  const arcs = data.map((d, idx) => {
    const sweep = total > 0 ? (d.totalOccupied / total) * 360 : 0;
    const start = curAngle;
    const end = curAngle + sweep;
    curAngle = end;

    const p1 = pt(start, r);
    const p2 = pt(end, r);
    const p3 = pt(end, innerR);
    const p4 = pt(start, innerR);
    const largeArc = sweep > 180 ? 1 : 0;

    const path =
      sweep >= 359.99
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} L ${cx - 0.01} ${
            cy - innerR
          } A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR} Z`
        : `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;

    return { item: d, path, color: VEHICLE_COLORS[idx % VEHICLE_COLORS.length] };
  });

  return (
    <div className={CHART_CARD}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
        Vehicle Type Distribution
      </h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <svg viewBox="0 0 200 200" className="w-44 h-44 shrink-0">
          {arcs.map(({ item, path, color }) => (
            <path
              key={item.vehicleType}
              d={path}
              fill={color}
              stroke="currentColor"
              className="text-white dark:text-[#0A1120] cursor-pointer transition-opacity duration-150"
              strokeWidth={1.5}
              opacity={hovered && hovered.vehicleType !== item.vehicleType ? 0.5 : 1}
              onMouseEnter={() => setHovered(item)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-slate-900 dark:fill-slate-100 text-xs font-semibold font-mono-num"
          >
            {hovered ? `${hovered.sharePct.toFixed(1)}%` : data.length}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            className="fill-slate-500 dark:fill-slate-400 text-[9px]"
          >
            {hovered ? hovered.vehicleType : 'Vehicle Types'}
          </text>
        </svg>

        <div className="space-y-2.5 w-full">
          {data.map((d, idx) => (
            <div
              key={d.vehicleType}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              className="flex items-center justify-between text-xs border-b border-slate-200 dark:border-slate-800/80 pb-1.5 cursor-pointer"
            >
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ backgroundColor: VEHICLE_COLORS[idx % VEHICLE_COLORS.length] }}
                />
                {d.vehicleType}
              </span>
              <span className="font-mono-num text-slate-600 dark:text-slate-300">
                {d.sharePct.toFixed(1)}% · {d.totalOccupied.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CapacityVsOccupiedChart({ data }: { data: LocationStat[] }) {
  const [hovered, setHovered] = useState<LocationStat | null>(null);
  if (data.length === 0) return <EmptyChart title="Parking Capacity vs Occupied Spaces" />;

  const maxCap = Math.max(...data.map((d) => d.totalCapacity), 10);
  const width = 620;
  const height = 270;
  const padL = 46;
  const padR = 16;
  const padT = 26;
  const padB = 56;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const groupStep = innerW / data.length;
  const barW = Math.min(24, groupStep * 0.28);

  const yPos = (val: number) => padT + innerH * (1 - val / (maxCap * 1.1));

  return (
    <div className={CHART_CARD}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Parking Capacity vs Average Occupied Spaces
        </h3>
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#1E3A5F] inline-block" />
            Capacity
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#3B82F6] inline-block" />
            Avg Occupied
          </span>
        </div>
      </div>

      {hovered && (
        <div className="text-xs text-blue-600 dark:text-blue-300 mb-2 tabular-nums">
          {hovered.location}: {hovered.avgOccupied.toFixed(1)} avg occupied / {hovered.totalCapacity}{' '}
          capacity ({hovered.avgAvailable.toFixed(1)} open)
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const val = Math.round(maxCap * 1.1 * frac);
          const y = yPos(val);
          return (
            <g key={frac}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="rgba(148,163,184,0.22)" />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono-num"
              >
                {val}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const cx = padL + i * groupStep + groupStep / 2;
          const capY = yPos(d.totalCapacity);
          const occY = yPos(d.avgOccupied);
          const shortName = d.location.replace(' Parking', '');
          return (
            <g
              key={d.location}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <rect
                x={cx - barW - 2}
                y={capY}
                width={barW}
                height={Math.max(2, padT + innerH - capY)}
                rx={3}
                fill="#1E3A5F"
              />
              <rect
                x={cx + 2}
                y={occY}
                width={barW}
                height={Math.max(2, padT + innerH - occY)}
                rx={3}
                fill="#3B82F6"
              />
              <text
                x={cx}
                y={padT + innerH + 16}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 text-[10px]"
              >
                {shortName.length > 13 ? `${shortName.slice(0, 12)}…` : shortName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DateTrendLineChart({ data }: { data: DateTrendStat[] }) {
  const [hovered, setHovered] = useState<DateTrendStat | null>(null);
  if (data.length === 0) return <EmptyChart title="Date-Wise Parking Occupancy Trend" />;

  const width = 620;
  const height = 240;
  const padL = 44;
  const padR = 18;
  const padT = 20;
  const padB = 40;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const getX = (idx: number) =>
    data.length === 1 ? padL + innerW / 2 : padL + (idx / (data.length - 1)) * innerW;
  const getY = (pct: number) => padT + innerH * (1 - Math.min(100, Math.max(0, pct)) / 100);

  const pts = data.map((d, i) => `${getX(i)},${getY(d.avgOccupancyPct)}`).join(' ');

  return (
    <div className={CHART_CARD}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Date-Wise Capacity Utilization Trend
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {hovered
            ? `${hovered.date} · ${hovered.avgOccupancyPct.toFixed(1)}% avg occupancy`
            : `${data.length} observed days`}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="rgba(148,163,184,0.22)" />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono-num"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {data.length > 1 && (
          <polyline fill="none" stroke="#3B82F6" strokeWidth={2.2} points={pts} />
        )}

        {data.map((d, i) => {
          const cx = getX(i);
          const cy = getY(d.avgOccupancyPct);
          const showLabel = data.length <= 8 || i % 2 === 0 || i === data.length - 1;
          return (
            <g
              key={d.date}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <circle
                cx={cx}
                cy={cy}
                r={hovered?.date === d.date ? 6 : 4}
                fill="#0EA5E9"
                stroke="#F8FAFC"
                strokeWidth={1.5}
              />
              {showLabel && (
                <text
                  x={cx}
                  y={padT + innerH + 18}
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono-num"
                >
                  {d.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function WeekdayVsWeekendChart({ data }: { data: WeekdayVsWeekendStat[] }) {
  if (data.length === 0) return <EmptyChart title="Weekday vs Weekend Comparison" />;

  return (
    <div className={CHART_CARD}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
        Weekday vs Weekend Demand Comparison
      </h3>
      <div className="space-y-4">
        {data.map((row) => (
          <div key={row.segment} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-200">{row.segment}</span>
              <span className="font-mono-num text-slate-600 dark:text-slate-300">
                {row.avgOccupancyPct.toFixed(1)}% · {row.avgOccupied.toFixed(0)} occupied /{' '}
                {row.avgAvailable.toFixed(0)} open ({row.recordCount} records)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
              <div
                className={`h-full rounded-full ${
                  row.segment.startsWith('Weekday') ? 'bg-blue-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(100, row.avgOccupancyPct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PredictionForecastChart({ data }: { data: PredictionPoint[] }) {
  const [hovered, setHovered] = useState<PredictionPoint | null>(null);
  if (data.length === 0) return <EmptyChart title="Predicted vs Historical Hourly Occupancy" />;

  const width = 660;
  const height = 270;
  const padL = 44;
  const padR = 20;
  const padT = 24;
  const padB = 40;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const getX = (idx: number) =>
    data.length === 1 ? padL + innerW / 2 : padL + (idx / (data.length - 1)) * innerW;
  const getY = (pct: number) => padT + innerH * (1 - Math.min(100, Math.max(0, pct)) / 100);

  const predPoints = data.map((d, i) => `${getX(i)},${getY(d.predictedPct)}`).join(' ');
  const histSegments = data
    .map((d, i) => (d.historicalPct !== null ? `${getX(i)},${getY(d.historicalPct)}` : null))
    .filter((v): v is string => v !== null)
    .join(' ');

  const bandPath =
    data.length > 1
      ? `M ${data.map((d, i) => `${getX(i)},${getY(d.upperBoundPct)}`).join(' L ')} L ${[...data]
          .reverse()
          .map((d, revIdx) => `${getX(data.length - 1 - revIdx)},${getY(d.lowerBoundPct)}`)
          .join(' L ')} Z`
      : '';

  return (
    <div className={CHART_CARD}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Predicted vs Historical Hourly Occupancy (%)
        </h3>
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-500 inline-block" /> Historical Mean
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cyan-400 border-b border-dashed inline-block" /> Projected Trend
          </span>
          {hovered && (
            <span className="text-blue-600 dark:text-cyan-300 font-medium">
              {hovered.timeLabel}: Proj {hovered.predictedPct.toFixed(1)}% (Band{' '}
              {hovered.lowerBoundPct.toFixed(0)}–{hovered.upperBoundPct.toFixed(0)}%)
            </span>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="rgba(148,163,184,0.22)" />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono-num"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        <line
          x1={padL}
          x2={width - padR}
          y1={getY(80)}
          y2={getY(80)}
          stroke="#EF4444"
          strokeDasharray="4 4"
          strokeWidth={1}
        />

        {bandPath && <path d={bandPath} fill="rgba(56, 189, 248, 0.14)" />}
        {histSegments && (
          <polyline fill="none" stroke="#3B82F6" strokeWidth={2.5} points={histSegments} />
        )}
        {data.length > 1 && (
          <polyline
            fill="none"
            stroke="#22D3EE"
            strokeWidth={2.2}
            strokeDasharray="5 4"
            points={predPoints}
          />
        )}

        {data.map((d, i) => {
          const cx = getX(i);
          const cy = getY(d.predictedPct);
          return (
            <g
              key={d.hour}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <circle
                cx={cx}
                cy={cy}
                r={hovered?.hour === d.hour ? 5.5 : 3.5}
                fill="#22D3EE"
                stroke="#0A1120"
                strokeWidth={1.2}
              />
              {d.historicalPct !== null && (
                <circle
                  cx={cx}
                  cy={getY(d.historicalPct)}
                  r={3.5}
                  fill="#3B82F6"
                  stroke="#F8FAFC"
                  strokeWidth={1.2}
                />
              )}
              {(data.length <= 10 || i % 2 === 0) && (
                <text
                  x={cx}
                  y={padT + innerH + 18}
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono-num"
                >
                  {d.timeLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
