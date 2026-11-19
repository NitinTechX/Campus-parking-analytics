import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Info, Menu, Moon, Sun, X } from 'lucide-react';
import sampleCsvRaw from '../campus-parking-usage-analysis/data/sample_parking_data.csv?raw';
import { Sidebar } from './components/Sidebar';
import { AboutProjectPage } from './pages/AboutProjectPage';
import { AdminPanelPage } from './pages/AdminPanelPage';
import { AlertsPage } from './pages/AlertsPage';
import { AssistantPage } from './pages/AssistantPage';
import { DatasetExplorerPage } from './pages/DatasetExplorerPage';
import { InsightsPage } from './pages/InsightsPage';
import { LiveParkingPage } from './pages/LiveParkingPage';
import { LocationAnalysisPage } from './pages/LocationAnalysisPage';
import { LocationComparisonPage } from './pages/LocationComparisonPage';
import { OverviewPage } from './pages/OverviewPage';
import { ParkingAnalyticsPage } from './pages/ParkingAnalyticsPage';
import { PredictiveAnalyticsPage } from './pages/PredictiveAnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { TimeDayAnalysisPage } from './pages/TimeDayAnalysisPage';
import type {
  ActivityEntry,
  CameraDetectionLog,
  CleaningReport,
  DataMode,
  FilterState,
  ImportHistoryEntry,
  LiveDatabaseState,
  LiveVehicleRecord,
  PageId,
  ParkingRecord,
  ThresholdConfig,
  UserProfile,
  ZoneConfig,
} from './types/parking';
import {
  applyZoneOverrides,
  calculateKpis,
  calculateLiveKpis,
  computeDateTrends,
  computeDayHourHeatmap,
  computeDayUsage,
  computeHourlyUsage,
  computeLiveLocationUsage,
  computeLocationUsage,
  computePredictions,
  computeStatisticalSummary,
  computeVehicleDistribution,
  computeWeekdayVsWeekend,
  DEFAULT_THRESHOLDS,
  filterRecords,
  generateInsightsAndRecommendations,
  generateLiveSmartAlerts,
  generateSmartAlerts,
} from './utils/analytics';
import { DAY_ORDER, mergeDatasets, validateAndCleanCsv } from './utils/dataCleaning';

const PAGE_LABELS: Record<PageId, string> = {
  overview: 'Overview Dashboard',
  live: 'Live Parking & AI Cam',
  analytics: 'Parking Analytics',
  locations: 'Location Analysis & Map',
  comparison: 'Location Comparison',
  'time-day': 'Time & Day Analysis',
  predictions: 'Predictive Analytics',
  assistant: 'AI Parking Assistant',
  alerts: 'Smart Alerts',
  explorer: 'Dataset Explorer & CSV Manager',
  reports: 'Reports & Export',
  admin: 'Parking Management Admin',
  insights: 'Insights & Recommendations',
  about: 'About Project',
};

const STORAGE_KEYS = {
  theme: 'cpma_v2_theme',
  dataMode: 'cpma_v2_data_mode',
  dataset: 'cpma_v2_dataset',
  history: 'cpma_v2_import_history',
  readAlerts: 'cpma_v2_read_alerts',
  activeUserEmail: 'cpma_v2_active_user_email',
};

const DEFAULT_ZONES: ZoneConfig[] = [
  { id: 'zone-main-gate', name: 'Main Gate Parking', code: 'MG-01', capacity: 150, category: 'Gate', mapX: 16, mapY: 72, active: true },
  { id: 'zone-academic', name: 'Academic Block Parking', code: 'AB-02', capacity: 200, category: 'Academic', mapX: 46, mapY: 36, active: true },
  { id: 'zone-library', name: 'Library Parking', code: 'LB-03', capacity: 120, category: 'Academic', mapX: 74, mapY: 32, active: true },
  { id: 'zone-canteen', name: 'Canteen Parking', code: 'CT-04', capacity: 90, category: 'Dining', mapX: 52, mapY: 66, active: true },
  { id: 'zone-hostel', name: 'Hostel Parking', code: 'HS-05', capacity: 180, category: 'Residential', mapX: 20, mapY: 24, active: true },
  { id: 'zone-sports', name: 'Sports Complex Parking', code: 'SC-06', capacity: 100, category: 'Recreation', mapX: 80, mapY: 70, active: true },
];

function buildDefaultFilters(records: ParkingRecord[]): FilterState {
  const dates = records.map((r) => r.Date).sort();
  const days = DAY_ORDER.filter((d) => records.some((r) => r.Day === d));
  const locations = Array.from(new Set(records.map((r) => r.Parking_Location))).sort();
  const vehicles = Array.from(new Set(records.map((r) => r.Vehicle_Type))).sort();
  const timePeriods = Array.from(new Set(records.map((r) => r.Time_Period))).sort();

  return {
    dateStart: dates[0] ?? '',
    dateEnd: dates[dates.length - 1] ?? '',
    days,
    locations,
    vehicles,
    timePeriods,
  };
}

interface StoredDataset {
  records: ParkingRecord[];
  cleaningReport: CleaningReport;
  isSimulated: boolean;
  uploadedFileName: string | null;
}

export default function App() {
  const initialSample = useMemo(() => validateAndCleanCsv(sampleCsvRaw), []);

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.theme);
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Demo Mode vs Live Data Mode
  const [dataMode, setDataMode] = useState<DataMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.dataMode);
      return saved === 'live' ? 'live' : 'demo';
    } catch {
      return 'demo';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.dataMode, dataMode);
    } catch {
      // Ignore storage errors
    }
  }, [dataMode]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch {
      // Ignore storage quota errors
    }
  }, [theme]);

  // Persistent Dataset State
  const [datasetState, setDatasetState] = useState<StoredDataset>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.dataset);
      if (saved) {
        const parsed = JSON.parse(saved) as StoredDataset;
        if (Array.isArray(parsed.records) && parsed.records.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fall back to bundled sample
    }
    return {
      records: initialSample.records,
      cleaningReport: initialSample.cleaningReport,
      isSimulated: true,
      uploadedFileName: null,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.dataset, JSON.stringify(datasetState));
    } catch {
      // Ignore if dataset exceeds localStorage quota
    }
  }, [datasetState]);

  // Import History
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.history);
      if (saved) {
        const parsed = JSON.parse(saved) as ImportHistoryEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Default entry below
    }
    return [
      {
        id: 'sample-init',
        timestamp: new Date().toISOString(),
        fileName: 'sample_parking_data.csv (Simulated)',
        mode: 'sample',
        rawRows: initialSample.cleaningReport.rawRows,
        cleanedRows: initialSample.cleaningReport.cleanedRows,
        qualityScore: initialSample.cleaningReport.qualityScore,
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(importHistory));
    } catch {
      // Ignore storage errors
    }
  }, [importHistory]);

  // Read Alert IDs
  const [readAlertIds, setReadAlertIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.readAlerts);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.readAlerts, JSON.stringify(readAlertIds));
    } catch {
      // Ignore
    }
  }, [readAlertIds]);

  // Server-backed Admin, Threshold & Live Database State
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [zones, setZones] = useState<ZoneConfig[]>(DEFAULT_ZONES);
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [liveDb, setLiveDb] = useState<LiveDatabaseState>({
    vehicles: [],
    parkingHistory: [],
    users: [
      {
        id: 'usr-default-operator',
        name: 'Campus Gate Operator',
        email: 'operator@campus-parking.edu',
        role: 'operator',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
    ],
    importHistory: [],
    cameraDetections: [],
  });
  const [activeUserEmail, setActiveUserEmail] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.activeUserEmail) || 'operator@campus-parking.edu';
    } catch {
      return 'operator@campus-parking.edu';
    }
  });
  const [hydrating, setHydrating] = useState(true);

  const refreshLiveState = useCallback(async () => {
    try {
      const res = await fetch('/api/live/state');
      if (res.ok) {
        const data = (await res.json()) as LiveDatabaseState;
        setLiveDb(data);
      }
    } catch {
      // Ignore network hiccup
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/auth/session').then((r) => (r.ok ? r.json() : { role: 'viewer' })),
      fetch('/api/admin/state').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/live/state').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([sessionData, adminData, liveData]) => {
        if (!active) return;
        if (sessionData?.role === 'admin' || sessionData?.role === 'viewer') {
          setRole(sessionData.role);
        }
        if (adminData) {
          if (Array.isArray(adminData.zones)) setZones(adminData.zones);
          if (adminData.thresholds) setThresholds(adminData.thresholds);
          if (Array.isArray(adminData.activityLog)) setActivityLog(adminData.activityLog);
        }
        if (liveData) {
          setLiveDb(liveData as LiveDatabaseState);
        }
      })
      .catch(() => {
        // Fallback to default local config if offline
      })
      .finally(() => {
        if (active) setHydrating(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const logActivity = useCallback((action: string, details: string) => {
    fetch('/api/admin/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.activityLog) setActivityLog(data.activityLog);
      })
      .catch(() => {
        // Ignore logging failure
      });
  }, []);

  // Navigation & Sidebar UI state
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentUser: UserProfile = useMemo(() => {
    const found = liveDb.users.find(
      (u) => u.email.toLowerCase() === activeUserEmail.toLowerCase()
    );
    return (
      found ??
      liveDb.users[0] ?? {
        id: 'usr-default-operator',
        name: 'Campus Gate Operator',
        email: 'operator@campus-parking.edu',
        role: 'operator',
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      }
    );
  }, [liveDb.users, activeUserEmail]);

  const activeParkedCount = useMemo(
    () => liveDb.vehicles.filter((v) => v.status === 'parked').length,
    [liveDb.vehicles]
  );

  // Sync zone capacity/active overrides into active mode records
  const activeRawRecords = useMemo(
    () => (dataMode === 'live' ? liveDb.parkingHistory : datasetState.records),
    [dataMode, liveDb.parkingHistory, datasetState.records]
  );

  const effectiveRecords = useMemo(
    () => applyZoneOverrides(activeRawRecords, zones),
    [activeRawRecords, zones]
  );

  const [filters, setFilters] = useState<FilterState>(() =>
    buildDefaultFilters(datasetState.records)
  );

  const handleSwitchDataMode = useCallback(
    (nextMode: DataMode) => {
      setDataMode(nextMode);
      const nextRecs = applyZoneOverrides(
        nextMode === 'live' ? liveDb.parkingHistory : datasetState.records,
        zones
      );
      setFilters(buildDefaultFilters(nextRecs));
    },
    [liveDb.parkingHistory, datasetState.records, zones]
  );

  // Metadata for filter controls
  const metadata = useMemo(() => {
    const dates = effectiveRecords.map((r) => r.Date).sort();
    return {
      minDate: dates[0] ?? '',
      maxDate: dates[dates.length - 1] ?? '',
      availableDays: DAY_ORDER.filter((d) => effectiveRecords.some((r) => r.Day === d)),
      availableLocations: Array.from(
        new Set(effectiveRecords.map((r) => r.Parking_Location))
      ).sort(),
      availableVehicles: Array.from(new Set(effectiveRecords.map((r) => r.Vehicle_Type))).sort(),
      availableTimePeriods: Array.from(
        new Set(effectiveRecords.map((r) => r.Time_Period))
      ).sort(),
    };
  }, [effectiveRecords]);

  // Filtered records & all dynamic analytics
  const filteredRecords = useMemo(
    () => filterRecords(effectiveRecords, filters),
    [effectiveRecords, filters]
  );

  const liveLocationStats = useMemo(
    () =>
      computeLiveLocationUsage(
        zones,
        liveDb.vehicles,
        filteredRecords,
        thresholds,
        dataMode === 'live' && filters.locations.length > 0 ? filters.locations : undefined
      ),
    [zones, liveDb.vehicles, filteredRecords, thresholds, dataMode, filters.locations]
  );

  const liveAlerts = useMemo(
    () => generateLiveSmartAlerts(zones, liveDb.vehicles, filteredRecords, thresholds),
    [zones, liveDb.vehicles, filteredRecords, thresholds]
  );

  const kpis = useMemo(
    () =>
      dataMode === 'live'
        ? calculateLiveKpis(
            zones,
            liveDb.vehicles,
            filteredRecords,
            thresholds,
            filters.locations.length > 0 ? filters.locations : undefined
          )
        : calculateKpis(filteredRecords, thresholds),
    [dataMode, zones, liveDb.vehicles, filteredRecords, thresholds, filters.locations]
  );
  const locationStats = useMemo(
    () =>
      dataMode === 'live'
        ? liveLocationStats
        : computeLocationUsage(filteredRecords, thresholds),
    [dataMode, liveLocationStats, filteredRecords, thresholds]
  );
  const hourlyStats = useMemo(() => computeHourlyUsage(filteredRecords), [filteredRecords]);
  const dayStats = useMemo(() => computeDayUsage(filteredRecords), [filteredRecords]);
  const weekdayVsWeekend = useMemo(
    () => computeWeekdayVsWeekend(filteredRecords),
    [filteredRecords]
  );
  const heatmap = useMemo(() => computeDayHourHeatmap(filteredRecords), [filteredRecords]);
  const vehicleStats = useMemo(
    () => computeVehicleDistribution(filteredRecords),
    [filteredRecords]
  );
  const dateTrends = useMemo(() => computeDateTrends(filteredRecords), [filteredRecords]);
  const statSummary = useMemo(
    () => computeStatisticalSummary(filteredRecords),
    [filteredRecords]
  );
  const smartAlerts = useMemo(
    () => (dataMode === 'live' ? liveAlerts : generateSmartAlerts(filteredRecords, thresholds)),
    [dataMode, liveAlerts, filteredRecords, thresholds]
  );
  const predictions = useMemo(
    () => computePredictions(filteredRecords, thresholds),
    [filteredRecords, thresholds]
  );
  const insightsPkg = useMemo(
    () => generateInsightsAndRecommendations(filteredRecords, thresholds),
    [filteredRecords, thresholds]
  );

  const liveCleaningReport: CleaningReport = useMemo(
    () => ({
      rawRows: liveDb.parkingHistory.length,
      cleanedRows: liveDb.parkingHistory.length,
      duplicatesRemoved: 0,
      missingValuesHandled: 0,
      invalidDatesDropped: 0,
      invalidTimesFixed: 0,
      negativeValuesFixed: 0,
      invalidCapacityDropped: 0,
      clampedOccupiedRows: 0,
      calculatedAvailableRows: 0,
      qualityScore: 100,
    }),
    [liveDb.parkingHistory.length]
  );

  const unreadAlertCount = useMemo(() => {
    const readSet = new Set(readAlertIds);
    return smartAlerts.filter((a) => !readSet.has(a.id)).length;
  }, [smartAlerts, readAlertIds]);

  // Live Vehicle Management & User Handlers
  const handleSaveUser = async (name: string, email: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/live/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role: 'operator' }),
      });
      const data = (await res.json()) as {
        user?: UserProfile;
        users?: UserProfile[];
        error?: string;
      };
      if (!res.ok || !data.user) return data.error ?? 'Failed to save operator profile.';
      setLiveDb((prev) => ({ ...prev, users: data.users ?? prev.users }));
      setActiveUserEmail(data.user.email);
      try {
        localStorage.setItem(STORAGE_KEYS.activeUserEmail, data.user.email);
      } catch {
        // Ignore
      }
      return null;
    } catch {
      return 'Network error while saving operator profile.';
    }
  };

  const handleVehicleEntry = async (payload: {
    plateNumber: string;
    vehicleType: LiveVehicleRecord['vehicleType'];
    location: string;
    source: 'manual' | 'ai_camera';
    recordedBy: string;
    notes?: string;
  }): Promise<string | null> => {
    try {
      const res = await fetch('/api/live/vehicles/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        state?: LiveDatabaseState;
        activityLog?: ActivityEntry[];
        error?: string;
      };
      if (!res.ok) return data.error ?? 'Failed to record vehicle entry.';
      if (data.state) {
        setLiveDb(data.state);
        if (dataMode === 'live') {
          setFilters(buildDefaultFilters(applyZoneOverrides(data.state.parkingHistory, zones)));
        }
      }
      if (data.activityLog) setActivityLog(data.activityLog);
      return null;
    } catch {
      return 'Network error while recording vehicle entry.';
    }
  };

  const handleVehicleExit = async (id: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/live/vehicles/${encodeURIComponent(id)}/exit`, {
        method: 'POST',
      });
      const data = (await res.json()) as {
        state?: LiveDatabaseState;
        activityLog?: ActivityEntry[];
        error?: string;
      };
      if (!res.ok) return data.error ?? 'Failed to record vehicle exit.';
      if (data.state) {
        setLiveDb(data.state);
        if (dataMode === 'live') {
          setFilters(buildDefaultFilters(applyZoneOverrides(data.state.parkingHistory, zones)));
        }
      }
      if (data.activityLog) setActivityLog(data.activityLog);
      return null;
    } catch {
      return 'Network error while recording vehicle exit.';
    }
  };

  const handleBatchCameraEntry = async (payload: {
    entries: Array<{ plateNumber: string; vehicleType: string; notes?: string }>;
    location: string;
    recordedBy: string;
    detectionLog: Omit<CameraDetectionLog, 'id' | 'vehiclesLogged'>;
  }): Promise<{ error: string | null; addedCount?: number; skipped?: string[] }> => {
    try {
      const res = await fetch('/api/live/vehicles/batch-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        addedCount?: number;
        skipped?: string[];
        state?: LiveDatabaseState;
        activityLog?: ActivityEntry[];
        error?: string;
      };
      if (!res.ok) return { error: data.error ?? 'Failed to log AI camera vehicles.' };
      if (data.state) {
        setLiveDb(data.state);
        if (dataMode === 'live') {
          setFilters(buildDefaultFilters(applyZoneOverrides(data.state.parkingHistory, zones)));
        }
      }
      if (data.activityLog) setActivityLog(data.activityLog);
      return { error: null, addedCount: data.addedCount, skipped: data.skipped };
    } catch {
      return { error: 'Network error while logging AI camera vehicles.' };
    }
  };

  const handleClearExited = async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/live/vehicles/exited', { method: 'DELETE' });
      const data = (await res.json()) as { state?: LiveDatabaseState; error?: string };
      if (!res.ok) return data.error ?? 'Failed to clear exited records.';
      if (data.state) setLiveDb(data.state);
      return null;
    } catch {
      return 'Network error while clearing exited records.';
    }
  };

  // Handlers for Dataset Imports (persists to DB in Live Data Mode, localStorage in Demo Mode)
  const handleCommitImport = async (
    mode: 'replace' | 'append',
    parsedRecords: ParkingRecord[],
    report: CleaningReport,
    fileName: string
  ): Promise<string | null> => {
    if (dataMode === 'live') {
      try {
        const res = await fetch('/api/live/import-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            records: parsedRecords,
            cleaningReport: report,
            fileName,
          }),
        });
        const data = (await res.json()) as {
          state?: LiveDatabaseState;
          activityLog?: ActivityEntry[];
          error?: string;
        };
        if (!res.ok) return data.error ?? 'Failed to import CSV records into database.';
        if (data.state) {
          setLiveDb(data.state);
          setFilters(buildDefaultFilters(applyZoneOverrides(data.state.parkingHistory, zones)));
        }
        if (data.activityLog) setActivityLog(data.activityLog);
        return null;
      } catch {
        return 'Network error while importing CSV into database.';
      }
    }

    let nextRecords = parsedRecords;
    let nextReport = report;

    if (mode === 'append') {
      const { merged, duplicatesSkipped } = mergeDatasets(datasetState.records, parsedRecords);
      nextRecords = merged;
      nextReport = {
        ...report,
        rawRows: datasetState.cleaningReport.rawRows + report.rawRows,
        cleanedRows: merged.length,
        duplicatesRemoved:
          datasetState.cleaningReport.duplicatesRemoved +
          report.duplicatesRemoved +
          duplicatesSkipped,
      };
    }

    setDatasetState({
      records: nextRecords,
      cleaningReport: nextReport,
      isSimulated: false,
      uploadedFileName:
        mode === 'append' && datasetState.uploadedFileName
          ? `${datasetState.uploadedFileName} + ${fileName}`
          : fileName,
    });
    setFilters(buildDefaultFilters(nextRecords));
    setImportHistory((prev) => [
      {
        id: `imp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        fileName,
        mode,
        rawRows: report.rawRows,
        cleanedRows: report.cleanedRows,
        qualityScore: report.qualityScore,
      },
      ...prev,
    ]);
    logActivity(
      'Dataset Imported',
      `${mode === 'replace' ? 'Replaced dataset with' : 'Appended'} "${fileName}" (${report.cleanedRows} valid rows, quality ${report.qualityScore}%).`
    );
    return null;
  };

  const handleRestoreSample = () => {
    setDatasetState({
      records: initialSample.records,
      cleaningReport: initialSample.cleaningReport,
      isSimulated: true,
      uploadedFileName: null,
    });
    setFilters(buildDefaultFilters(initialSample.records));
    logActivity('Dataset Restored', 'Restored bundled 588-row simulated campus dataset.');
  };

  // Admin API Handlers
  const handleSignInAdmin = async (passcode: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', passcode }),
      });
      const data = (await res.json()) as { role?: 'admin' | 'viewer'; error?: string; activityLog?: ActivityEntry[] };
      if (!res.ok) return data.error ?? 'Authentication failed.';
      setRole('admin');
      if (data.activityLog) setActivityLog(data.activityLog);
      return null;
    } catch {
      return 'Network error while authenticating admin session.';
    }
  };

  const handleSignOutAdmin = async (): Promise<void> => {
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'viewer' }),
    }).catch(() => {});
    setRole('viewer');
  };

  const handleAddZone = async (zone: Omit<ZoneConfig, 'id'>): Promise<string | null> => {
    const res = await fetch('/api/admin/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zone),
    });
    const data = (await res.json()) as {
      zones?: ZoneConfig[];
      activityLog?: ActivityEntry[];
      error?: string;
    };
    if (!res.ok) return data.error ?? 'Failed to add parking zone.';
    if (data.zones) setZones(data.zones);
    if (data.activityLog) setActivityLog(data.activityLog);
    return null;
  };

  const handleUpdateZone = async (
    id: string,
    patch: Partial<ZoneConfig>
  ): Promise<string | null> => {
    const res = await fetch(`/api/admin/zones/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as {
      zones?: ZoneConfig[];
      activityLog?: ActivityEntry[];
      error?: string;
    };
    if (!res.ok) return data.error ?? 'Failed to update parking zone.';
    if (data.zones) setZones(data.zones);
    if (data.activityLog) setActivityLog(data.activityLog);
    return null;
  };

  const handleDeleteZone = async (id: string): Promise<string | null> => {
    const res = await fetch(`/api/admin/zones/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = (await res.json()) as {
      zones?: ZoneConfig[];
      activityLog?: ActivityEntry[];
      error?: string;
    };
    if (!res.ok) return data.error ?? 'Failed to delete parking zone.';
    if (data.zones) setZones(data.zones);
    if (data.activityLog) setActivityLog(data.activityLog);
    return null;
  };

  const handleUpdateThresholds = async (next: ThresholdConfig): Promise<string | null> => {
    const res = await fetch('/api/admin/thresholds', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    const data = (await res.json()) as {
      thresholds?: ThresholdConfig;
      activityLog?: ActivityEntry[];
      error?: string;
    };
    if (!res.ok) return data.error ?? 'Failed to update thresholds.';
    if (data.thresholds) setThresholds(data.thresholds);
    if (data.activityLog) setActivityLog(data.activityLog);
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#070D1A] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#0C1526]/95 backdrop-blur px-4 lg:px-6 py-3 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            Campus Parking Analytics
          </span>
          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline truncate">
            {PAGE_LABELS[activePage]}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Demo Mode vs Live Data Mode Switcher */}
          <div
            className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#081020] p-0.5 text-xs"
            role="group"
            aria-label="Data source mode"
          >
            <button
              type="button"
              onClick={() => handleSwitchDataMode('demo')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                dataMode === 'demo'
                  ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Demo Mode
            </button>
            <button
              type="button"
              onClick={() => handleSwitchDataMode('live')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                dataMode === 'live'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Live Data
            </button>
          </div>

          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111B2E] text-slate-700 dark:text-slate-200 hover:border-blue-500 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-blue-600" />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePage('reports')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export Report
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex flex-1">
        <Sidebar
          activePage={activePage}
          onSelectPage={setActivePage}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          unreadAlertCount={unreadAlertCount}
          liveParkedCount={activeParkedCount}
          filters={filters}
          onChangeFilters={setFilters}
          onResetFilters={() => setFilters(buildDefaultFilters(effectiveRecords))}
          availableDays={metadata.availableDays}
          availableLocations={metadata.availableLocations}
          availableVehicles={metadata.availableVehicles}
          availableTimePeriods={metadata.availableTimePeriods}
          minDate={metadata.minDate}
          maxDate={metadata.maxDate}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-7 max-w-[1440px] w-full mx-auto space-y-6 min-w-0">
          {/* Page Header & Simulated vs Live Data Disclosure */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-2.5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {PAGE_LABELS[activePage]}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Smart Campus Parking Management Platform
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
              <span>
                {dataMode === 'live'
                  ? `Live Data Mode · ${activeParkedCount} parked vehicle(s) · ${liveDb.parkingHistory.length} persisted DB record(s)`
                  : datasetState.isSimulated
                    ? `Demo Mode · Simulated dataset (${effectiveRecords.length} records) · Not live sensor data`
                    : `Demo Mode · Custom CSV: ${datasetState.uploadedFileName} (${effectiveRecords.length} cleaned records)`}
              </span>
            </div>
          </div>

          {hydrating ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-24 rounded-xl bg-slate-200 dark:bg-[#111B2E] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              {activePage === 'overview' && (
                <OverviewPage
                  kpis={kpis}
                  locationStats={locationStats}
                  hourlyStats={hourlyStats}
                  alerts={smartAlerts}
                  insights={insightsPkg.insights}
                  thresholds={thresholds}
                  onNavigate={setActivePage}
                />
              )}

              {activePage === 'live' && (
                <LiveParkingPage
                  dataMode={dataMode}
                  onSwitchDataMode={handleSwitchDataMode}
                  zones={zones}
                  thresholds={thresholds}
                  vehicles={liveDb.vehicles}
                  liveLocationStats={liveLocationStats}
                  liveAlerts={liveAlerts}
                  users={liveDb.users}
                  currentUser={currentUser}
                  cameraDetections={liveDb.cameraDetections}
                  onSaveUser={handleSaveUser}
                  onVehicleEntry={handleVehicleEntry}
                  onVehicleExit={handleVehicleExit}
                  onBatchCameraEntry={handleBatchCameraEntry}
                  onClearExited={handleClearExited}
                  onRefreshLive={refreshLiveState}
                />
              )}

              {activePage === 'analytics' && (
                <ParkingAnalyticsPage
                  locationStats={locationStats}
                  vehicleStats={vehicleStats}
                  dateTrends={dateTrends}
                  weekdayVsWeekend={weekdayVsWeekend}
                  heatmap={heatmap}
                  statSummary={statSummary}
                />
              )}

              {activePage === 'locations' && (
                <LocationAnalysisPage
                  locationStats={locationStats}
                  zones={zones}
                  thresholds={thresholds}
                  isSimulated={dataMode === 'demo' && datasetState.isSimulated}
                  dataMode={dataMode}
                />
              )}

              {activePage === 'comparison' && (
                <LocationComparisonPage locationStats={locationStats} />
              )}

              {activePage === 'time-day' && (
                <TimeDayAnalysisPage
                  hourlyStats={hourlyStats}
                  dayStats={dayStats}
                  weekdayVsWeekend={weekdayVsWeekend}
                  heatmap={heatmap}
                />
              )}

              {activePage === 'predictions' && (
                <PredictiveAnalyticsPage predictions={predictions} thresholds={thresholds} />
              )}

              {activePage === 'assistant' && (
                <AssistantPage
                  records={filteredRecords}
                  thresholds={thresholds}
                  isSimulated={dataMode === 'demo' && datasetState.isSimulated}
                  liveOverride={
                    dataMode === 'live'
                      ? {
                          dataMode: 'live',
                          kpis,
                          locations: locationStats,
                        }
                      : undefined
                  }
                />
              )}

              {activePage === 'alerts' && (
                <AlertsPage
                  alerts={smartAlerts}
                  readAlertIds={readAlertIds}
                  onMarkRead={(id) =>
                    setReadAlertIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
                  }
                  onMarkAllRead={(ids) =>
                    setReadAlertIds((prev) => Array.from(new Set([...prev, ...ids])))
                  }
                  thresholds={thresholds}
                />
              )}

              {activePage === 'explorer' && (
                <DatasetExplorerPage
                  records={filteredRecords}
                  allCleanedRecords={effectiveRecords}
                  cleaningReport={
                    dataMode === 'live' ? liveCleaningReport : datasetState.cleaningReport
                  }
                  thresholds={thresholds}
                  isSimulated={dataMode === 'demo' && datasetState.isSimulated}
                  dataMode={dataMode}
                  uploadedFileName={datasetState.uploadedFileName}
                  importHistory={dataMode === 'live' ? liveDb.importHistory : importHistory}
                  onCommitImport={handleCommitImport}
                  onRestoreSample={handleRestoreSample}
                />
              )}

              {activePage === 'reports' && (
                <ReportsPage
                  records={filteredRecords}
                  cleaningReport={
                    dataMode === 'live' ? liveCleaningReport : datasetState.cleaningReport
                  }
                  thresholds={thresholds}
                  isSimulated={dataMode === 'demo' && datasetState.isSimulated}
                  liveOverrides={
                    dataMode === 'live'
                      ? {
                          dataMode: 'live',
                          kpis,
                          locationStats,
                        }
                      : undefined
                  }
                  onLogActivity={logActivity}
                />
              )}

              {activePage === 'admin' && (
                <AdminPanelPage
                  role={role}
                  zones={zones}
                  thresholds={thresholds}
                  activityLog={activityLog}
                  onSignInAdmin={handleSignInAdmin}
                  onSignOutAdmin={handleSignOutAdmin}
                  onAddZone={handleAddZone}
                  onUpdateZone={handleUpdateZone}
                  onDeleteZone={handleDeleteZone}
                  onUpdateThresholds={handleUpdateThresholds}
                />
              )}

              {activePage === 'insights' && (
                <InsightsPage
                  records={filteredRecords}
                  cleaningReport={
                    dataMode === 'live' ? liveCleaningReport : datasetState.cleaningReport
                  }
                  thresholds={thresholds}
                  isSimulated={dataMode === 'demo' && datasetState.isSimulated}
                  kpis={kpis}
                  alerts={smartAlerts}
                  insights={insightsPkg.insights}
                  recommendations={insightsPkg.recommendations}
                />
              )}

              {activePage === 'about' && <AboutProjectPage />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
