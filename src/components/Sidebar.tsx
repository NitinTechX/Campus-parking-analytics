import React from 'react';
import {
  BarChart3,
  Bell,
  Bot,
  CarFront,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  FileBarChart2,
  GitCompare,
  Info,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import type { FilterState, PageId } from '../types/parking';

interface SidebarProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  unreadAlertCount: number;
  liveParkedCount: number;
  filters: FilterState;
  onChangeFilters: (next: FilterState) => void;
  onResetFilters: () => void;
  availableDays: string[];
  availableLocations: string[];
  availableVehicles: string[];
  availableTimePeriods: string[];
  minDate: string;
  maxDate: string;
}

const NAV_GROUPS: Array<{
  heading: string;
  items: Array<{
    id: PageId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}> = [
  {
    heading: 'Analytics',
    items: [
      { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
      { id: 'live', label: 'Live Parking & AI Cam', icon: CarFront },
      { id: 'analytics', label: 'Parking Analytics', icon: BarChart3 },
      { id: 'locations', label: 'Location & Map', icon: MapPin },
      { id: 'comparison', label: 'Location Comparison', icon: GitCompare },
      { id: 'time-day', label: 'Time & Day Analysis', icon: Clock },
    ],
  },
  {
    heading: 'Intelligence',
    items: [
      { id: 'predictions', label: 'Predictive Analytics', icon: TrendingUp },
      { id: 'assistant', label: 'AI Parking Assistant', icon: Bot },
      { id: 'alerts', label: 'Smart Alerts', icon: Bell },
      { id: 'insights', label: 'Insights & Advice', icon: Lightbulb },
    ],
  },
  {
    heading: 'Data & Management',
    items: [
      { id: 'explorer', label: 'Dataset Explorer', icon: Database },
      { id: 'reports', label: 'Reports & Export', icon: FileBarChart2 },
      { id: 'admin', label: 'Admin Panel', icon: ShieldCheck },
      { id: 'about', label: 'About Project', icon: Info },
    ],
  },
];

export function Sidebar({
  activePage,
  onSelectPage,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  unreadAlertCount,
  liveParkedCount,
  filters,
  onChangeFilters,
  onResetFilters,
  availableDays,
  availableLocations,
  availableVehicles,
  availableTimePeriods,
  minDate,
  maxDate,
}: SidebarProps) {
  const toggleArrayFilter = (
    key: 'days' | 'locations' | 'vehicles' | 'timePeriods',
    val: string
  ) => {
    const current = filters[key];
    const exists = current.includes(val);
    const updated = exists ? current.filter((v) => v !== val) : [...current, val];
    onChangeFilters({ ...filters, [key]: updated });
  };

  return (
    <aside
      className={`${
        mobileOpen ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden lg:flex'
      } ${
        collapsed ? 'lg:w-[74px]' : 'w-[272px]'
      } shrink-0 bg-white dark:bg-[#0C1526] border-r border-slate-200 dark:border-slate-800/90 flex-col transition-all duration-200`}
    >
      {/* Navigation */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800/90 space-y-3">
        <div className="flex items-center justify-between px-2">
          {!collapsed && (
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Platform Modules
            </span>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-auto"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="space-y-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading} className="space-y-0.5">
              {!collapsed && (
                <div className="px-2.5 py-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  {group.heading}
                </div>
              )}
              {group.items.map(({ id, label, icon: Icon }) => {
                const active = activePage === id;
                return (
                  <button
                    key={id}
                    type="button"
                    title={collapsed ? label : undefined}
                    onClick={() => {
                      onSelectPage(id);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center ${
                      collapsed ? 'justify-center px-2' : 'justify-between px-2.5'
                    } py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </span>
                    {!collapsed && id === 'alerts' && unreadAlertCount > 0 && (
                      <span className="font-mono-num text-[11px] font-semibold text-red-600 dark:text-red-400">
                        {unreadAlertCount}
                      </span>
                    )}
                    {!collapsed && id === 'live' && liveParkedCount > 0 && (
                      <span className="font-mono-num text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {liveParkedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Filters (hidden when collapsed on desktop) */}
      {!collapsed && (
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Active Filters
            </span>
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-slate-500 dark:text-slate-400">Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={filters.dateStart}
                min={minDate}
                max={filters.dateEnd || maxDate}
                onChange={(e) => onChangeFilters({ ...filters, dateStart: e.target.value })}
                className="w-full bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1.5 text-[11px] text-slate-800 dark:text-slate-200 font-mono-num focus:outline-none focus:border-blue-500"
              />
              <input
                type="date"
                value={filters.dateEnd}
                min={filters.dateStart || minDate}
                max={maxDate}
                onChange={(e) => onChangeFilters({ ...filters, dateEnd: e.target.value })}
                className="w-full bg-slate-50 dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1.5 text-[11px] text-slate-800 dark:text-slate-200 font-mono-num focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Day of Week</span>
              <button
                type="button"
                onClick={() =>
                  onChangeFilters({
                    ...filters,
                    days: filters.days.length === availableDays.length ? [] : [...availableDays],
                  })
                }
                className="text-blue-600 dark:text-blue-400"
              >
                {filters.days.length === availableDays.length ? 'Clear' : 'All'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableDays.map((day) => {
                const selected = filters.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleArrayFilter('days', day)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      selected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-[#111B2E] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Parking Location</span>
              <button
                type="button"
                onClick={() =>
                  onChangeFilters({
                    ...filters,
                    locations:
                      filters.locations.length === availableLocations.length
                        ? []
                        : [...availableLocations],
                  })
                }
                className="text-blue-600 dark:text-blue-400"
              >
                {filters.locations.length === availableLocations.length ? 'Clear' : 'All'}
              </button>
            </div>
            <div className="space-y-1">
              {availableLocations.map((loc) => (
                <label
                  key={loc}
                  className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={filters.locations.includes(loc)}
                    onChange={() => toggleArrayFilter('locations', loc)}
                    className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-blue-600"
                  />
                  <span className="truncate">{loc}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs text-slate-500 dark:text-slate-400">Vehicle Type</span>
            <div className="flex flex-wrap gap-1.5">
              {availableVehicles.map((veh) => {
                const selected = filters.vehicles.includes(veh);
                return (
                  <button
                    key={veh}
                    type="button"
                    onClick={() => toggleArrayFilter('vehicles', veh)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      selected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-[#111B2E] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {veh}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs text-slate-500 dark:text-slate-400">Time Period</span>
            <div className="space-y-1">
              {availableTimePeriods.map((period) => (
                <label
                  key={period}
                  className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={filters.timePeriods.includes(period)}
                    onChange={() => toggleArrayFilter('timePeriods', period)}
                    className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-blue-600"
                  />
                  <span className="truncate">{period}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
