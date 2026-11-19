import type { CleaningReport, ParkingRecord } from '../types/parking';

export const DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const CORE_REQUIRED_COLUMNS = [
  'Date',
  'Time',
  'Parking_Location',
  'Total_Capacity',
  'Occupied_Spaces',
];

function classifyTimePeriod(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Morning (05:00-11:59)';
  if (hour >= 12 && hour < 16) return 'Afternoon (12:00-15:59)';
  if (hour >= 16 && hour < 20) return 'Evening (16:00-19:59)';
  return 'Night (20:00-04:59)';
}

function getWeekdayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return 'Monday';
  const dt = new Date(Date.UTC(y, m - 1, d));
  const idx = (dt.getUTCDay() + 6) % 7;
  return DAY_ORDER[idx] ?? 'Monday';
}

function normalizeDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const check = new Date(Date.UTC(y, m - 1, d));
      if (
        check.getUTCFullYear() === y &&
        check.getUTCMonth() === m - 1 &&
        check.getUTCDate() === d
      ) {
        return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return null;
  }

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashMatch) {
    const m = Number(slashMatch[1]);
    const d = Number(slashMatch[2]);
    const y = Number(slashMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseHourStrict(rawTime: string | undefined): { hour: number; invalid: boolean } {
  if (!rawTime || !rawTime.trim()) return { hour: 9, invalid: true };
  const trimmed = rawTime.trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(trimmed);
  if (match) {
    let h = Number(match[1]);
    const mins = Number(match[2]);
    const ampm = match[3]?.toLowerCase();
    if (mins < 0 || mins > 59) return { hour: 9, invalid: true };
    if (ampm) {
      if (h < 1 || h > 12) return { hour: 9, invalid: true };
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
    } else if (h < 0 || h > 23) {
      return { hour: 9, invalid: true };
    }
    return { hour: h, invalid: false };
  }
  return { hour: 9, invalid: true };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export interface CsvLoadResult {
  records: ParkingRecord[];
  cleaningReport: CleaningReport;
  error: string | null;
}

export function validateAndCleanCsv(csvText: string): CsvLoadResult {
  const emptyReport: CleaningReport = {
    rawRows: 0,
    cleanedRows: 0,
    duplicatesRemoved: 0,
    missingValuesHandled: 0,
    invalidDatesDropped: 0,
    invalidTimesFixed: 0,
    negativeValuesFixed: 0,
    invalidCapacityDropped: 0,
    clampedOccupiedRows: 0,
    calculatedAvailableRows: 0,
    qualityScore: 0,
  };

  const trimmed = csvText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return {
      records: [],
      cleaningReport: emptyReport,
      error: 'The CSV file is empty. Upload a UTF-8 CSV file with headers and data rows.',
    };
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      records: [],
      cleaningReport: emptyReport,
      error: 'The CSV file contains headers but zero data rows.',
    };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const missingCols = CORE_REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missingCols.length > 0) {
    return {
      records: [],
      cleaningReport: emptyReport,
      error: `Missing required column(s): ${missingCols.join(
        ', '
      )}. Expected schema includes Date, Time, Parking_Location, Total_Capacity, Occupied_Spaces (and optionally Day, Available_Spaces, Vehicle_Type).`,
    };
  }

  const colIndex = new Map<string, number>();
  headers.forEach((h, idx) => colIndex.set(h, idx));

  const rawRows = lines.length - 1;
  let missingValuesHandled = 0;
  let invalidDatesDropped = 0;
  let invalidTimesFixed = 0;
  let negativeValuesFixed = 0;
  let invalidCapacityDropped = 0;
  let clampedOccupiedRows = 0;
  let calculatedAvailableRows = 0;

  interface IntermediateRow {
    date: string;
    hour: number;
    time: string;
    day: string;
    location: string;
    capacity: number;
    occupied: number | null;
    availableProvided: number | null;
    vehicleType: string;
  }

  const intermediate: IntermediateRow[] = [];
  let hasAnyNumericCapacity = false;
  let hasAnyValidDate = false;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const getCell = (col: string): string => {
      const idx = colIndex.get(col);
      return idx !== undefined && idx < cells.length ? cells[idx].trim() : '';
    };

    const rawDate = getCell('Date');
    const normDate = normalizeDate(rawDate);
    if (!normDate) {
      invalidDatesDropped += 1;
      if (!rawDate) missingValuesHandled += 1;
      continue;
    }
    hasAnyValidDate = true;

    const rawCap = getCell('Total_Capacity');
    const capNum = Number(rawCap);
    if (rawCap !== '' && !Number.isNaN(capNum)) {
      hasAnyNumericCapacity = true;
    }

    if (rawCap === '' || Number.isNaN(capNum) || capNum <= 0) {
      if (rawCap !== '' && !Number.isNaN(capNum) && capNum < 0) negativeValuesFixed += 1;
      if (rawCap === '') missingValuesHandled += 1;
      invalidCapacityDropped += 1;
      continue;
    }

    const rawTime = getCell('Time');
    if (!rawTime) missingValuesHandled += 1;
    const { hour, invalid: timeInvalid } = parseHourStrict(rawTime);
    if (timeInvalid && rawTime !== '') invalidTimesFixed += 1;
    const timeLabel = `${String(hour).padStart(2, '0')}:00`;

    const rawDay = getCell('Day');
    const day = (DAY_ORDER as readonly string[]).includes(rawDay)
      ? rawDay
      : getWeekdayName(normDate);
    if (!rawDay) missingValuesHandled += 1;

    const rawLoc = getCell('Parking_Location');
    const location = rawLoc || 'Unassigned Parking';
    if (!rawLoc) missingValuesHandled += 1;

    const rawVehicle = getCell('Vehicle_Type');
    const vehicleType = rawVehicle || 'Car';
    if (!rawVehicle) missingValuesHandled += 1;

    const rawOcc = getCell('Occupied_Spaces');
    let occupied: number | null = null;
    if (rawOcc === '' || Number.isNaN(Number(rawOcc))) {
      missingValuesHandled += 1;
    } else {
      occupied = Number(rawOcc);
      if (occupied < 0) {
        negativeValuesFixed += 1;
        occupied = 0;
      }
    }

    const rawAvail = getCell('Available_Spaces');
    let availableProvided: number | null = null;
    if (rawAvail === '' || Number.isNaN(Number(rawAvail))) {
      calculatedAvailableRows += 1;
    } else {
      availableProvided = Number(rawAvail);
    }

    intermediate.push({
      date: normDate,
      hour,
      time: timeLabel,
      day,
      location,
      capacity: Math.round(capNum),
      occupied,
      availableProvided,
      vehicleType,
    });
  }

  if (!hasAnyValidDate) {
    return {
      records: [],
      cleaningReport: { ...emptyReport, rawRows, invalidDatesDropped },
      error: "Column 'Date' does not contain recognizable dates (expected YYYY-MM-DD).",
    };
  }

  if (!hasAnyNumericCapacity) {
    return {
      records: [],
      cleaningReport: { ...emptyReport, rawRows, invalidCapacityDropped },
      error: "Column 'Total_Capacity' must contain positive numeric values.",
    };
  }

  for (const row of intermediate) {
    if (row.occupied !== null && row.occupied > row.capacity) {
      clampedOccupiedRows += 1;
      row.occupied = row.capacity;
    }
  }

  const occByLoc = new Map<string, number[]>();
  for (const row of intermediate) {
    if (row.occupied !== null) {
      const list = occByLoc.get(row.location) ?? [];
      list.push(row.occupied);
      occByLoc.set(row.location, list);
    }
  }
  const locMedians = new Map<string, number>();
  occByLoc.forEach((vals, loc) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    locMedians.set(loc, sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]);
  });

  const seenKeys = new Set<string>();
  let duplicatesRemoved = 0;
  const cleaned: ParkingRecord[] = [];

  for (const row of intermediate) {
    let occ = row.occupied ?? locMedians.get(row.location) ?? 0;
    occ = Math.max(0, Math.min(row.capacity, occ));
    const roundedOcc = Math.round(occ);

    const dedupKey = `${row.date}|${row.time}|${row.location}|${row.vehicleType}|${roundedOcc}`;
    if (seenKeys.has(dedupKey)) {
      duplicatesRemoved += 1;
      continue;
    }
    seenKeys.add(dedupKey);

    const available = Math.max(0, row.capacity - roundedOcc);
    const occPct = row.capacity > 0 ? Number(((roundedOcc / row.capacity) * 100).toFixed(2)) : 0;

    cleaned.push({
      Date: row.date,
      Time: row.time,
      Day: row.day,
      Parking_Location: row.location,
      Total_Capacity: row.capacity,
      Occupied_Spaces: roundedOcc,
      Available_Spaces: available,
      Occupancy_Percentage: occPct,
      Vehicle_Type: row.vehicleType,
      Hour: row.hour,
      Time_Period: classifyTimePeriod(row.hour),
    });
  }

  cleaned.sort((a, b) => {
    if (a.Date !== b.Date) return a.Date.localeCompare(b.Date);
    if (a.Hour !== b.Hour) return a.Hour - b.Hour;
    return a.Parking_Location.localeCompare(b.Parking_Location);
  });

  // Compute deterministic Dataset Quality Score (0-100)
  const issueCount =
    duplicatesRemoved +
    invalidDatesDropped +
    invalidTimesFixed +
    negativeValuesFixed +
    invalidCapacityDropped +
    clampedOccupiedRows +
    missingValuesHandled * 0.5;
  const qualityScore =
    rawRows > 0 ? Math.max(0, Math.min(100, Number((100 - (issueCount / rawRows) * 100).toFixed(1)))) : 0;

  return {
    records: cleaned,
    cleaningReport: {
      rawRows,
      cleanedRows: cleaned.length,
      duplicatesRemoved,
      missingValuesHandled,
      invalidDatesDropped,
      invalidTimesFixed,
      negativeValuesFixed,
      invalidCapacityDropped,
      clampedOccupiedRows,
      calculatedAvailableRows,
      qualityScore,
    },
    error: null,
  };
}

export function mergeDatasets(
  existing: ParkingRecord[],
  incoming: ParkingRecord[]
): { merged: ParkingRecord[]; duplicatesSkipped: number } {
  const seen = new Set<string>();
  const merged: ParkingRecord[] = [];
  let duplicatesSkipped = 0;

  for (const r of [...existing, ...incoming]) {
    const key = `${r.Date}|${r.Time}|${r.Parking_Location}|${r.Vehicle_Type}|${r.Occupied_Spaces}`;
    if (seen.has(key)) {
      duplicatesSkipped += 1;
      continue;
    }
    seen.add(key);
    merged.push(r);
  }

  merged.sort((a, b) => {
    if (a.Date !== b.Date) return a.Date.localeCompare(b.Date);
    if (a.Hour !== b.Hour) return a.Hour - b.Hour;
    return a.Parking_Location.localeCompare(b.Parking_Location);
  });

  return { merged, duplicatesSkipped };
}

export const SAMPLE_TEMPLATE_CSV = `Date,Time,Day,Parking_Location,Total_Capacity,Occupied_Spaces,Available_Spaces,Occupancy_Percentage,Vehicle_Type
2026-10-05,09:00,Monday,Main Gate Parking,150,132,18,88.0,Car
2026-10-05,10:00,Monday,Academic Block Parking,200,176,24,88.0,Two-Wheeler
2026-10-05,12:00,Monday,Library Parking,120,58,62,48.33,EV
2026-10-05,17:00,Monday,Sports Complex Parking,100,82,18,82.0,Two-Wheeler
`;

export function recordsToCsv(records: ParkingRecord[]): string {
  const header = [
    'Date',
    'Time',
    'Day',
    'Parking_Location',
    'Total_Capacity',
    'Occupied_Spaces',
    'Available_Spaces',
    'Occupancy_Percentage',
    'Vehicle_Type',
  ].join(',');

  const rows = records.map((r) =>
    [
      r.Date,
      r.Time,
      r.Day,
      `"${r.Parking_Location.replace(/"/g, '""')}"`,
      r.Total_Capacity,
      r.Occupied_Spaces,
      r.Available_Spaces,
      r.Occupancy_Percentage.toFixed(2),
      `"${r.Vehicle_Type.replace(/"/g, '""')}"`,
    ].join(',')
  );

  return [header, ...rows].join('\n');
}
