export type PageId =
  | 'overview'
  | 'live'
  | 'analytics'
  | 'locations'
  | 'comparison'
  | 'time-day'
  | 'predictions'
  | 'assistant'
  | 'alerts'
  | 'explorer'
  | 'reports'
  | 'admin'
  | 'insights'
  | 'about';

export type DataMode = 'demo' | 'live';

export type RecordSource = 'manual' | 'ai_camera' | 'csv' | 'simulated';

export interface ParkingRecord {
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
  Source?: RecordSource;
}

export interface LiveVehicleRecord {
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

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  createdAt: string;
  lastActiveAt: string;
}

export interface CameraDetectionBreakdown {
  Car: number;
  TwoWheeler: number;
  EV: number;
  FacultyVan: number;
}

export interface CameraDetectionResult {
  configured: boolean;
  model: string;
  totalVehicles: number;
  breakdown: CameraDetectionBreakdown;
  detectedPlates: string[];
  summary: string;
  warnings: string[];
}

export interface CameraDetectionLog {
  id: string;
  timestamp: string;
  location: string;
  imageName: string;
  model: string;
  totalVehicles: number;
  breakdown: CameraDetectionBreakdown;
  detectedPlates: string[];
  summary: string;
  vehiclesLogged: number;
  recordedBy: string;
}

export interface LiveDatabaseState {
  vehicles: LiveVehicleRecord[];
  parkingHistory: ParkingRecord[];
  users: UserProfile[];
  importHistory: ImportHistoryEntry[];
  cameraDetections: CameraDetectionLog[];
}

export interface CleaningReport {
  rawRows: number;
  cleanedRows: number;
  duplicatesRemoved: number;
  missingValuesHandled: number;
  invalidDatesDropped: number;
  invalidTimesFixed: number;
  negativeValuesFixed: number;
  invalidCapacityDropped: number;
  clampedOccupiedRows: number;
  calculatedAvailableRows: number;
  qualityScore: number;
}

export interface FilterState {
  dateStart: string;
  dateEnd: string;
  days: string[];
  locations: string[];
  vehicles: string[];
  timePeriods: string[];
}

export interface ZoneConfig {
  id: string;
  name: string;
  code: string;
  capacity: number;
  category: 'Academic' | 'Gate' | 'Residential' | 'Recreation' | 'Dining';
  mapX: number;
  mapY: number;
  active: boolean;
}

export interface ThresholdConfig {
  lowPct: number;
  highPct: number;
  criticalPct: number;
}

export interface KpiMetrics {
  totalCapacity: number;
  occupiedSpaces: number;
  availableSpaces: number;
  avgOccupancyPct: number;
  peakHourLabel: string;
  peakHourOccupancy: number;
  mostCrowdedLocation: string;
  mostCrowdedOccupancy: number;
  totalVehiclesRecorded: number;
  parkingEfficiencyScore: number;
  recordCount: number;
}

export interface LocationStat {
  location: string;
  totalCapacity: number;
  avgOccupied: number;
  avgAvailable: number;
  avgOccupancyPct: number;
  peakOccupancyPct: number;
  congestionFreqPct: number;
  criticalFreqPct: number;
  observations: number;
  status: 'Critical (>95%)' | 'High Congestion' | 'Balanced' | 'Underutilized';
}

export interface HourlyStat {
  hour: number;
  timeLabel: string;
  avgOccupancyPct: number;
  avgOccupied: number;
  avgAvailable: number;
  observations: number;
}

export interface DayStat {
  day: string;
  avgOccupancyPct: number;
  avgOccupied: number;
  avgAvailable: number;
  observations: number;
}

export interface VehicleStat {
  vehicleType: string;
  recordCount: number;
  totalOccupied: number;
  sharePct: number;
}

export interface DateTrendStat {
  date: string;
  avgOccupancyPct: number;
  avgOccupied: number;
}

export interface WeekdayVsWeekendStat {
  segment: 'Weekday (Mon–Fri)' | 'Weekend (Sat–Sun)';
  avgOccupancyPct: number;
  avgOccupied: number;
  avgAvailable: number;
  recordCount: number;
}

export interface StatisticalSummaryRow {
  metric: string;
  count: number;
  mean: number;
  std: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

export type AlertSeverity = 'critical' | 'high' | 'low' | 'peak';

export interface SmartAlert {
  id: string;
  date: string;
  time: string;
  location: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  occupancyPct: number;
}

export interface PredictionPoint {
  hour: number;
  timeLabel: string;
  historicalPct: number | null;
  predictedPct: number;
  lowerBoundPct: number;
  upperBoundPct: number;
  isUpcoming: boolean;
}

export interface ZonePrediction {
  location: string;
  currentAvgPct: number;
  projectedNextPeakPct: number;
  trendSlopePerDay: number;
  riskLevel: 'Critical Risk' | 'Congestion Likely' | 'Stable';
  projectedPeakHour: string;
}

export interface PredictionReport {
  hourlyForecast: PredictionPoint[];
  zonePredictions: ZonePrediction[];
  predictedPeakHour: string;
  predictedPeakPct: number;
  confidencePct: number;
  methodologyNote: string;
}

export interface ImportHistoryEntry {
  id: string;
  timestamp: string;
  fileName: string;
  mode: 'sample' | 'replace' | 'append' | 'live_db';
  rawRows: number;
  cleanedRows: number;
  qualityScore: number;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  actorRole: 'admin' | 'viewer';
  action: string;
  details: string;
}

export type ReportType =
  | 'detailed'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'location'
  | 'vehicle'
  | 'occupancy';
