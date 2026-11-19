import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = path.join(__dirname, '.data');
const STATE_FILE = path.join(DATA_DIR, 'admin-state.json');
const LIVE_DB_FILE = path.join(DATA_DIR, 'parking-db.json');

const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.createHash('sha256').update(__dirname).digest('hex');
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'CAMPUS-ADMIN-2026';

interface ZoneConfig {
  id: string;
  name: string;
  code: string;
  capacity: number;
  category: 'Academic' | 'Gate' | 'Residential' | 'Recreation' | 'Dining';
  mapX: number;
  mapY: number;
  active: boolean;
}

interface ThresholdConfig {
  lowPct: number;
  highPct: number;
  criticalPct: number;
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  actorRole: 'admin' | 'viewer';
  action: string;
  details: string;
}

interface PersistedAdminState {
  zones: ZoneConfig[];
  thresholds: ThresholdConfig;
  activityLog: ActivityEntry[];
}

const DEFAULT_STATE: PersistedAdminState = {
  zones: [
    {
      id: 'zone-main-gate',
      name: 'Main Gate Parking',
      code: 'MG-01',
      capacity: 150,
      category: 'Gate',
      mapX: 16,
      mapY: 72,
      active: true,
    },
    {
      id: 'zone-academic',
      name: 'Academic Block Parking',
      code: 'AB-02',
      capacity: 200,
      category: 'Academic',
      mapX: 46,
      mapY: 36,
      active: true,
    },
    {
      id: 'zone-library',
      name: 'Library Parking',
      code: 'LB-03',
      capacity: 120,
      category: 'Academic',
      mapX: 74,
      mapY: 32,
      active: true,
    },
    {
      id: 'zone-canteen',
      name: 'Canteen Parking',
      code: 'CT-04',
      capacity: 90,
      category: 'Dining',
      mapX: 52,
      mapY: 66,
      active: true,
    },
    {
      id: 'zone-hostel',
      name: 'Hostel Parking',
      code: 'HS-05',
      capacity: 180,
      category: 'Residential',
      mapX: 20,
      mapY: 24,
      active: true,
    },
    {
      id: 'zone-sports',
      name: 'Sports Complex Parking',
      code: 'SC-06',
      capacity: 100,
      category: 'Recreation',
      mapX: 80,
      mapY: 70,
      active: true,
    },
  ],
  thresholds: {
    lowPct: 30,
    highPct: 80,
    criticalPct: 95,
  },
  activityLog: [
    {
      id: 'init-1',
      timestamp: new Date().toISOString(),
      actorRole: 'admin',
      action: 'Platform Initialized',
      details: 'Loaded default 6 campus parking zones and standard occupancy thresholds (30% / 80% / 95%).',
    },
  ],
};

function readAdminState(): PersistedAdminState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as Partial<PersistedAdminState>;
      return {
        zones: Array.isArray(parsed.zones) && parsed.zones.length > 0 ? parsed.zones : DEFAULT_STATE.zones,
        thresholds: parsed.thresholds ?? DEFAULT_STATE.thresholds,
        activityLog: Array.isArray(parsed.activityLog) ? parsed.activityLog : DEFAULT_STATE.activityLog,
      };
    }
  } catch {
    // Fallback to default state if corrupted
  }
  return structuredClone(DEFAULT_STATE);
}

function writeAdminState(state: PersistedAdminState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, STATE_FILE);
}

function appendActivity(
  state: PersistedAdminState,
  actorRole: 'admin' | 'viewer',
  action: string,
  details: string
): void {
  state.activityLog = [
    {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actorRole,
      action,
      details,
    },
    ...state.activityLog,
  ].slice(0, 100);
}

interface LiveVehicleRecord {
  id: string;
  plateNumber: string;
  normalizedPlate: string;
  vehicleType: 'Car' | 'Two-Wheeler' | 'EV' | 'Faculty Van';
  location: string;
  entryTime: string;
  exitTime: string | null;
  status: 'parked' | 'exited';
  source: 'manual' | 'ai_camera';
  recordedBy: string;
  notes?: string;
}

interface LiveParkingRecord {
  Date: string;
  Time: string;
  Day: string;
  Parking_Location: string;
  Total_Capacity: number;
  Occupied_Spaces: number;
  Available_Spaces: number;
  Occupancy_Percentage: number;
  Vehicle_Type: string;
  Hour: number;
  Time_Period: string;
  Source?: 'manual' | 'ai_camera' | 'csv' | 'simulated';
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  createdAt: string;
  lastActiveAt: string;
}

interface ImportHistoryEntry {
  id: string;
  timestamp: string;
  fileName: string;
  mode: 'sample' | 'replace' | 'append' | 'live_db';
  rawRows: number;
  cleanedRows: number;
  qualityScore: number;
}

interface CameraDetectionLog {
  id: string;
  timestamp: string;
  location: string;
  imageName: string;
  model: string;
  totalVehicles: number;
  breakdown: {
    Car: number;
    TwoWheeler: number;
    EV: number;
    FacultyVan: number;
  };
  detectedPlates: string[];
  summary: string;
  vehiclesLogged: number;
  recordedBy: string;
}

interface LiveDatabaseState {
  vehicles: LiveVehicleRecord[];
  parkingHistory: LiveParkingRecord[];
  users: UserProfile[];
  importHistory: ImportHistoryEntry[];
  cameraDetections: CameraDetectionLog[];
}

const DEFAULT_LIVE_DB: LiveDatabaseState = {
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
};

function readLiveDb(): LiveDatabaseState {
  try {
    if (fs.existsSync(LIVE_DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LIVE_DB_FILE, 'utf8')) as Partial<LiveDatabaseState>;
      return {
        vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
        parkingHistory: Array.isArray(parsed.parkingHistory) ? parsed.parkingHistory : [],
        users:
          Array.isArray(parsed.users) && parsed.users.length > 0
            ? parsed.users
            : structuredClone(DEFAULT_LIVE_DB.users),
        importHistory: Array.isArray(parsed.importHistory) ? parsed.importHistory : [],
        cameraDetections: Array.isArray(parsed.cameraDetections) ? parsed.cameraDetections : [],
      };
    }
  } catch {
    // Fall back to empty default live DB if corrupted
  }
  return structuredClone(DEFAULT_LIVE_DB);
}

function writeLiveDb(db: LiveDatabaseState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${LIVE_DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, LIVE_DB_FILE);
}

const VALID_VEHICLE_TYPES = new Set(['Car', 'Two-Wheeler', 'EV', 'Faculty Van']);

function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatDayName(d: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[d.getDay()] ?? 'Monday';
}

function classifyPeriod(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Morning (05:00-11:59)';
  if (hour >= 12 && hour < 16) return 'Afternoon (12:00-15:59)';
  if (hour >= 16 && hour < 20) return 'Evening (16:00-19:59)';
  return 'Night (20:00-04:59)';
}

function buildSnapshotRecord(
  zone: ZoneConfig,
  occupiedCount: number,
  vehicleType: string,
  source: 'manual' | 'ai_camera',
  when: Date = new Date()
): LiveParkingRecord {
  const cap = Math.max(1, zone.capacity);
  const occ = Math.max(0, Math.min(cap, occupiedCount));
  const avail = Math.max(0, cap - occ);
  const pct = Number(((occ / cap) * 100).toFixed(2));
  const hour = when.getHours();
  const dateStr = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(
    when.getDate()
  ).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;

  return {
    Date: dateStr,
    Time: timeStr,
    Day: formatDayName(when),
    Parking_Location: zone.name,
    Total_Capacity: cap,
    Occupied_Spaces: occ,
    Available_Spaces: avail,
    Occupancy_Percentage: pct,
    Vehicle_Type: vehicleType,
    Hour: hour,
    Time_Period: classifyPeriod(hour),
    Source: source,
  };
}

function signToken(role: 'admin' | 'viewer'): string {
  const payload = Buffer.from(
    JSON.stringify({ role, iat: Date.now() }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string | undefined): { role: 'admin' | 'viewer' } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
    };
    if (parsed.role === 'admin' || parsed.role === 'viewer') {
      return { role: parsed.role };
    }
  } catch {
    return null;
  }
  return null;
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [k, v] = part.trim().split('=');
      if (k === 'cpma_session') return decodeURIComponent(v ?? '');
    }
  }
  return undefined;
}

function requireAdminRole(req: Request, res: Response, next: NextFunction): void {
  const verified = verifyToken(extractToken(req));
  if (!verified || verified.role !== 'admin') {
    res.status(403).json({
      error: 'Admin role required. Sign in as Parking Admin to modify zones or thresholds.',
    });
    return;
  }
  next();
}

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function createApp(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  // Auth / Role Session Endpoint
  app.get('/api/auth/session', (req, res) => {
    const verified = verifyToken(extractToken(req));
    res.json({ role: verified?.role ?? 'viewer' });
  });

  app.post('/api/auth/session', (req, res) => {
    const { role, passcode } = (req.body ?? {}) as { role?: string; passcode?: string };
    if (role === 'admin') {
      if (!passcode || passcode !== ADMIN_PASSCODE) {
        res.status(401).json({
          error: 'Invalid Parking Admin passcode.',
        });
        return;
      }
      const token = signToken('admin');
      res.setHeader(
        'Set-Cookie',
        `cpma_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`
      );
      const state = readAdminState();
      appendActivity(state, 'admin', 'Admin Session Started', 'Authenticated as Parking Admin.');
      writeAdminState(state);
      res.json({ role: 'admin', token, activityLog: state.activityLog });
      return;
    }

    const token = signToken('viewer');
    res.setHeader(
      'Set-Cookie',
      `cpma_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`
    );
    res.json({ role: 'viewer', token });
  });

  // Admin State & Zone Management Endpoints (Protected by requireAdminRole on writes)
  app.get('/api/admin/state', (_req, res) => {
    const state = readAdminState();
    res.json(state);
  });

  app.post('/api/admin/zones', requireAdminRole, (req, res) => {
    const body = req.body as Partial<ZoneConfig>;
    if (!body.name || typeof body.capacity !== 'number' || body.capacity <= 0) {
      res.status(400).json({ error: 'Zone name and positive numeric capacity are required.' });
      return;
    }
    const state = readAdminState();
    if (state.zones.some((z) => z.name.toLowerCase() === body.name!.trim().toLowerCase())) {
      res.status(409).json({ error: `Parking zone "${body.name}" already exists.` });
      return;
    }
    const newZone: ZoneConfig = {
      id: `zone-${crypto.randomUUID().slice(0, 8)}`,
      name: body.name.trim(),
      code: (body.code?.trim() || `ZN-${state.zones.length + 1}`).toUpperCase(),
      capacity: Math.round(body.capacity),
      category: body.category ?? 'Academic',
      mapX: typeof body.mapX === 'number' ? Math.max(8, Math.min(92, body.mapX)) : 50,
      mapY: typeof body.mapY === 'number' ? Math.max(12, Math.min(88, body.mapY)) : 50,
      active: body.active ?? true,
    };
    state.zones.push(newZone);
    appendActivity(
      state,
      'admin',
      'Zone Added',
      `Added "${newZone.name}" (${newZone.code}) with capacity ${newZone.capacity} bays.`
    );
    writeAdminState(state);
    res.status(201).json(state);
  });

  app.put('/api/admin/zones/:id', requireAdminRole, (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<ZoneConfig>;
    const state = readAdminState();
    const idx = state.zones.findIndex((z) => z.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Parking zone not found.' });
      return;
    }
    const current = state.zones[idx];
    const nextCap =
      typeof body.capacity === 'number' && body.capacity > 0
        ? Math.round(body.capacity)
        : current.capacity;
    const updated: ZoneConfig = {
      ...current,
      name: body.name?.trim() || current.name,
      code: body.code?.trim().toUpperCase() || current.code,
      capacity: nextCap,
      category: body.category ?? current.category,
      mapX: typeof body.mapX === 'number' ? Math.max(8, Math.min(92, body.mapX)) : current.mapX,
      mapY: typeof body.mapY === 'number' ? Math.max(12, Math.min(88, body.mapY)) : current.mapY,
      active: typeof body.active === 'boolean' ? body.active : current.active,
    };
    state.zones[idx] = updated;
    appendActivity(
      state,
      'admin',
      'Zone Updated',
      `Updated "${updated.name}" (capacity: ${updated.capacity}, active: ${updated.active}).`
    );
    writeAdminState(state);
    res.json(state);
  });

  app.delete('/api/admin/zones/:id', requireAdminRole, (req, res) => {
    const { id } = req.params;
    const state = readAdminState();
    const target = state.zones.find((z) => z.id === id);
    if (!target) {
      res.status(404).json({ error: 'Parking zone not found.' });
      return;
    }
    state.zones = state.zones.filter((z) => z.id !== id);
    appendActivity(state, 'admin', 'Zone Deleted', `Removed parking zone "${target.name}".`);
    writeAdminState(state);
    res.json(state);
  });

  app.put('/api/admin/thresholds', requireAdminRole, (req, res) => {
    const body = req.body as Partial<ThresholdConfig>;
    const low = Number(body.lowPct);
    const high = Number(body.highPct);
    const critical = Number(body.criticalPct);
    if (
      Number.isNaN(low) ||
      Number.isNaN(high) ||
      Number.isNaN(critical) ||
      low < 5 ||
      low >= high ||
      high >= critical ||
      critical > 100
    ) {
      res.status(400).json({
        error: 'Thresholds must satisfy: 5 <= Low < High < Critical <= 100.',
      });
      return;
    }
    const state = readAdminState();
    state.thresholds = { lowPct: low, highPct: high, criticalPct: critical };
    appendActivity(
      state,
      'admin',
      'Thresholds Updated',
      `Set occupancy thresholds to Low <${low}%, High >${high}%, Critical >${critical}%.`
    );
    writeAdminState(state);
    res.json(state);
  });

  app.post('/api/admin/activity', (req, res) => {
    const { action, details } = (req.body ?? {}) as { action?: string; details?: string };
    if (!action || !details) {
      res.status(400).json({ error: 'action and details required.' });
      return;
    }
    const verified = verifyToken(extractToken(req));
    const state = readAdminState();
    appendActivity(state, verified?.role ?? 'viewer', action, details);
    writeAdminState(state);
    res.json({ activityLog: state.activityLog });
  });

  // Live Database & Vehicle Management Endpoints
  app.get('/api/live/state', (_req, res) => {
    try {
      const db = readLiveDb();
      res.json(db);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load live parking database.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/live/users', (req, res) => {
    try {
      const { name, email, role } = (req.body ?? {}) as {
        name?: string;
        email?: string;
        role?: 'admin' | 'operator' | 'viewer';
      };
      const cleanName = (name ?? '').trim();
      const cleanEmail = (email ?? '').trim().toLowerCase();
      if (!cleanName || !cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Valid user name and email address are required.' });
        return;
      }
      const db = readLiveDb();
      const now = new Date().toISOString();
      const existingIdx = db.users.findIndex((u) => u.email.toLowerCase() === cleanEmail);
      let user: UserProfile;
      if (existingIdx !== -1) {
        user = {
          ...db.users[existingIdx],
          name: cleanName,
          role: role === 'admin' || role === 'operator' || role === 'viewer' ? role : db.users[existingIdx].role,
          lastActiveAt: now,
        };
        db.users[existingIdx] = user;
      } else {
        user = {
          id: `usr-${crypto.randomUUID().slice(0, 8)}`,
          name: cleanName,
          email: cleanEmail,
          role: role === 'admin' || role === 'operator' || role === 'viewer' ? role : 'operator',
          createdAt: now,
          lastActiveAt: now,
        };
        db.users.unshift(user);
      }
      writeLiveDb(db);
      res.json({ user, users: db.users });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save user profile.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/live/vehicles/entry', (req, res) => {
    try {
      const { plateNumber, vehicleType, location, source, recordedBy, notes } = (req.body ?? {}) as {
        plateNumber?: string;
        vehicleType?: string;
        location?: string;
        source?: 'manual' | 'ai_camera';
        recordedBy?: string;
        notes?: string;
      };

      const rawPlate = (plateNumber ?? '').trim().toUpperCase();
      const norm = normalizePlate(rawPlate);
      if (!rawPlate || norm.length < 3) {
        res.status(400).json({ error: 'Enter a valid vehicle plate / ID (minimum 3 alphanumeric characters).' });
        return;
      }

      const vType = (VALID_VEHICLE_TYPES.has(vehicleType ?? '')
        ? vehicleType
        : 'Car') as LiveVehicleRecord['vehicleType'];

      const adminState = readAdminState();
      const zone = adminState.zones.find(
        (z) => z.name.toLowerCase() === (location ?? '').trim().toLowerCase()
      );
      if (!zone) {
        res.status(400).json({ error: 'Selected parking location does not exist in campus zones.' });
        return;
      }
      if (!zone.active) {
        res.status(400).json({ error: `${zone.name} is currently disabled by Admin.` });
        return;
      }

      const db = readLiveDb();
      const duplicate = db.vehicles.find(
        (v) => v.status === 'parked' && v.normalizedPlate === norm
      );
      if (duplicate) {
        res.status(409).json({
          error: `Duplicate entry prevented: Vehicle "${duplicate.plateNumber}" is already parked at ${duplicate.location} since ${duplicate.entryTime.slice(0, 16).replace('T', ' ')}.`,
        });
        return;
      }

      const activeInZone = db.vehicles.filter(
        (v) => v.status === 'parked' && v.location === zone.name
      ).length;
      if (activeInZone >= zone.capacity) {
        res.status(409).json({
          error: `${zone.name} is full (${activeInZone}/${zone.capacity} slots occupied). Exit a vehicle or select another lot.`,
        });
        return;
      }

      const entrySource: 'manual' | 'ai_camera' = source === 'ai_camera' ? 'ai_camera' : 'manual';
      const now = new Date();
      const record: LiveVehicleRecord = {
        id: `veh-${crypto.randomUUID().slice(0, 10)}`,
        plateNumber: rawPlate,
        normalizedPlate: norm,
        vehicleType: vType,
        location: zone.name,
        entryTime: now.toISOString(),
        exitTime: null,
        status: 'parked',
        source: entrySource,
        recordedBy: (recordedBy ?? 'Campus Gate Operator').trim() || 'Campus Gate Operator',
        notes: notes?.trim() || undefined,
      };

      db.vehicles.unshift(record);
      const nextOccupied = activeInZone + 1;
      db.parkingHistory.push(buildSnapshotRecord(zone, nextOccupied, vType, entrySource, now));
      writeLiveDb(db);

      appendActivity(
        adminState,
        'viewer',
        entrySource === 'ai_camera' ? 'AI Camera Vehicle Entry' : 'Manual Vehicle Entry',
        `${record.plateNumber} (${record.vehicleType}) entered ${zone.name} [${nextOccupied}/${zone.capacity} occupied].`
      );
      writeAdminState(adminState);

      res.status(201).json({ record, state: db, activityLog: adminState.activityLog });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to record vehicle entry.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/live/vehicles/batch-entry', (req, res) => {
    try {
      const { entries, location, recordedBy, detectionLog } = (req.body ?? {}) as {
        entries?: Array<{ plateNumber: string; vehicleType: string; notes?: string }>;
        location?: string;
        recordedBy?: string;
        detectionLog?: Omit<CameraDetectionLog, 'id' | 'vehiclesLogged'>;
      };

      if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: 'Provide at least one detected vehicle entry to log.' });
        return;
      }

      const adminState = readAdminState();
      const zone = adminState.zones.find(
        (z) => z.name.toLowerCase() === (location ?? '').trim().toLowerCase()
      );
      if (!zone || !zone.active) {
        res.status(400).json({ error: 'Selected parking location is unavailable or disabled.' });
        return;
      }

      const db = readLiveDb();
      let activeInZone = db.vehicles.filter(
        (v) => v.status === 'parked' && v.location === zone.name
      ).length;

      const added: LiveVehicleRecord[] = [];
      const skipped: string[] = [];
      const now = new Date();

      for (const item of entries) {
        if (activeInZone >= zone.capacity) {
          skipped.push(`${item.plateNumber} (zone full)`);
          continue;
        }
        const rawPlate = (item.plateNumber ?? '').trim().toUpperCase();
        const norm = normalizePlate(rawPlate);
        if (!rawPlate || norm.length < 3) {
          skipped.push(`${item.plateNumber || 'blank'} (invalid plate)`);
          continue;
        }
        const dup = db.vehicles.find((v) => v.status === 'parked' && v.normalizedPlate === norm);
        if (dup) {
          skipped.push(`${rawPlate} (already parked at ${dup.location})`);
          continue;
        }
        const vType = (VALID_VEHICLE_TYPES.has(item.vehicleType)
          ? item.vehicleType
          : 'Car') as LiveVehicleRecord['vehicleType'];

        const rec: LiveVehicleRecord = {
          id: `veh-${crypto.randomUUID().slice(0, 10)}`,
          plateNumber: rawPlate,
          normalizedPlate: norm,
          vehicleType: vType,
          location: zone.name,
          entryTime: now.toISOString(),
          exitTime: null,
          status: 'parked',
          source: 'ai_camera',
          recordedBy: (recordedBy ?? 'Campus Gate Operator').trim() || 'Campus Gate Operator',
          notes: item.notes?.trim() || 'Logged from AI Camera Detection',
        };
        db.vehicles.unshift(rec);
        added.push(rec);
        activeInZone += 1;
        db.parkingHistory.push(buildSnapshotRecord(zone, activeInZone, vType, 'ai_camera', now));
      }

      if (detectionLog) {
        db.cameraDetections.unshift({
          ...detectionLog,
          id: `cam-${crypto.randomUUID().slice(0, 8)}`,
          vehiclesLogged: added.length,
        });
        db.cameraDetections = db.cameraDetections.slice(0, 50);
      }

      writeLiveDb(db);
      appendActivity(
        adminState,
        'viewer',
        'AI Camera Batch Logged',
        `Logged ${added.length} detected vehicle(s) into ${zone.name}${skipped.length > 0 ? ` (${skipped.length} skipped)` : ''}.`
      );
      writeAdminState(adminState);

      res.status(201).json({
        addedCount: added.length,
        skipped,
        state: db,
        activityLog: adminState.activityLog,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to batch log detected vehicles.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/live/vehicles/:id/exit', (req, res) => {
    try {
      const { id } = req.params;
      const db = readLiveDb();
      const idx = db.vehicles.findIndex((v) => v.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Vehicle record not found.' });
        return;
      }
      const current = db.vehicles[idx];
      if (current.status === 'exited') {
        res.status(409).json({ error: `Vehicle "${current.plateNumber}" has already exited.` });
        return;
      }

      const now = new Date();
      db.vehicles[idx] = {
        ...current,
        status: 'exited',
        exitTime: now.toISOString(),
      };

      const adminState = readAdminState();
      const zone = adminState.zones.find((z) => z.name === current.location);
      const remainingInZone = db.vehicles.filter(
        (v) => v.status === 'parked' && v.location === current.location
      ).length;

      if (zone) {
        db.parkingHistory.push(
          buildSnapshotRecord(zone, remainingInZone, current.vehicleType, current.source, now)
        );
      }
      writeLiveDb(db);

      appendActivity(
        adminState,
        'viewer',
        'Vehicle Exit Recorded',
        `${current.plateNumber} exited ${current.location} [${remainingInZone}/${zone?.capacity ?? '?'} occupied].`
      );
      writeAdminState(adminState);

      res.json({ record: db.vehicles[idx], state: db, activityLog: adminState.activityLog });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to record vehicle exit.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/live/vehicles/exited', (_req, res) => {
    try {
      const db = readLiveDb();
      db.vehicles = db.vehicles.filter((v) => v.status === 'parked');
      writeLiveDb(db);
      res.json({ state: db });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to clear exited records.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/live/import-csv', (req, res) => {
    try {
      const { mode, records, cleaningReport, fileName } = (req.body ?? {}) as {
        mode?: 'replace' | 'append';
        records?: LiveParkingRecord[];
        cleaningReport?: { rawRows?: number; cleanedRows?: number; qualityScore?: number };
        fileName?: string;
      };

      if (!Array.isArray(records) || records.length === 0) {
        res.status(400).json({ error: 'Cannot import empty record set into database.' });
        return;
      }

      const validRecords: LiveParkingRecord[] = [];
      for (const r of records) {
        if (
          typeof r.Date === 'string' &&
          typeof r.Time === 'string' &&
          typeof r.Parking_Location === 'string' &&
          typeof r.Total_Capacity === 'number' &&
          r.Total_Capacity > 0 &&
          typeof r.Occupied_Spaces === 'number' &&
          r.Occupied_Spaces >= 0
        ) {
          const cap = Math.round(r.Total_Capacity);
          const occ = Math.min(cap, Math.round(r.Occupied_Spaces));
          const avail = Math.max(0, cap - occ);
          const pct = Number(((occ / cap) * 100).toFixed(2));
          validRecords.push({
            ...r,
            Total_Capacity: cap,
            Occupied_Spaces: occ,
            Available_Spaces: avail,
            Occupancy_Percentage: pct,
            Source: 'csv',
          });
        }
      }

      if (validRecords.length === 0) {
        res.status(400).json({ error: 'No valid CSV parking rows passed server validation.' });
        return;
      }

      const db = readLiveDb();
      if (mode === 'replace') {
        db.parkingHistory = validRecords;
      } else {
        const seen = new Set(
          db.parkingHistory.map(
            (r) => `${r.Date}|${r.Time}|${r.Parking_Location}|${r.Vehicle_Type}|${r.Occupied_Spaces}`
          )
        );
        for (const r of validRecords) {
          const k = `${r.Date}|${r.Time}|${r.Parking_Location}|${r.Vehicle_Type}|${r.Occupied_Spaces}`;
          if (!seen.has(k)) {
            seen.add(k);
            db.parkingHistory.push(r);
          }
        }
      }

      db.importHistory.unshift({
        id: `imp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        fileName: fileName || 'imported_dataset.csv',
        mode: 'live_db',
        rawRows: cleaningReport?.rawRows ?? validRecords.length,
        cleanedRows: validRecords.length,
        qualityScore: cleaningReport?.qualityScore ?? 100,
      });
      db.importHistory = db.importHistory.slice(0, 30);

      writeLiveDb(db);

      const adminState = readAdminState();
      appendActivity(
        adminState,
        'viewer',
        'CSV Imported to Database',
        `${mode === 'replace' ? 'Replaced live history with' : 'Appended'} "${fileName ?? 'CSV'}" (${validRecords.length} rows).`
      );
      writeAdminState(adminState);

      res.json({ importedCount: validRecords.length, state: db, activityLog: adminState.activityLog });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import CSV into database.';
      res.status(500).json({ error: message });
    }
  });

  // Real Gemini Vision Camera/Image Vehicle Detection (NO fake detections)
  app.post('/api/detect-vehicles', async (req, res) => {
    const { imageBase64, mimeType, location } = (req.body ?? {}) as {
      imageBase64?: string;
      mimeType?: string;
      location?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'An image or camera capture frame is required for vehicle detection.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        configured: false,
        error:
          'Gemini Vision API is unavailable because GEMINI_API_KEY is not configured. Fake detection results are disabled—configure GEMINI_API_KEY in Secrets or use Manual Vehicle Entry.',
      });
      return;
    }

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const safeMime =
      mimeType && /^image\/(png|jpeg|jpg|webp)$/i.test(mimeType) ? mimeType : 'image/jpeg';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: safeMime,
            },
          },
          {
            text: `Inspect this parking image${location ? ` from ${location}` : ''} accurately. Count ONLY visible parked or entering vehicles. Classify counts into Car, TwoWheeler (motorcycles/scooters), EV (explicit electric vehicles/charging bays if identifiable, otherwise Car), and FacultyVan (vans/minibuses/SUV shuttles). Extract any clearly readable license plates as uppercase strings (do NOT guess or invent unreadable plates—leave detectedPlates empty if unreadable). If the image does not show vehicles or is too blurry, report totalVehicles as 0 and explain in warnings.`,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              totalVehicles: { type: Type.INTEGER },
              breakdown: {
                type: Type.OBJECT,
                properties: {
                  Car: { type: Type.INTEGER },
                  TwoWheeler: { type: Type.INTEGER },
                  EV: { type: Type.INTEGER },
                  FacultyVan: { type: Type.INTEGER },
                },
                required: ['Car', 'TwoWheeler', 'EV', 'FacultyVan'],
              },
              detectedPlates: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              summary: { type: Type.STRING },
              warnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['totalVehicles', 'breakdown', 'detectedPlates', 'summary', 'warnings'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
        totalVehicles?: number;
        breakdown?: { Car?: number; TwoWheeler?: number; EV?: number; FacultyVan?: number };
        detectedPlates?: string[];
        summary?: string;
        warnings?: string[];
      };

      const car = Math.max(0, Math.round(parsed.breakdown?.Car ?? 0));
      const tw = Math.max(0, Math.round(parsed.breakdown?.TwoWheeler ?? 0));
      const ev = Math.max(0, Math.round(parsed.breakdown?.EV ?? 0));
      const fv = Math.max(0, Math.round(parsed.breakdown?.FacultyVan ?? 0));
      const sumBreakdown = car + tw + ev + fv;
      const totalVehicles = Math.max(sumBreakdown, Math.max(0, Math.round(parsed.totalVehicles ?? 0)));

      res.json({
        configured: true,
        model: 'gemini-4-hydrogen',
        totalVehicles,
        breakdown: {
          Car: car,
          TwoWheeler: tw,
          EV: ev,
          FacultyVan: fv,
        },
        detectedPlates: Array.isArray(parsed.detectedPlates)
          ? parsed.detectedPlates.map((p) => String(p).trim().toUpperCase()).filter(Boolean)
          : [],
        summary: parsed.summary ?? `Detected ${totalVehicles} vehicle(s) in uploaded frame.`,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gemini Vision detection failed.';
      res.status(502).json({
        configured: true,
        error: `AI vehicle detection failed: ${message}`,
      });
    }
  });

  // AI Parking Assistant Endpoint
  app.post('/api/assistant', async (req, res) => {
    const { question, contextSummary } = (req.body ?? {}) as {
      question?: string;
      contextSummary?: unknown;
    };

    if (!question || !question.trim()) {
      res.status(400).json({ error: 'Please provide a question for the parking assistant.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.json({
        configured: false,
        mode: 'local_dataset_engine',
        answer: null,
      });
      return;
    }

    try {
      const systemInstruction =
        'You are the Campus Parking Analytics AI Assistant. Answer strictly using the verified dataset metrics provided in the JSON context. Never invent numbers, sensor readings, or locations not present in the context. Keep answers concise, structured with exact figures, percentages, and actionable insights. If the dataset is simulated, acknowledge it accurately when relevant.';

      const prompt = `Dataset Context (calculated dynamically from the active filtered dataset):\n${JSON.stringify(
        contextSummary,
        null,
        2
      )}\n\nUser Question: ${question.trim()}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({
        configured: true,
        mode: 'gemini',
        model: 'gemini-4-hydrogen',
        answer: response.text ?? 'Unable to generate a response from the dataset context.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upstream Gemini API error';
      res.status(502).json({
        configured: true,
        error: `Gemini API request failed: ${message}. Check Settings > Secrets if the key is invalid or quota is exceeded.`,
      });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, geminiConfigured: Boolean(getGeminiClient()) });
  });

  if (!IS_PROD) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Campus Parking Analytics 2.0 server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp();
