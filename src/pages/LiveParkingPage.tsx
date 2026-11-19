import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Camera,
  CarFront,
  CheckCircle2,
  ExternalLink,
  LogOut,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Video,
  VideoOff,
} from 'lucide-react';
import type {
  CameraDetectionLog,
  CameraDetectionResult,
  DataMode,
  LiveVehicleRecord,
  LocationStat,
  SmartAlert,
  ThresholdConfig,
  UserProfile,
  ZoneConfig,
} from '../types/parking';
import {
  checkCameraEnvironment,
  listAvailableCameras,
  queryCameraPermissionState,
  requestCameraStream,
  stopMediaStream,
  type CameraDeviceOption,
  type CameraEnvironmentInfo,
  type CameraPermissionStatus,
} from '../utils/camera';

interface LiveParkingPageProps {
  dataMode: DataMode;
  onSwitchDataMode: (mode: DataMode) => void;
  zones: ZoneConfig[];
  thresholds: ThresholdConfig;
  vehicles: LiveVehicleRecord[];
  liveLocationStats: LocationStat[];
  liveAlerts: SmartAlert[];
  users: UserProfile[];
  currentUser: UserProfile;
  cameraDetections: CameraDetectionLog[];
  onSaveUser: (name: string, email: string) => Promise<string | null>;
  onVehicleEntry: (payload: {
    plateNumber: string;
    vehicleType: LiveVehicleRecord['vehicleType'];
    location: string;
    source: 'manual' | 'ai_camera';
    recordedBy: string;
    notes?: string;
  }) => Promise<string | null>;
  onVehicleExit: (id: string) => Promise<string | null>;
  onBatchCameraEntry: (payload: {
    entries: Array<{ plateNumber: string; vehicleType: string; notes?: string }>;
    location: string;
    recordedBy: string;
    detectionLog: Omit<CameraDetectionLog, 'id' | 'vehiclesLogged'>;
  }) => Promise<{ error: string | null; addedCount?: number; skipped?: string[] }>;
  onClearExited: () => Promise<string | null>;
  onRefreshLive: () => Promise<void>;
}

const VEHICLE_TYPES: LiveVehicleRecord['vehicleType'][] = [
  'Car',
  'Two-Wheeler',
  'EV',
  'Faculty Van',
];

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ');
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatDuration(entryIso: string, exitIso: string | null): string {
  const start = new Date(entryIso).getTime();
  const end = exitIso ? new Date(exitIso).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—';
  const mins = Math.floor((end - start) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export function LiveParkingPage({
  dataMode,
  onSwitchDataMode,
  zones,
  thresholds,
  vehicles,
  liveLocationStats,
  liveAlerts,
  users,
  currentUser,
  cameraDetections,
  onSaveUser,
  onVehicleEntry,
  onVehicleExit,
  onBatchCameraEntry,
  onClearExited,
  onRefreshLive,
}: LiveParkingPageProps) {
  const activeZones = useMemo(() => zones.filter((z) => z.active), [zones]);

  // User / Operator State
  const [editingUser, setEditingUser] = useState(false);
  const [userNameInput, setUserNameInput] = useState(currentUser.name);
  const [userEmailInput, setUserEmailInput] = useState(currentUser.email);
  const [userMsg, setUserMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setUserNameInput(currentUser.name);
    setUserEmailInput(currentUser.email);
  }, [currentUser]);

  // Manual Vehicle Entry State
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<LiveVehicleRecord['vehicleType']>('Car');
  const [selectedLocation, setSelectedLocation] = useState<string>(
    activeZones[0]?.name ?? 'Main Gate Parking'
  );
  const [notes, setNotes] = useState('');
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [entryFeedback, setEntryFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (activeZones.length > 0 && !activeZones.some((z) => z.name === selectedLocation)) {
      setSelectedLocation(activeZones[0].name);
    }
  }, [activeZones, selectedLocation]);

  // Table Filters & Exit State
  const [tableTab, setTableTab] = useState<'parked' | 'exited'>('parked');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'ai_camera'>('all');
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [confirmClearExited, setConfirmClearExited] = useState(false);

  // AI Camera / Image Vehicle Detection State
  const [camLocation, setCamLocation] = useState<string>(
    activeZones[0]?.name ?? 'Main Gate Parking'
  );
  const [camImageDataUrl, setCamImageDataUrl] = useState<string | null>(null);
  const [camImageName, setCamImageName] = useState<string>('');
  const [camImageMime, setCamImageMime] = useState<string>('image/jpeg');
  const [camAnalyzing, setCamAnalyzing] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [camResult, setCamResult] = useState<CameraDetectionResult | null>(null);
  const [camCommitMsg, setCamCommitMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [camLogging, setCamLogging] = useState(false);

  // Live Webcam Stream, Permissions & Device State (never prompts on mount)
  const [camEnv, setCamEnv] = useState<CameraEnvironmentInfo>(() => checkCameraEnvironment());
  const [camPermission, setCamPermission] = useState<CameraPermissionStatus>('prompt');
  const [cameraDevices, setCameraDevices] = useState<CameraDeviceOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [preferredFacing, setPreferredFacing] = useState<'environment' | 'user'>('environment');
  const [camStarting, setCamStarting] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopWebcam = () => {
    stopMediaStream(streamRef.current, videoRef.current);
    streamRef.current = null;
    setWebcamActive(false);
    setVideoReady(false);
  };

  const refreshCameraDiagnostics = async () => {
    const env = checkCameraEnvironment();
    setCamEnv(env);
    const perm = await queryCameraPermissionState();
    setCamPermission(streamRef.current ? 'active' : perm);
    const devices = await listAvailableCameras();
    setCameraDevices(devices);
    setSelectedCameraId((prev) =>
      prev && devices.some((d) => d.deviceId === prev) ? prev : devices[0]?.deviceId ?? ''
    );
  };

  useEffect(() => {
    void refreshCameraDiagnostics();

    const handleDeviceChange = () => {
      void refreshCameraDiagnostics();
    };
    const handlePageHide = () => {
      stopWebcam();
    };

    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      window.removeEventListener('pagehide', handlePageHide);
      stopWebcam();
    };
  }, []);

  // Attach MediaStream to <video> element once rendered & start playback for desktop + mobile
  useEffect(() => {
    const videoEl = videoRef.current;
    const stream = streamRef.current;
    if (!webcamActive || !videoEl || !stream) return;

    videoEl.srcObject = stream;
    const onLoaded = () => {
      if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        setVideoReady(true);
      }
      void videoEl.play().catch(() => {});
    };
    videoEl.addEventListener('loadedmetadata', onLoaded);
    videoEl.addEventListener('canplay', onLoaded);
    if (videoEl.readyState >= 1) {
      onLoaded();
    } else {
      void videoEl.play().catch(() => {});
    }

    return () => {
      videoEl.removeEventListener('loadedmetadata', onLoaded);
      videoEl.removeEventListener('canplay', onLoaded);
    };
  }, [webcamActive, selectedCameraId]);

  const startWebcam = async (overrideDeviceId?: string, overrideFacing?: 'environment' | 'user') => {
    if (camStarting) return;
    setCamError(null);
    setCamStarting(true);

    // Stop any previous active tracks before opening new stream
    stopMediaStream(streamRef.current, videoRef.current);
    streamRef.current = null;
    setWebcamActive(false);
    setVideoReady(false);

    const targetDeviceId = overrideDeviceId !== undefined ? overrideDeviceId : selectedCameraId;
    const targetFacing = overrideFacing ?? preferredFacing;

    const result = await requestCameraStream({
      deviceId: targetDeviceId || undefined,
      facingMode: targetFacing,
    });

    setCamEnv(checkCameraEnvironment());
    setCameraDevices(result.devices);
    if (result.activeDeviceId) {
      setSelectedCameraId(result.activeDeviceId);
    } else if (result.devices.length > 0 && !targetDeviceId) {
      setSelectedCameraId(result.devices[0].deviceId);
    }

    if (!result.stream) {
      setCamPermission(result.status);
      setCamError(result.error);
      setCamStarting(false);
      return;
    }

    // Listen for unexpected camera disconnect
    const videoTrack = result.stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        stopWebcam();
        void refreshCameraDiagnostics();
      };
    }

    streamRef.current = result.stream;
    setCamPermission('active');
    setWebcamActive(true);
    setCamStarting(false);
  };

  const captureWebcamFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCamError('Camera preview is still initializing. Wait a moment and click Capture Frame again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCamImageDataUrl(dataUrl);
    setCamImageName(`camera-capture-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.jpg`);
    setCamImageMime('image/jpeg');
    setCamResult(null);
    setCamError(null);
    setCamCommitMsg(null);
    stopWebcam();
    setCamPermission('granted');
  };

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setCamError('Please upload a valid image file (PNG, JPG, or WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCamImageDataUrl(reader.result);
        setCamImageName(file.name);
        setCamImageMime(file.type || 'image/jpeg');
        setCamResult(null);
        setCamError(null);
        setCamCommitMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const runAiVehicleDetection = async () => {
    if (!camImageDataUrl || camAnalyzing) return;
    setCamAnalyzing(true);
    setCamError(null);
    setCamResult(null);
    setCamCommitMsg(null);

    try {
      const resp = await fetch('/api/detect-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: camImageDataUrl,
          mimeType: camImageMime,
          location: camLocation,
        }),
      });
      const data = (await resp.json()) as CameraDetectionResult & { error?: string };
      if (!resp.ok) {
        setCamError(data.error ?? 'AI vehicle detection request failed.');
      } else {
        setCamResult(data);
      }
    } catch {
      setCamError('Network error while contacting Gemini Vision detection endpoint.');
    } finally {
      setCamAnalyzing(false);
    }
  };

  const handleCommitDetectedVehicles = async () => {
    if (!camResult || camResult.totalVehicles <= 0 || camLogging) return;
    setCamLogging(true);
    setCamCommitMsg(null);

    // Build real detected entries from AI counts + any readable plates
    const typesQueue: LiveVehicleRecord['vehicleType'][] = [
      ...Array<LiveVehicleRecord['vehicleType']>(camResult.breakdown.Car).fill('Car'),
      ...Array<LiveVehicleRecord['vehicleType']>(camResult.breakdown.TwoWheeler).fill(
        'Two-Wheeler'
      ),
      ...Array<LiveVehicleRecord['vehicleType']>(camResult.breakdown.EV).fill('EV'),
      ...Array<LiveVehicleRecord['vehicleType']>(camResult.breakdown.FacultyVan).fill(
        'Faculty Van'
      ),
    ];
    while (typesQueue.length < camResult.totalVehicles) {
      typesQueue.push('Car');
    }

    const batchTag = Date.now().toString(36).toUpperCase().slice(-4);
    const entries = typesQueue.slice(0, camResult.totalVehicles).map((vType, idx) => {
      const readablePlate = camResult.detectedPlates[idx];
      return {
        plateNumber: readablePlate || `CAM-${batchTag}-${String(idx + 1).padStart(2, '0')}`,
        vehicleType: vType,
        notes: readablePlate
          ? `AI Camera OCR plate (${camImageName})`
          : `AI Camera visual count #${idx + 1} (${camImageName})`,
      };
    });

    const res = await onBatchCameraEntry({
      entries,
      location: camLocation,
      recordedBy: currentUser.name,
      detectionLog: {
        timestamp: new Date().toISOString(),
        location: camLocation,
        imageName: camImageName || 'camera-frame.jpg',
        model: camResult.model,
        totalVehicles: camResult.totalVehicles,
        breakdown: camResult.breakdown,
        detectedPlates: camResult.detectedPlates,
        summary: camResult.summary,
        recordedBy: currentUser.name,
      },
    });

    setCamLogging(false);
    if (res.error) {
      setCamCommitMsg({ type: 'err', text: res.error });
    } else {
      const skippedNote =
        res.skipped && res.skipped.length > 0 ? ` Skipped: ${res.skipped.join(', ')}.` : '';
      setCamCommitMsg({
        type: 'ok',
        text: `Logged ${res.addedCount ?? 0} AI camera vehicle record(s) into ${camLocation}.${skippedNote}`,
      });
    }
  };

  const handleSaveUserProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);
    const err = await onSaveUser(userNameInput, userEmailInput);
    if (err) {
      setUserMsg({ type: 'err', text: err });
    } else {
      setUserMsg({ type: 'ok', text: 'Operator profile saved to database.' });
      setEditingUser(false);
    }
  };

  const handleManualEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entrySubmitting) return;
    setEntryFeedback(null);

    const normalized = plateNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized.length < 3) {
      setEntryFeedback({
        type: 'err',
        text: 'Enter a valid vehicle plate / ID (at least 3 letters/digits).',
      });
      return;
    }

    const existingParked = vehicles.find(
      (v) => v.status === 'parked' && v.normalizedPlate === normalized
    );
    if (existingParked) {
      setEntryFeedback({
        type: 'err',
        text: `Duplicate entry prevented: "${existingParked.plateNumber}" is already parked at ${existingParked.location}.`,
      });
      return;
    }

    setEntrySubmitting(true);
    const err = await onVehicleEntry({
      plateNumber: plateNumber.trim().toUpperCase(),
      vehicleType,
      location: selectedLocation,
      source: 'manual',
      recordedBy: currentUser.name,
      notes: notes.trim() || undefined,
    });
    setEntrySubmitting(false);

    if (err) {
      setEntryFeedback({ type: 'err', text: err });
    } else {
      setEntryFeedback({
        type: 'ok',
        text: `Recorded manual entry for ${plateNumber.trim().toUpperCase()} at ${selectedLocation}.`,
      });
      setPlateNumber('');
      setNotes('');
    }
  };

  const parkedVehicles = useMemo(
    () => vehicles.filter((v) => v.status === 'parked'),
    [vehicles]
  );
  const exitedVehicles = useMemo(
    () => vehicles.filter((v) => v.status === 'exited'),
    [vehicles]
  );

  const filteredTableRows = useMemo(() => {
    const base = tableTab === 'parked' ? parkedVehicles : exitedVehicles;
    const q = searchQuery.trim().toLowerCase();
    return base.filter((v) => {
      if (locationFilter !== 'all' && v.location !== locationFilter) return false;
      if (sourceFilter !== 'all' && v.source !== sourceFilter) return false;
      if (!q) return true;
      return [v.plateNumber, v.vehicleType, v.location, v.recordedBy, v.notes ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [tableTab, parkedVehicles, exitedVehicles, searchQuery, locationFilter, sourceFilter]);

  const urgentZoneAlerts = liveAlerts.filter((a) => a.id.startsWith('live-'));

  return (
    <div className="space-y-6">
      {/* Mode & Live Status Banner */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm dark:shadow-none">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <CarFront className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <span>Live Parking Management &amp; Database Records</span>
            <span
              className={`text-[11px] font-mono-num px-2 py-0.5 rounded border ${
                dataMode === 'live'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              Dashboard View: {dataMode === 'live' ? 'Live Data Mode' : 'Demo Mode'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manual vehicle entries, exits, and AI camera detections persist immediately to the server database across refreshes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dataMode === 'demo' && (
            <button
              type="button"
              onClick={() => onSwitchDataMode('live')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
            >
              Switch Dashboard to Live Data Mode
            </button>
          )}
          <button
            type="button"
            onClick={onRefreshLive}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync DB
          </button>
        </div>
      </div>

      {/* Location-Specific Smart Alerts (>80% High / >=95% Critical) */}
      {urgentZoneAlerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {urgentZoneAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border text-xs ${
                alert.severity === 'critical'
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-200'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200'
              }`}
            >
              {alert.severity === 'critical' ? (
                <AlertOctagon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold">{alert.title}</div>
                <div className="mt-0.5">{alert.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Persisted User / Operator Profile Bar */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 shadow-sm dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
            <div className="text-xs">
              <span className="text-slate-500 dark:text-slate-400">Active Operator: </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {currentUser.name}
              </span>
              <span className="text-slate-400 mx-1.5">·</span>
              <span className="font-mono-num text-slate-600 dark:text-slate-300">
                {currentUser.email}
              </span>
              <span className="text-slate-400 mx-1.5">·</span>
              <span className="text-slate-500 dark:text-slate-400">
                {users.length} profile(s) saved in DB
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditingUser((v) => !v)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {editingUser ? 'Close Profile Editor' : 'Switch / Update Operator'}
          </button>
        </div>

        {editingUser && (
          <form
            onSubmit={handleSaveUserProfile}
            className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5"
          >
            <input
              type="text"
              value={userNameInput}
              onChange={(e) => setUserNameInput(e.target.value)}
              placeholder="Operator Full Name"
              className="sm:col-span-4 bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs"
            />
            <input
              type="email"
              value={userEmailInput}
              onChange={(e) => setUserEmailInput(e.target.value)}
              placeholder="operator@campus.edu"
              className="sm:col-span-5 bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="sm:col-span-3 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
            >
              Save Operator Profile
            </button>
          </form>
        )}
        {userMsg && (
          <div
            className={`mt-2 text-xs ${
              userMsg.type === 'ok'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {userMsg.text}
          </div>
        )}
      </div>

      {/* Live Zone Slot Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {liveLocationStats.map((loc) => {
          const pct = loc.avgOccupancyPct;
          const isSelected = selectedLocation === loc.location;
          const barClass =
            pct >= thresholds.criticalPct
              ? 'bg-red-600'
              : pct > thresholds.highPct
                ? 'bg-amber-500'
                : pct < thresholds.lowPct
                  ? 'bg-emerald-500'
                  : 'bg-blue-600';
          return (
            <button
              key={loc.location}
              type="button"
              onClick={() => {
                setSelectedLocation(loc.location);
                setCamLocation(loc.location);
              }}
              className={`text-left bg-white dark:bg-gradient-to-br dark:from-[#111C31] dark:to-[#0E1729] border rounded-xl p-4 transition-all shadow-sm dark:shadow-none ${
                isSelected
                  ? 'border-blue-500 ring-1 ring-blue-500/40'
                  : 'border-slate-200 dark:border-slate-800/90 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {loc.location}
                </span>
                <span
                  className={`text-[11px] font-mono-num font-semibold ${
                    pct >= thresholds.criticalPct
                      ? 'text-red-600 dark:text-red-400'
                      : pct > thresholds.highPct
                        ? 'text-amber-600 dark:text-amber-300'
                        : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {pct.toFixed(1)}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 font-mono-num text-xs">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Occupied</div>
                  <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {loc.avgOccupied}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Available</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {loc.avgAvailable}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Capacity</div>
                  <div className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {loc.totalCapacity}
                  </div>
                </div>
              </div>

              <div className="w-full h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full transition-all duration-300 ${barClass}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Manual Entry + AI Camera Vehicle Detection Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Manual Vehicle Entry Form */}
        <div className="xl:col-span-5 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Manual Vehicle Entry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Duplicate active plates are blocked automatically.
              </p>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
              Source: Manual
            </span>
          </div>

          <form onSubmit={handleManualEntrySubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                Vehicle Registration / Plate Number
              </label>
              <input
                type="text"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                placeholder="e.g., MH-12-AB-1234"
                className="w-full bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono-num text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Parking Location
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  {activeZones.map((z) => (
                    <option key={z.id} value={z.name}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  Vehicle Type
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) =>
                    setVehicleType(e.target.value as LiveVehicleRecord['vehicleType'])
                  }
                  className="w-full bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  {VEHICLE_TYPES.map((vt) => (
                    <option key={vt} value={vt}>
                      {vt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                Gate Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Visitor pass, faculty permit, etc."
                className="w-full bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={entrySubmitting || activeZones.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {entrySubmitting ? 'Recording Entry...' : 'Record Vehicle Entry'}
            </button>
          </form>

          {entryFeedback && (
            <div
              className={`rounded-lg px-3.5 py-2.5 text-xs border flex items-start gap-2 ${
                entryFeedback.type === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-200'
              }`}
            >
              {entryFeedback.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{entryFeedback.text}</span>
            </div>
          )}
        </div>

        {/* Optional AI Camera / Image Vehicle Detection Module */}
        <div className="xl:col-span-7 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  AI Camera / Image Vehicle Detection (Optional)
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Analyzes real uploaded images or live camera snapshots via server-side Gemini Vision. Zero fake detection results.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                  camPermission === 'active' || camPermission === 'granted'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                    : camPermission === 'denied' ||
                        camPermission === 'blocked_policy' ||
                        camPermission === 'insecure_context' ||
                        camPermission === 'unsupported'
                      ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60'
                      : camPermission === 'not_found' || camPermission === 'device_busy'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Camera:{' '}
                {camPermission === 'active'
                  ? 'Streaming Live'
                  : camPermission === 'granted'
                    ? 'Permission Granted'
                    : camPermission === 'denied'
                      ? 'Permission Denied'
                      : camPermission === 'blocked_policy'
                        ? 'Iframe Policy Blocked'
                        : camPermission === 'insecure_context'
                          ? 'HTTPS Required'
                          : camPermission === 'unsupported'
                            ? 'Unsupported Browser'
                            : camPermission === 'not_found'
                              ? 'No Camera Found'
                              : camPermission === 'device_busy'
                                ? 'Camera Busy'
                                : 'Ready (Click Open Camera)'}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60">
                Source: AI Camera
              </span>
            </div>
          </div>

          {/* Environment & Permission Diagnostic Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Context:{' '}
                <strong className={camEnv.secureContext ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                  {camEnv.secureContext ? 'Secure (HTTPS / Localhost)' : 'Insecure HTTP'}
                </strong>
              </span>
              <span>
                API:{' '}
                <strong className={camEnv.supported ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                  {camEnv.supported ? 'MediaDevices Ready' : 'Not Supported'}
                </strong>
              </span>
              {camEnv.inIframe && (
                <span>
                  Frame:{' '}
                  <strong className={camEnv.iframePolicyBlocked ? 'text-red-600 dark:text-red-400' : 'text-cyan-700 dark:text-cyan-300'}>
                    {camEnv.iframePolicyBlocked ? 'Blocked by Iframe Policy' : 'Embedded Frame'}
                  </strong>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={refreshCameraDiagnostics}
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh Camera
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={camLocation}
              onChange={(e) => setCamLocation(e.target.value)}
              className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              {activeZones.map((z) => (
                <option key={z.id} value={z.name}>
                  Target Zone: {z.name}
                </option>
              ))}
            </select>

            {cameraDevices.length > 0 ? (
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedCameraId(nextId);
                  if (webcamActive) {
                    void startWebcam(nextId);
                  }
                }}
                aria-label="Select camera device"
                className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 max-w-[200px]"
              >
                {cameraDevices.map((cam, idx) => (
                  <option key={cam.deviceId || idx} value={cam.deviceId}>
                    {cam.label}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={preferredFacing}
                onChange={(e) => {
                  const nextFacing = e.target.value as 'environment' | 'user';
                  setPreferredFacing(nextFacing);
                  if (webcamActive) {
                    void startWebcam('', nextFacing);
                  }
                }}
                aria-label="Camera facing preference"
                className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="environment">Rear / Main Camera</option>
                <option value="user">Front Camera</option>
              </select>
            )}

            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Upload Lot Photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>

            {!webcamActive ? (
              <>
                <button
                  type="button"
                  disabled={camStarting || !camEnv.supported || !camEnv.secureContext}
                  onClick={() => void startWebcam()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Video className="w-3.5 h-3.5" />
                  {camStarting ? 'Requesting Camera...' : 'Open Camera'}
                </button>
                {(camPermission === 'denied' ||
                  camPermission === 'blocked_policy' ||
                  camPermission === 'not_found' ||
                  camPermission === 'device_busy' ||
                  camError) && (
                  <button
                    type="button"
                    disabled={camStarting}
                    onClick={() => void startWebcam()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-medium"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Retry Camera
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!videoReady}
                  onClick={captureWebcamFrame}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {videoReady ? 'Capture Frame' : 'Initializing Video...'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopWebcam();
                    void refreshCameraDiagnostics();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 text-xs font-medium"
                >
                  <VideoOff className="w-3.5 h-3.5" />
                  Stop Camera
                </button>
              </>
            )}
          </div>

          {webcamActive && (
            <div className="rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-black relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-64 object-contain mx-auto"
              />
            </div>
          )}

          {(camPermission === 'denied' || camPermission === 'blocked_policy') && !camError && (
            <div className="bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Camera permission is currently blocked or denied. Allow camera access in browser settings and click <strong>Retry Camera</strong>, or use <strong>Upload Lot Photo</strong>.
                </span>
              </div>
              {camEnv.inIframe && typeof window !== 'undefined' && (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold underline shrink-0"
                >
                  Open in New Tab <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {camImageDataUrl && !webcamActive && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="md:col-span-5">
                <img
                  src={camImageDataUrl}
                  alt="Parking lot frame for AI detection"
                  className="w-full h-40 object-cover rounded-lg border border-slate-200 dark:border-slate-800"
                />
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 truncate">
                  {camImageName}
                </div>
              </div>

              <div className="md:col-span-7 space-y-3">
                <button
                  type="button"
                  disabled={camAnalyzing}
                  onClick={runAiVehicleDetection}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {camAnalyzing ? 'Analyzing Frame...' : 'Detect Vehicles in Image'}
                </button>

                {camResult && (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-3 font-mono-num">
                      <span className="font-bold text-slate-900 dark:text-white">
                        Detected: {camResult.totalVehicles} vehicle(s)
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        Car: {camResult.breakdown.Car} · 2W: {camResult.breakdown.TwoWheeler} · EV:{' '}
                        {camResult.breakdown.EV} · Van: {camResult.breakdown.FacultyVan}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {camResult.summary}
                    </p>
                    {camResult.detectedPlates.length > 0 && (
                      <div className="text-[11px] font-mono-num text-cyan-700 dark:text-cyan-300">
                        Readable Plates: {camResult.detectedPlates.join(', ')}
                      </div>
                    )}
                    {camResult.warnings.length > 0 && (
                      <div className="text-[11px] text-amber-600 dark:text-amber-300">
                        Note: {camResult.warnings.join(' ')}
                      </div>
                    )}
                    {camResult.totalVehicles > 0 && (
                      <button
                        type="button"
                        disabled={camLogging}
                        onClick={handleCommitDetectedVehicles}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {camLogging
                          ? 'Logging Detected Vehicles...'
                          : `Log ${camResult.totalVehicles} AI-Detected Vehicle(s) to ${camLocation}`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {camError && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-200 text-xs rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <span>{camError}</span>
              {camEnv.inIframe &&
                (camPermission === 'denied' || camPermission === 'blocked_policy') &&
                typeof window !== 'undefined' && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold underline shrink-0"
                  >
                    Open in New Tab <ExternalLink className="w-3 h-3" />
                  </a>
                )}
            </div>
          )}

          {camCommitMsg && (
            <div
              className={`rounded-lg px-3.5 py-2.5 text-xs border ${
                camCommitMsg.type === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-200'
              }`}
            >
              {camCommitMsg.text}
            </div>
          )}

          {cameraDetections.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Recent AI Camera Detection Runs ({cameraDetections.length})
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto text-[11px]">
                {cameraDetections.slice(0, 4).map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-slate-300"
                  >
                    <span>
                      <strong>{log.location}</strong> · {log.totalVehicles} detected (
                      {log.vehiclesLogged} logged) · {log.imageName}
                    </span>
                    <span className="font-mono-num text-slate-400">
                      {formatDateTime(log.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Parked Vehicles & Exit Management Table */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTableTab('parked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tableTab === 'parked'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Currently Parked ({parkedVehicles.length})
            </button>
            <button
              type="button"
              onClick={() => setTableTab('exited')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tableTab === 'exited'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Exited History ({exitedVehicles.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plate or operator..."
                className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Locations</option>
              {activeZones.map((z) => (
                <option key={z.id} value={z.name}>
                  {z.name}
                </option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(e.target.value as 'all' | 'manual' | 'ai_camera')
              }
              className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Sources</option>
              <option value="manual">Manual Entry Only</option>
              <option value="ai_camera">AI Camera Only</option>
            </select>

            {tableTab === 'exited' && exitedVehicles.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearExited(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 text-xs font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Exited
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-3 font-medium">Plate / ID</th>
                <th className="py-2.5 px-2.5 font-medium">Vehicle</th>
                <th className="py-2.5 px-2.5 font-medium">Location</th>
                <th className="py-2.5 px-2.5 font-medium">Entry Method</th>
                <th className="py-2.5 px-2.5 font-medium">Entry Time</th>
                <th className="py-2.5 px-2.5 font-medium">
                  {tableTab === 'parked' ? 'Duration' : 'Exit Time'}
                </th>
                <th className="py-2.5 px-2.5 font-medium">Operator</th>
                {tableTab === 'parked' && (
                  <th className="py-2.5 pl-2.5 text-right font-medium">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
              {filteredTableRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableTab === 'parked' ? 8 : 7}
                    className="py-8 text-center text-slate-400"
                  >
                    {tableTab === 'parked'
                      ? 'No vehicles currently parked matching your filters. Record an entry above.'
                      : 'No exited vehicle records yet.'}
                  </td>
                </tr>
              ) : (
                filteredTableRows.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/35">
                    <td className="py-2.5 pr-3 font-mono-num font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {v.plateNumber}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-700 dark:text-slate-300">
                      {v.vehicleType}
                    </td>
                    <td className="py-2.5 px-2.5 font-medium text-slate-800 dark:text-slate-200">
                      {v.location}
                    </td>
                    <td className="py-2.5 px-2.5">
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded border ${
                          v.source === 'ai_camera'
                            ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60'
                            : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
                        }`}
                      >
                        {v.source === 'ai_camera' ? 'AI Camera' : 'Manual Entry'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 font-mono-num text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatDateTime(v.entryTime)}
                    </td>
                    <td className="py-2.5 px-2.5 font-mono-num text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {tableTab === 'parked'
                        ? formatDuration(v.entryTime, null)
                        : formatDateTime(v.exitTime)}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                      {v.recordedBy}
                    </td>
                    {tableTab === 'parked' && (
                      <td className="py-2.5 pl-2.5 text-right">
                        <button
                          type="button"
                          disabled={exitingId === v.id}
                          onClick={async () => {
                            setExitingId(v.id);
                            const err = await onVehicleExit(v.id);
                            setExitingId(null);
                            if (err) {
                              setEntryFeedback({ type: 'err', text: err });
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-medium whitespace-nowrap"
                        >
                          <LogOut className="w-3 h-3" />
                          {exitingId === v.id ? 'Exiting...' : 'Record Exit'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Clear Exited Confirmation Modal */}
      {confirmClearExited && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Clear Exited Vehicle Log?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will clear {exitedVehicles.length} completed exit row(s) from the vehicle log table while keeping currently parked vehicles and historical occupancy trends intact.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmClearExited(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onClearExited();
                  setConfirmClearExited(false);
                }}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium"
              >
                Clear Exited Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
