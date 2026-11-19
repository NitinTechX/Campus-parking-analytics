import type {
  CleaningReport,
  DateTrendStat,
  DayStat,
  FilterState,
  HourlyStat,
  KpiMetrics,
  LiveVehicleRecord,
  LocationStat,
  ParkingRecord,
  PredictionPoint,
  PredictionReport,
  SmartAlert,
  StatisticalSummaryRow,
  ThresholdConfig,
  VehicleStat,
  WeekdayVsWeekendStat,
  ZoneConfig,
  ZonePrediction,
} from '../types/parking';
import { DAY_ORDER } from './dataCleaning';

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  lowPct: 30,
  highPct: 80,
  criticalPct: 95,
};

export function filterRecords(records: ParkingRecord[], filters: FilterState): ParkingRecord[] {
  const daySet = new Set(filters.days);
  const locSet = new Set(filters.locations);
  const vehSet = new Set(filters.vehicles);
  const periodSet = new Set(filters.timePeriods);

  return records.filter((r) => {
    if (filters.dateStart && r.Date < filters.dateStart) return false;
    if (filters.dateEnd && r.Date > filters.dateEnd) return false;
    if (!daySet.has(r.Day)) return false;
    if (!locSet.has(r.Parking_Location)) return false;
    if (!vehSet.has(r.Vehicle_Type)) return false;
    if (!periodSet.has(r.Time_Period)) return false;
    return true;
  });
}

/** Synchronize zone capacity updates from Admin Panel into active records smoothly */
export function applyZoneOverrides(
  records: ParkingRecord[],
  zones: ZoneConfig[]
): ParkingRecord[] {
  if (zones.length === 0) return records;
  const zoneMap = new Map<string, ZoneConfig>();
  for (const z of zones) {
    zoneMap.set(z.name, z);
  }

  return records
    .filter((r) => {
      const z = zoneMap.get(r.Parking_Location);
      return z ? z.active : true;
    })
    .map((r) => {
      const z = zoneMap.get(r.Parking_Location);
      if (!z || z.capacity === r.Total_Capacity) return r;
      const cap = Math.max(1, z.capacity);
      const occ = Math.min(cap, r.Occupied_Spaces);
      const avail = Math.max(0, cap - occ);
      const pct = Number(((occ / cap) * 100).toFixed(2));
      return {
        ...r,
        Total_Capacity: cap,
        Occupied_Spaces: occ,
        Available_Spaces: avail,
        Occupancy_Percentage: pct,
      };
    });
}

export function calculateKpis(
  records: ParkingRecord[],
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): KpiMetrics {
  if (records.length === 0) {
    return {
      totalCapacity: 0,
      occupiedSpaces: 0,
      availableSpaces: 0,
      avgOccupancyPct: 0,
      peakHourLabel: 'N/A',
      peakHourOccupancy: 0,
      mostCrowdedLocation: 'N/A',
      mostCrowdedOccupancy: 0,
      totalVehiclesRecorded: 0,
      parkingEfficiencyScore: 0,
      recordCount: 0,
    };
  }

  const locMap = new Map<
    string,
    { maxCap: number; occSum: number; pctSum: number; count: number }
  >();

  let pctSumTotal = 0;
  let totalVehiclesRecorded = 0;
  let highCount = 0;
  let criticalCount = 0;
  let lowCount = 0;
  const hourMap = new Map<number, { pctSum: number; count: number }>();

  for (const r of records) {
    pctSumTotal += r.Occupancy_Percentage;
    totalVehiclesRecorded += r.Occupied_Spaces;

    if (r.Occupancy_Percentage >= thresholds.criticalPct) criticalCount += 1;
    else if (r.Occupancy_Percentage > thresholds.highPct) highCount += 1;
    else if (r.Occupancy_Percentage < thresholds.lowPct) lowCount += 1;

    const locEntry = locMap.get(r.Parking_Location) ?? {
      maxCap: 0,
      occSum: 0,
      pctSum: 0,
      count: 0,
    };
    locEntry.maxCap = Math.max(locEntry.maxCap, r.Total_Capacity);
    locEntry.occSum += r.Occupied_Spaces;
    locEntry.pctSum += r.Occupancy_Percentage;
    locEntry.count += 1;
    locMap.set(r.Parking_Location, locEntry);

    const hEntry = hourMap.get(r.Hour) ?? { pctSum: 0, count: 0 };
    hEntry.pctSum += r.Occupancy_Percentage;
    hEntry.count += 1;
    hourMap.set(r.Hour, hEntry);
  }

  let totalCapacity = 0;
  let occupiedSum = 0;
  let mostCrowdedLocation = 'N/A';
  let mostCrowdedOccupancy = -1;
  const locAvgs: number[] = [];

  locMap.forEach((v, loc) => {
    totalCapacity += v.maxCap;
    occupiedSum += v.occSum / v.count;
    const avgPct = v.pctSum / v.count;
    locAvgs.push(avgPct);
    if (avgPct > mostCrowdedOccupancy) {
      mostCrowdedOccupancy = avgPct;
      mostCrowdedLocation = loc;
    }
  });

  const occupiedSpaces = Math.min(totalCapacity, Math.round(occupiedSum));
  const availableSpaces = Math.max(0, totalCapacity - occupiedSpaces);
  const avgOccupancyPct =
    totalCapacity > 0 ? Number(((occupiedSpaces / totalCapacity) * 100).toFixed(2)) : 0;

  let peakHour = 0;
  let peakHourOccupancy = -1;
  hourMap.forEach((v, h) => {
    const avg = v.pctSum / v.count;
    if (avg > peakHourOccupancy) {
      peakHourOccupancy = avg;
      peakHour = h;
    }
  });

  // Transparent Parking Efficiency Score (0-100):
  // Rewards balanced utilization (45-75%) and penalizes congestion spikes, wasted space, and inter-zone imbalance.
  const n = records.length;
  const highRate = (highCount / n) * 100;
  const criticalRate = (criticalCount / n) * 100;
  const lowRate = (lowCount / n) * 100;
  const locMean =
    locAvgs.length > 0 ? locAvgs.reduce((a, b) => a + b, 0) / locAvgs.length : avgOccupancyPct;
  const locStd =
    locAvgs.length > 1
      ? Math.sqrt(locAvgs.reduce((acc, v) => acc + (v - locMean) ** 2, 0) / locAvgs.length)
      : 0;

  const congestionPenalty = highRate * 0.45 + criticalRate * 0.8;
  const underusePenalty = lowRate * 0.25;
  const imbalancePenalty = Math.min(25, locStd * 0.55);
  const parkingEfficiencyScore = Number(
    Math.max(0, Math.min(100, 100 - congestionPenalty - underusePenalty - imbalancePenalty)).toFixed(1)
  );

  return {
    totalCapacity,
    occupiedSpaces,
    availableSpaces,
    avgOccupancyPct,
    peakHourLabel: `${String(peakHour).padStart(2, '0')}:00`,
    peakHourOccupancy: Number(peakHourOccupancy.toFixed(2)),
    mostCrowdedLocation,
    mostCrowdedOccupancy: Number(mostCrowdedOccupancy.toFixed(2)),
    totalVehiclesRecorded,
    parkingEfficiencyScore,
    recordCount: records.length,
  };
}

export function computeLocationUsage(
  records: ParkingRecord[],
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): LocationStat[] {
  const map = new Map<
    string,
    {
      maxCap: number;
      occSum: number;
      availSum: number;
      pctSum: number;
      peakPct: number;
      highHits: number;
      criticalHits: number;
      count: number;
    }
  >();

  for (const r of records) {
    const cur = map.get(r.Parking_Location) ?? {
      maxCap: 0,
      occSum: 0,
      availSum: 0,
      pctSum: 0,
      peakPct: 0,
      highHits: 0,
      criticalHits: 0,
      count: 0,
    };
    cur.maxCap = Math.max(cur.maxCap, r.Total_Capacity);
    cur.occSum += r.Occupied_Spaces;
    cur.availSum += r.Available_Spaces;
    cur.pctSum += r.Occupancy_Percentage;
    cur.peakPct = Math.max(cur.peakPct, r.Occupancy_Percentage);
    if (r.Occupancy_Percentage > thresholds.highPct) cur.highHits += 1;
    if (r.Occupancy_Percentage >= thresholds.criticalPct) cur.criticalHits += 1;
    cur.count += 1;
    map.set(r.Parking_Location, cur);
  }

  const stats: LocationStat[] = [];
  map.forEach((v, location) => {
    const avgOccupancyPct = Number((v.pctSum / v.count).toFixed(2));
    const status: LocationStat['status'] =
      avgOccupancyPct >= thresholds.criticalPct
        ? 'Critical (>95%)'
        : avgOccupancyPct > thresholds.highPct
          ? 'High Congestion'
          : avgOccupancyPct < thresholds.lowPct
            ? 'Underutilized'
            : 'Balanced';

    stats.push({
      location,
      totalCapacity: v.maxCap,
      avgOccupied: Number((v.occSum / v.count).toFixed(1)),
      avgAvailable: Number((v.availSum / v.count).toFixed(1)),
      avgOccupancyPct,
      peakOccupancyPct: Number(v.peakPct.toFixed(2)),
      congestionFreqPct: Number(((v.highHits / v.count) * 100).toFixed(1)),
      criticalFreqPct: Number(((v.criticalHits / v.count) * 100).toFixed(1)),
      observations: v.count,
      status,
    });
  });

  return stats.sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct);
}

export function computeHourlyUsage(records: ParkingRecord[]): HourlyStat[] {
  const map = new Map<
    number,
    { pctSum: number; occSum: number; availSum: number; count: number }
  >();

  for (const r of records) {
    const cur = map.get(r.Hour) ?? { pctSum: 0, occSum: 0, availSum: 0, count: 0 };
    cur.pctSum += r.Occupancy_Percentage;
    cur.occSum += r.Occupied_Spaces;
    cur.availSum += r.Available_Spaces;
    cur.count += 1;
    map.set(r.Hour, cur);
  }

  const list: HourlyStat[] = [];
  map.forEach((v, hour) => {
    list.push({
      hour,
      timeLabel: `${String(hour).padStart(2, '0')}:00`,
      avgOccupancyPct: Number((v.pctSum / v.count).toFixed(2)),
      avgOccupied: Number((v.occSum / v.count).toFixed(1)),
      avgAvailable: Number((v.availSum / v.count).toFixed(1)),
      observations: v.count,
    });
  });

  return list.sort((a, b) => a.hour - b.hour);
}

export function computeDayUsage(records: ParkingRecord[]): DayStat[] {
  const map = new Map<
    string,
    { pctSum: number; occSum: number; availSum: number; count: number }
  >();

  for (const r of records) {
    const cur = map.get(r.Day) ?? { pctSum: 0, occSum: 0, availSum: 0, count: 0 };
    cur.pctSum += r.Occupancy_Percentage;
    cur.occSum += r.Occupied_Spaces;
    cur.availSum += r.Available_Spaces;
    cur.count += 1;
    map.set(r.Day, cur);
  }

  const list: DayStat[] = [];
  for (const day of DAY_ORDER) {
    const v = map.get(day);
    if (v) {
      list.push({
        day,
        avgOccupancyPct: Number((v.pctSum / v.count).toFixed(2)),
        avgOccupied: Number((v.occSum / v.count).toFixed(1)),
        avgAvailable: Number((v.availSum / v.count).toFixed(1)),
        observations: v.count,
      });
    }
  }
  return list;
}

export function computeWeekdayVsWeekend(records: ParkingRecord[]): WeekdayVsWeekendStat[] {
  const groups = {
    weekday: { pctSum: 0, occSum: 0, availSum: 0, count: 0 },
    weekend: { pctSum: 0, occSum: 0, availSum: 0, count: 0 },
  };

  for (const r of records) {
    const key = r.Day === 'Saturday' || r.Day === 'Sunday' ? 'weekend' : 'weekday';
    groups[key].pctSum += r.Occupancy_Percentage;
    groups[key].occSum += r.Occupied_Spaces;
    groups[key].availSum += r.Available_Spaces;
    groups[key].count += 1;
  }

  const res: WeekdayVsWeekendStat[] = [];
  if (groups.weekday.count > 0) {
    res.push({
      segment: 'Weekday (Mon–Fri)',
      avgOccupancyPct: Number((groups.weekday.pctSum / groups.weekday.count).toFixed(2)),
      avgOccupied: Number((groups.weekday.occSum / groups.weekday.count).toFixed(1)),
      avgAvailable: Number((groups.weekday.availSum / groups.weekday.count).toFixed(1)),
      recordCount: groups.weekday.count,
    });
  }
  if (groups.weekend.count > 0) {
    res.push({
      segment: 'Weekend (Sat–Sun)',
      avgOccupancyPct: Number((groups.weekend.pctSum / groups.weekend.count).toFixed(2)),
      avgOccupied: Number((groups.weekend.occSum / groups.weekend.count).toFixed(1)),
      avgAvailable: Number((groups.weekend.availSum / groups.weekend.count).toFixed(1)),
      recordCount: groups.weekend.count,
    });
  }
  return res;
}

export function computeDayHourHeatmap(records: ParkingRecord[]): {
  days: string[];
  hours: string[];
  values: (number | null)[][];
} {
  const hourSet = new Set<number>();
  const daySet = new Set<string>();
  const cellMap = new Map<string, { sum: number; count: number }>();

  for (const r of records) {
    hourSet.add(r.Hour);
    daySet.add(r.Day);
    const key = `${r.Day}|${r.Hour}`;
    const cur = cellMap.get(key) ?? { sum: 0, count: 0 };
    cur.sum += r.Occupancy_Percentage;
    cur.count += 1;
    cellMap.set(key, cur);
  }

  const days = DAY_ORDER.filter((d) => daySet.has(d));
  const sortedHours = Array.from(hourSet).sort((a, b) => a - b);
  const hours = sortedHours.map((h) => `${String(h).padStart(2, '0')}:00`);

  const values = days.map((day) =>
    sortedHours.map((h) => {
      const cell = cellMap.get(`${day}|${h}`);
      return cell ? Number((cell.sum / cell.count).toFixed(1)) : null;
    })
  );

  return { days, hours, values };
}

export function computeVehicleDistribution(records: ParkingRecord[]): VehicleStat[] {
  const map = new Map<string, { count: number; totalOccupied: number }>();
  let grandTotalOcc = 0;

  for (const r of records) {
    const cur = map.get(r.Vehicle_Type) ?? { count: 0, totalOccupied: 0 };
    cur.count += 1;
    cur.totalOccupied += r.Occupied_Spaces;
    grandTotalOcc += r.Occupied_Spaces;
    map.set(r.Vehicle_Type, cur);
  }

  const list: VehicleStat[] = [];
  map.forEach((v, vehicleType) => {
    list.push({
      vehicleType,
      recordCount: v.count,
      totalOccupied: v.totalOccupied,
      sharePct:
        grandTotalOcc > 0 ? Number(((v.totalOccupied / grandTotalOcc) * 100).toFixed(2)) : 0,
    });
  });

  return list.sort((a, b) => b.totalOccupied - a.totalOccupied);
}

export function computeDateTrends(records: ParkingRecord[]): DateTrendStat[] {
  const map = new Map<string, { pctSum: number; occSum: number; count: number }>();

  for (const r of records) {
    const cur = map.get(r.Date) ?? { pctSum: 0, occSum: 0, count: 0 };
    cur.pctSum += r.Occupancy_Percentage;
    cur.occSum += r.Occupied_Spaces;
    cur.count += 1;
    map.set(r.Date, cur);
  }

  const list: DateTrendStat[] = [];
  map.forEach((v, date) => {
    list.push({
      date,
      avgOccupancyPct: Number((v.pctSum / v.count).toFixed(2)),
      avgOccupied: Number((v.occSum / v.count).toFixed(1)),
    });
  });

  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function generateSmartAlerts(
  records: ParkingRecord[],
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): SmartAlert[] {
  if (records.length === 0) return [];

  const alerts: SmartAlert[] = [];
  const locStats = computeLocationUsage(records, thresholds);
  const hourly = computeHourlyUsage(records);

  // 1. Location-level threshold alerts
  for (const loc of locStats) {
    if (loc.peakOccupancyPct >= thresholds.criticalPct || loc.avgOccupancyPct >= thresholds.criticalPct) {
      alerts.push({
        id: `crit-${loc.location}`,
        date: records[records.length - 1].Date,
        time: 'Peak',
        location: loc.location,
        severity: 'critical',
        title: `Critical Occupancy (>=${thresholds.criticalPct}%)`,
        message: `${loc.location} reached ${loc.peakOccupancyPct.toFixed(1)}% peak occupancy (${loc.criticalFreqPct.toFixed(1)}% of observations critical).`,
        occupancyPct: loc.peakOccupancyPct,
      });
    } else if (loc.avgOccupancyPct > thresholds.highPct || loc.peakOccupancyPct > thresholds.highPct) {
      alerts.push({
        id: `high-${loc.location}`,
        date: records[records.length - 1].Date,
        time: 'Peak',
        location: loc.location,
        severity: 'high',
        title: `High Congestion (>${thresholds.highPct}%)`,
        message: `${loc.location} averages ${loc.avgOccupancyPct.toFixed(1)}% with peaks up to ${loc.peakOccupancyPct.toFixed(1)}% (${loc.congestionFreqPct.toFixed(1)}% congested windows).`,
        occupancyPct: loc.avgOccupancyPct,
      });
    }

    if (loc.avgOccupancyPct < thresholds.lowPct) {
      alerts.push({
        id: `low-${loc.location}`,
        date: records[records.length - 1].Date,
        time: 'All Day',
        location: loc.location,
        severity: 'low',
        title: `Low Utilization (<${thresholds.lowPct}%)`,
        message: `${loc.location} averages only ${loc.avgOccupancyPct.toFixed(1)}% occupancy, leaving ${loc.avgAvailable.toFixed(0)} open bays on average for overflow routing.`,
        occupancyPct: loc.avgOccupancyPct,
      });
    }
  }

  // 2. Peak-hour warning
  if (hourly.length > 0) {
    const topHour = [...hourly].sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct)[0];
    if (topHour.avgOccupancyPct >= 50) {
      alerts.push({
        id: `peak-hour-${topHour.hour}`,
        date: records[records.length - 1].Date,
        time: topHour.timeLabel,
        location: 'Campus-Wide',
        severity: 'peak',
        title: `Peak Demand Window (${topHour.timeLabel})`,
        message: `Campus-wide parking demand consistently peaks around ${topHour.timeLabel} at ${topHour.avgOccupancyPct.toFixed(1)}% average occupancy.`,
        occupancyPct: topHour.avgOccupancyPct,
      });
    }
  }

  // 3. Recent specific high/critical record events (up to 18 latest events for alert history)
  const recordEvents = [...records]
    .filter(
      (r) =>
        r.Occupancy_Percentage >= thresholds.criticalPct ||
        r.Occupancy_Percentage > thresholds.highPct
    )
    .sort((a, b) => `${b.Date} ${b.Time}`.localeCompare(`${a.Date} ${a.Time}`))
    .slice(0, 18);

  for (const r of recordEvents) {
    const isCrit = r.Occupancy_Percentage >= thresholds.criticalPct;
    alerts.push({
      id: `evt-${r.Date}-${r.Time}-${r.Parking_Location}-${r.Vehicle_Type}`,
      date: r.Date,
      time: r.Time,
      location: r.Parking_Location,
      severity: isCrit ? 'critical' : 'high',
      title: isCrit
        ? `Critical Capacity Spike (${r.Occupancy_Percentage.toFixed(1)}%)`
        : `Congestion Event (${r.Occupancy_Percentage.toFixed(1)}%)`,
      message: `${r.Parking_Location} recorded ${r.Occupied_Spaces}/${r.Total_Capacity} occupied spaces (${r.Available_Spaces} open) on ${r.Day} at ${r.Time}.`,
      occupancyPct: r.Occupancy_Percentage,
    });
  }

  return alerts;
}

/** Statistical Predictive Analytics: weighted hourly curve + linear trend + std-dev bands */
export function computePredictions(
  records: ParkingRecord[],
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): PredictionReport {
  if (records.length === 0) {
    return {
      hourlyForecast: [],
      zonePredictions: [],
      predictedPeakHour: 'N/A',
      predictedPeakPct: 0,
      confidencePct: 0,
      methodologyNote: 'No records available to compute forecasts.',
    };
  }

  const dates = Array.from(new Set(records.map((r) => r.Date))).sort();
  const dateIdxMap = new Map<string, number>();
  dates.forEach((d, idx) => dateIdxMap.set(d, idx));

  // Group occupancy by Hour across all observed dates
  const hourBuckets = new Map<number, Array<{ x: number; y: number }>>();
  for (const r of records) {
    const list = hourBuckets.get(r.Hour) ?? [];
    list.push({ x: dateIdxMap.get(r.Date) ?? 0, y: r.Occupancy_Percentage });
    hourBuckets.set(r.Hour, list);
  }

  // Build continuous hourly forecast from 07:00 to 21:00
  const observedHours = Array.from(hourBuckets.keys()).sort((a, b) => a - b);
  const minH = Math.min(7, observedHours[0] ?? 8);
  const maxH = Math.max(21, observedHours[observedHours.length - 1] ?? 20);
  const nextDateX = dates.length;

  const hourlyForecast: PredictionPoint[] = [];
  for (let h = minH; h <= maxH; h += 1) {
    const pts = hourBuckets.get(h);
    if (pts && pts.length > 0) {
      const mean = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const variance =
        pts.length > 1
          ? pts.reduce((a, p) => a + (p.y - mean) ** 2, 0) / (pts.length - 1)
          : 25;
      const sd = Math.sqrt(variance);

      // Simple OLS slope across dates for this hour
      let slope = 0;
      if (dates.length > 1) {
        const meanX = pts.reduce((a, p) => a + p.x, 0) / pts.length;
        let num = 0;
        let den = 0;
        for (const p of pts) {
          num += (p.x - meanX) * (p.y - mean);
          den += (p.x - meanX) ** 2;
        }
        slope = den > 0 ? Math.max(-1.8, Math.min(1.8, num / den)) : 0;
      }

      const pred = Math.max(5, Math.min(99, mean + slope * (nextDateX - (dates.length - 1) * 0.5) * 0.35));
      hourlyForecast.push({
        hour: h,
        timeLabel: `${String(h).padStart(2, '0')}:00`,
        historicalPct: Number(mean.toFixed(1)),
        predictedPct: Number(pred.toFixed(1)),
        lowerBoundPct: Number(Math.max(0, pred - sd * 0.85).toFixed(1)),
        upperBoundPct: Number(Math.min(100, pred + sd * 0.85).toFixed(1)),
        isUpcoming: h >= 12,
      });
    } else {
      // Linearly interpolate unobserved intermediate hours from nearest observed neighbors
      const prevH = [...observedHours].reverse().find((oh) => oh < h);
      const nextH = observedHours.find((oh) => oh > h);
      const prevVals = prevH !== undefined ? hourBuckets.get(prevH)! : [];
      const nextVals = nextH !== undefined ? hourBuckets.get(nextH)! : [];
      const prevMean = prevVals.length
        ? prevVals.reduce((a, p) => a + p.y, 0) / prevVals.length
        : 40;
      const nextMean = nextVals.length
        ? nextVals.reduce((a, p) => a + p.y, 0) / nextVals.length
        : prevMean;
      const frac =
        prevH !== undefined && nextH !== undefined && nextH !== prevH
          ? (h - prevH) / (nextH - prevH)
          : 0.5;
      const interp = prevMean + (nextMean - prevMean) * frac;
      hourlyForecast.push({
        hour: h,
        timeLabel: `${String(h).padStart(2, '0')}:00`,
        historicalPct: null,
        predictedPct: Number(interp.toFixed(1)),
        lowerBoundPct: Number(Math.max(0, interp - 8).toFixed(1)),
        upperBoundPct: Number(Math.min(100, interp + 8).toFixed(1)),
        isUpcoming: true,
      });
    }
  }

  const peakPoint = [...hourlyForecast].sort((a, b) => b.predictedPct - a.predictedPct)[0];

  // Zone-level projections
  const locGroups = new Map<string, ParkingRecord[]>();
  for (const r of records) {
    const arr = locGroups.get(r.Parking_Location) ?? [];
    arr.push(r);
    locGroups.set(r.Parking_Location, arr);
  }

  const zonePredictions: ZonePrediction[] = [];
  locGroups.forEach((list, location) => {
    const avg = list.reduce((a, r) => a + r.Occupancy_Percentage, 0) / list.length;
    const byHour = new Map<number, number[]>();
    for (const r of list) {
      const hArr = byHour.get(r.Hour) ?? [];
      hArr.push(r.Occupancy_Percentage);
      byHour.set(r.Hour, hArr);
    }

    let bestH = 9;
    let bestHMean = 0;
    byHour.forEach((vals, h) => {
      const m = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (m > bestHMean) {
        bestHMean = m;
        bestH = h;
      }
    });

    // Daily trend slope for this location
    const dailyPts = list.map((r) => ({
      x: dateIdxMap.get(r.Date) ?? 0,
      y: r.Occupancy_Percentage,
    }));
    const meanX = dailyPts.reduce((a, p) => a + p.x, 0) / dailyPts.length;
    const meanY = avg;
    let num = 0;
    let den = 0;
    for (const p of dailyPts) {
      num += (p.x - meanX) * (p.y - meanY);
      den += (p.x - meanX) ** 2;
    }
    const slope = den > 0 ? Math.max(-2.5, Math.min(2.5, num / den)) : 0;
    const projectedNextPeakPct = Number(
      Math.max(5, Math.min(100, bestHMean + slope * 1.5)).toFixed(1)
    );

    const riskLevel: ZonePrediction['riskLevel'] =
      projectedNextPeakPct >= thresholds.criticalPct
        ? 'Critical Risk'
        : projectedNextPeakPct >= thresholds.highPct
          ? 'Congestion Likely'
          : 'Stable';

    zonePredictions.push({
      location,
      currentAvgPct: Number(avg.toFixed(1)),
      projectedNextPeakPct,
      trendSlopePerDay: Number(slope.toFixed(2)),
      riskLevel,
      projectedPeakHour: `${String(bestH).padStart(2, '0')}:00`,
    });
  });

  zonePredictions.sort((a, b) => b.projectedNextPeakPct - a.projectedNextPeakPct);

  // Statistical confidence based on sample coverage & day span
  const confidencePct = Number(
    Math.min(92, Math.max(45, 50 + Math.min(25, dates.length * 1.8) + Math.min(17, records.length / 40))).toFixed(1)
  );

  return {
    hourlyForecast,
    zonePredictions,
    predictedPeakHour: peakPoint?.timeLabel ?? 'N/A',
    predictedPeakPct: peakPoint?.predictedPct ?? 0,
    confidencePct,
    methodologyNote:
      'Projections combine hourly historical means, per-hour ordinary least-squares (OLS) trend slopes, and ±0.85σ dispersion intervals derived strictly from your active dataset. These are statistical trend projections from simulated/historical records—not live sensor forecasts.',
  };
}

export function generateInsightsAndRecommendations(
  records: ParkingRecord[],
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): {
  insights: string[];
  recommendations: string[];
} {
  if (records.length === 0) {
    return {
      insights: ['No parking records match the active filter selection.'],
      recommendations: ['Click Reset Filters to restore the full dataset view.'],
    };
  }

  const kpis = calculateKpis(records, thresholds);
  const locStats = computeLocationUsage(records, thresholds);
  const hourly = computeHourlyUsage(records);
  const daily = computeDayUsage(records);
  const vehicles = computeVehicleDistribution(records);
  const ww = computeWeekdayVsWeekend(records);

  const insights: string[] = [];
  const recommendations: string[] = [];

  const topLoc = locStats[0];
  const bottomLoc = locStats[locStats.length - 1];

  insights.push(
    `${topLoc.location} has the highest average occupancy at ${topLoc.avgOccupancyPct.toFixed(1)}% (peak ${topLoc.peakOccupancyPct.toFixed(1)}%), leaving an average of ${topLoc.avgAvailable.toFixed(0)} open bays.`
  );

  if (locStats.length > 1) {
    insights.push(
      `${bottomLoc.location} has the lowest average utilization at ${bottomLoc.avgOccupancyPct.toFixed(1)}%, with approximately ${bottomLoc.avgAvailable.toFixed(0)} available spaces on average.`
    );
  }

  if (hourly.length > 0) {
    const sortedHours = [...hourly].sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct);
    const peak = sortedHours[0];
    const quiet = sortedHours[sortedHours.length - 1];
    insights.push(
      `Hourly demand peaks at ${peak.timeLabel} (${peak.avgOccupancyPct.toFixed(1)}% average occupancy) and drops to its lowest level at ${quiet.timeLabel} (${quiet.avgOccupancyPct.toFixed(1)}%).`
    );
  }

  if (daily.length >= 2) {
    const sortedDays = [...daily].sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct);
    const busiest = sortedDays[0];
    const quietest = sortedDays[sortedDays.length - 1];
    const delta = busiest.avgOccupancyPct - quietest.avgOccupancyPct;
    insights.push(
      `${busiest.day} experiences the highest weekly demand (${busiest.avgOccupancyPct.toFixed(1)}%), outpacing ${quietest.day} (${quietest.avgOccupancyPct.toFixed(1)}%) by ${delta.toFixed(1)} percentage points.`
    );
  }

  if (ww.length === 2) {
    const diff = ww[0].avgOccupancyPct - ww[1].avgOccupancyPct;
    insights.push(
      `Weekday occupancy averages ${ww[0].avgOccupancyPct.toFixed(1)}% compared to ${ww[1].avgOccupancyPct.toFixed(1)}% on weekends (${diff >= 0 ? '+' : ''}${diff.toFixed(1)} percentage point spread).`
    );
  }

  if (vehicles.length > 0) {
    const topVeh = vehicles[0];
    insights.push(
      `${topVeh.vehicleType} represents the largest share of parked volume at ${topVeh.sharePct.toFixed(1)}% across ${topVeh.recordCount} observed records.`
    );
  }

  const crowded = locStats
    .filter((l) => l.peakOccupancyPct > thresholds.highPct)
    .map((l) => l.location);
  const spare = locStats.filter((l) => l.avgOccupancyPct < 55).map((l) => l.location);

  if (crowded.length > 0 && spare.length > 0) {
    recommendations.push(
      `Redirect overflow arrivals from high-pressure lots (${crowded.slice(0, 2).join(', ')}) toward spare capacity lots (${spare.slice(0, 2).join(', ')}) around the ${kpis.peakHourLabel} peak window.`
    );
  } else if (crowded.length > 0) {
    recommendations.push(
      `Deploy digital bay-availability signage and staggered arrival incentives for ${crowded.slice(0, 2).join(', ')}, which regularly exceed the ${thresholds.highPct}% congestion threshold.`
    );
  }

  if (kpis.avgOccupancyPct > 75) {
    recommendations.push(
      `Campus-wide utilization is elevated at ${kpis.avgOccupancyPct.toFixed(1)}%. Increase perimeter shuttle frequency and promote carpool/EV bay sharing during morning peaks.`
    );
  } else if (kpis.avgOccupancyPct < 40) {
    recommendations.push(
      `Overall occupancy averages ${kpis.avgOccupancyPct.toFixed(1)}%. Consolidate off-peak lot lighting and patrol routes to active zones to reduce facility overhead.`
    );
  } else {
    recommendations.push(
      `Aggregate campus occupancy is balanced at ${kpis.avgOccupancyPct.toFixed(1)}% (Efficiency Score ${kpis.parkingEfficiencyScore}/100), so capacity management should target the ${kpis.peakHourLabel} rush hour rather than permanent lot expansion.`
    );
  }

  const twoWheeler = vehicles.find((v) => v.vehicleType === 'Two-Wheeler');
  if (twoWheeler && twoWheeler.sharePct >= 35) {
    recommendations.push(
      `Two-wheelers contribute ${twoWheeler.sharePct.toFixed(1)}% of parked volume; re-striping 10–15 underused peripheral car bays into compact two-wheeler stalls can boost effective bay yield.`
    );
  }

  return { insights, recommendations };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function computeStatisticalSummary(records: ParkingRecord[]): StatisticalSummaryRow[] {
  if (records.length === 0) return [];

  const fields: Array<{ label: string; getter: (r: ParkingRecord) => number }> = [
    { label: 'Total_Capacity', getter: (r) => r.Total_Capacity },
    { label: 'Occupied_Spaces', getter: (r) => r.Occupied_Spaces },
    { label: 'Available_Spaces', getter: (r) => r.Available_Spaces },
    { label: 'Occupancy_Percentage', getter: (r) => r.Occupancy_Percentage },
  ];

  return fields.map(({ label, getter }) => {
    const vals = records.map(getter).sort((a, b) => a - b);
    const n = vals.length;
    const mean = vals.reduce((acc, v) => acc + v, 0) / n;
    const variance =
      n > 1 ? vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1) : 0;
    return {
      metric: label,
      count: n,
      mean: Number(mean.toFixed(2)),
      std: Number(Math.sqrt(variance).toFixed(2)),
      min: Number(vals[0].toFixed(2)),
      p25: Number(quantile(vals, 0.25).toFixed(2)),
      median: Number(quantile(vals, 0.5).toFixed(2)),
      p75: Number(quantile(vals, 0.75).toFixed(2)),
      max: Number(vals[n - 1].toFixed(2)),
    };
  });
}

export interface LiveAssistantOverride {
  dataMode: 'live';
  kpis: KpiMetrics;
  locations: LocationStat[];
}

/** Build grounded JSON context for Gemini / Local Dataset Query Engine */
export function buildAssistantContext(
  records: ParkingRecord[],
  thresholds: ThresholdConfig,
  isSimulated: boolean,
  liveOverride?: LiveAssistantOverride
) {
  const isLive = liveOverride?.dataMode === 'live';
  const kpis = isLive ? liveOverride.kpis : calculateKpis(records, thresholds);
  const locations = isLive ? liveOverride.locations : computeLocationUsage(records, thresholds);
  const hourly = computeHourlyUsage(records);
  const daily = computeDayUsage(records);
  const vehicles = computeVehicleDistribution(records);
  const weekdayWeekend = computeWeekdayVsWeekend(records);
  const { insights, recommendations } = generateInsightsAndRecommendations(records, thresholds);
  const predictions = computePredictions(records, thresholds);

  return {
    datasetMode: isLive
      ? 'Live Database Vehicle & History Records'
      : isSimulated
        ? 'Simulated Academic Dataset'
        : 'User Uploaded CSV Dataset',
    kpis,
    thresholds,
    locations,
    hourly,
    daily,
    vehicles,
    weekdayWeekend,
    predictions: {
      predictedPeakHour: predictions.predictedPeakHour,
      predictedPeakPct: predictions.predictedPeakPct,
      confidencePct: predictions.confidencePct,
      highRiskZones: predictions.zonePredictions.filter((z) => z.riskLevel !== 'Stable'),
    },
    insights,
    recommendations,
  };
}

/** Deterministic Dataset Query Engine used when Gemini API is unavailable */
export function answerParkingQuestionLocally(
  question: string,
  records: ParkingRecord[],
  thresholds: ThresholdConfig,
  isSimulated: boolean,
  liveOverride?: LiveAssistantOverride
): string {
  if (records.length === 0 && !liveOverride) {
    return 'There are currently 0 parking records matching your active filters. Click "Reset Filters" to restore dataset rows so I can compute accurate statistics.';
  }

  const ctx = buildAssistantContext(records, thresholds, isSimulated, liveOverride);
  const q = question.toLowerCase();
  const { kpis, locations, hourly, daily, vehicles, recommendations } = ctx;

  // Check if user asks to compare two specific locations
  const mentionedLocs = locations.filter((l) => {
    const base = l.location.toLowerCase().replace(' parking', '');
    return q.includes(base) || q.includes(l.location.toLowerCase());
  });

  if ((q.includes('compare') || mentionedLocs.length >= 2) && mentionedLocs.length >= 2) {
    const [a, b] = mentionedLocs;
    const diff = a.avgOccupancyPct - b.avgOccupancyPct;
    return [
      `Comparison between **${a.location}** and **${b.location}** (${records.length} active records):`,
      `• **${a.location}**: Capacity ${a.totalCapacity} bays · Avg Occupied ${a.avgOccupied.toFixed(1)} · Avg Available ${a.avgAvailable.toFixed(1)} · Avg Occupancy **${a.avgOccupancyPct.toFixed(1)}%** (Peak ${a.peakOccupancyPct.toFixed(1)}%) · Congestion Freq ${a.congestionFreqPct.toFixed(1)}%.`,
      `• **${b.location}**: Capacity ${b.totalCapacity} bays · Avg Occupied ${b.avgOccupied.toFixed(1)} · Avg Available ${b.avgAvailable.toFixed(1)} · Avg Occupancy **${b.avgOccupancyPct.toFixed(1)}%** (Peak ${b.peakOccupancyPct.toFixed(1)}%) · Congestion Freq ${b.congestionFreqPct.toFixed(1)}%.`,
      `• **Summary**: ${diff >= 0 ? a.location : b.location} is busier by **${Math.abs(diff).toFixed(1)} percentage points** on average.`,
    ].join('\n');
  }

  if (mentionedLocs.length === 1 && !q.includes('most crowded')) {
    const loc = mentionedLocs[0];
    return `**${loc.location}** has a total capacity of **${loc.totalCapacity} bays**, with an average of **${loc.avgOccupied.toFixed(1)} occupied** and **${loc.avgAvailable.toFixed(1)} available** spaces (**${loc.avgOccupancyPct.toFixed(1)}%** avg occupancy, peak **${loc.peakOccupancyPct.toFixed(1)}%**, status: ${loc.status}).`;
  }

  if (q.includes('available') || q.includes('open') || q.includes('free')) {
    const mostOpen = [...locations].sort((a, b) => b.avgAvailable - a.avgAvailable)[0];
    return `Across the active zones (total capacity **${kpis.totalCapacity.toLocaleString()} bays**), an average of **${kpis.availableSpaces.toLocaleString()} spaces are available** (${(100 - kpis.avgOccupancyPct).toFixed(1)}% open rate), while **${kpis.occupiedSpaces.toLocaleString()} spaces** are occupied.\n• Most available zone: **${mostOpen.location}** with an average of **${mostOpen.avgAvailable.toFixed(1)} open spaces** (${mostOpen.avgOccupancyPct.toFixed(1)}% occupied).`;
  }

  if (q.includes('crowded') || q.includes('busiest location') || q.includes('most full')) {
    const top = locations[0];
    const second = locations[1];
    return `The most crowded parking location is **${top.location}** at **${top.avgOccupancyPct.toFixed(1)}% average occupancy** (peak **${top.peakOccupancyPct.toFixed(1)}%**, ${top.avgAvailable.toFixed(1)} avg available out of ${top.totalCapacity} bays).${
      second
        ? `\n• Second highest: **${second.location}** at **${second.avgOccupancyPct.toFixed(1)}%** average occupancy.`
        : ''
    }`;
  }

  if (q.includes('average') && (q.includes('occupancy') || q.includes('rate'))) {
    return `The overall **average occupancy rate** across ${kpis.recordCount.toLocaleString()} active records is **${kpis.avgOccupancyPct.toFixed(2)}%**, with a Parking Efficiency Score of **${kpis.parkingEfficiencyScore}/100** (${kpis.occupiedSpaces.toLocaleString()} occupied vs ${kpis.availableSpaces.toLocaleString()} available spaces).`;
  }

  if (q.includes('day') || q.includes('weekday') || q.includes('weekend')) {
    const sortedDays = [...daily].sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct);
    const busiest = sortedDays[0];
    const quietest = sortedDays[sortedDays.length - 1];
    return `**${busiest.day}** has the highest parking demand at **${busiest.avgOccupancyPct.toFixed(1)}%** average occupancy (${busiest.avgOccupied.toFixed(1)} avg occupied spaces).\n• Quietest day: **${quietest.day}** at **${quietest.avgOccupancyPct.toFixed(1)}%** average occupancy.`;
  }

  if (q.includes('hour') || q.includes('time') || q.includes('peak')) {
    const topHours = [...hourly].sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct).slice(0, 3);
    const quietHour = [...hourly].sort((a, b) => a.avgOccupancyPct - b.avgOccupancyPct)[0];
    return `The busiest parking hour is **${kpis.peakHourLabel}** at **${kpis.peakHourOccupancy.toFixed(1)}%** average occupancy.\n• Top 3 peak hours: ${topHours.map((h) => `${h.timeLabel} (${h.avgOccupancyPct.toFixed(1)}%)`).join(', ')}.\n• Quietest hour: **${quietHour.timeLabel}** (${quietHour.avgOccupancyPct.toFixed(1)}%).`;
  }

  if (q.includes('recommend') || q.includes('reduce') || q.includes('congestion') || q.includes('advice')) {
    return [
      `Data-driven recommendations based on ${kpis.recordCount.toLocaleString()} active records (Efficiency Score: **${kpis.parkingEfficiencyScore}/100**):`,
      ...recommendations.map((r, i) => `${i + 1}. ${r}`),
    ].join('\n');
  }

  if (q.includes('vehicle') || q.includes('car') || q.includes('ev') || q.includes('two-wheeler')) {
    return [
      `Vehicle mix across **${kpis.totalVehiclesRecorded.toLocaleString()}** recorded parked vehicle entries:`,
      ...vehicles.map(
        (v) => `• **${v.vehicleType}**: ${v.sharePct.toFixed(1)}% (${v.totalOccupied.toLocaleString()} total occupied counts across ${v.recordCount} records)`
      ),
    ].join('\n');
  }

  if (q.includes('predict') || q.includes('forecast') || q.includes('upcoming')) {
    return `Statistical trend projection (confidence ${ctx.predictions.confidencePct}%): Demand is projected to peak near **${ctx.predictions.predictedPeakHour}** at **${ctx.predictions.predictedPeakPct.toFixed(1)}%**.\n• Zones with elevated risk: ${
      ctx.predictions.highRiskZones.length > 0
        ? ctx.predictions.highRiskZones
            .map((z) => `${z.location} (${z.projectedNextPeakPct}% @ ${z.projectedPeakHour})`)
            .join(', ')
        : 'All zones remain within stable bounds.'
    }`;
  }

  // General summary fallback grounded in actual dataset figures
  const busiestDay = [...daily].sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct)[0];
  return [
    `Summary from the active ${isSimulated ? 'simulated' : 'uploaded'} dataset (**${kpis.recordCount.toLocaleString()} records**):`,
    `• **Capacity & Availability**: ${kpis.occupiedSpaces.toLocaleString()} occupied / ${kpis.availableSpaces.toLocaleString()} available out of ${kpis.totalCapacity.toLocaleString()} bays (**${kpis.avgOccupancyPct.toFixed(1)}%** avg occupancy, Efficiency Score **${kpis.parkingEfficiencyScore}/100**).`,
    `• **Most Crowded Zone**: ${kpis.mostCrowdedLocation} (${kpis.mostCrowdedOccupancy.toFixed(1)}% avg occupancy).`,
    `• **Peak Demand**: ${kpis.peakHourLabel} (${kpis.peakHourOccupancy.toFixed(1)}%) and ${busiestDay ? `${busiestDay.day} (${busiestDay.avgOccupancyPct.toFixed(1)}%)` : 'N/A'}.`,
    `Ask about available spaces, specific locations (e.g., "Compare Main Gate and Hostel Parking"), peak hours, predictions, or congestion recommendations.`,
  ].join('\n');
}

export function buildAnalysisReport(
  records: ParkingRecord[],
  cleaningReport: CleaningReport,
  isSimulated: boolean,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): string {
  const kpis = calculateKpis(records, thresholds);
  const locStats = computeLocationUsage(records, thresholds);
  const dayStats = computeDayUsage(records);
  const { insights, recommendations } = generateInsightsAndRecommendations(records, thresholds);

  const lines: string[] = [
    '# Campus Parking Usage Analysis - Analytical Report',
    `Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
    `Dataset Source: ${isSimulated ? 'Simulated Academic Dataset (not live sensor data)' : 'User Uploaded CSV Dataset'}`,
    '',
    '## 1. Executive KPI Summary',
    `- Records Analyzed: ${kpis.recordCount}`,
    `- Total Parking Capacity: ${kpis.totalCapacity} spaces`,
    `- Average Occupied Spaces: ${kpis.occupiedSpaces} spaces`,
    `- Available Parking Spaces: ${kpis.availableSpaces} spaces`,
    `- Average Occupancy Rate: ${kpis.avgOccupancyPct.toFixed(2)}%`,
    `- Peak Parking Hour: ${kpis.peakHourLabel} (${kpis.peakHourOccupancy.toFixed(2)}%)`,
    `- Most Crowded Parking Location: ${kpis.mostCrowdedLocation} (${kpis.mostCrowdedOccupancy.toFixed(2)}%)`,
    `- Total Vehicles Recorded: ${kpis.totalVehiclesRecorded.toLocaleString()}`,
    `- Parking Efficiency Score: ${kpis.parkingEfficiencyScore}/100`,
    '',
    '## 2. Data Quality & Cleaning Summary',
    `- Dataset Quality Score: ${cleaningReport.qualityScore}%`,
    `- Raw Rows Loaded: ${cleaningReport.rawRows}`,
    `- Cleaned Rows Retained: ${cleaningReport.cleanedRows}`,
    `- Duplicates Removed: ${cleaningReport.duplicatesRemoved}`,
    `- Missing Values Handled: ${cleaningReport.missingValuesHandled}`,
    '',
    '## 3. Location Utilization Breakdown',
  ];

  for (const loc of locStats) {
    lines.push(
      `- ${loc.location}: Capacity ${loc.totalCapacity}, Avg Occupied ${loc.avgOccupied}, Avg Available ${loc.avgAvailable}, Avg Occupancy ${loc.avgOccupancyPct.toFixed(2)}% (Peak ${loc.peakOccupancyPct.toFixed(2)}%) [${loc.status}]`
    );
  }

  lines.push('', '## 4. Weekday Occupancy Summary');
  for (const d of dayStats) {
    lines.push(`- ${d.day}: ${d.avgOccupancyPct.toFixed(2)}% average occupancy`);
  }

  lines.push('', '## 5. Automated Insights');
  insights.forEach((item, idx) => lines.push(`${idx + 1}. ${item}`));

  lines.push('', '## 6. Recommendations');
  recommendations.forEach((item, idx) => lines.push(`${idx + 1}. ${item}`));

  return lines.join('\n');
}

export function computeLiveLocationUsage(
  zones: ZoneConfig[],
  vehicles: LiveVehicleRecord[],
  historyRecords: ParkingRecord[],
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS,
  allowedLocations?: string[]
): LocationStat[] {
  const activeZones = zones.filter((z) => {
    if (!z.active) return false;
    if (allowedLocations && allowedLocations.length > 0 && !allowedLocations.includes(z.name)) {
      return false;
    }
    return true;
  });

  const parkedByLoc = new Map<string, number>();
  for (const v of vehicles) {
    if (v.status === 'parked') {
      parkedByLoc.set(v.location, (parkedByLoc.get(v.location) ?? 0) + 1);
    }
  }

  const histByLoc = new Map<string, { peak: number; count: number; highHits: number; critHits: number }>();
  for (const r of historyRecords) {
    const cur = histByLoc.get(r.Parking_Location) ?? { peak: 0, count: 0, highHits: 0, critHits: 0 };
    cur.peak = Math.max(cur.peak, r.Occupancy_Percentage);
    cur.count += 1;
    if (r.Occupancy_Percentage > thresholds.highPct) cur.highHits += 1;
    if (r.Occupancy_Percentage >= thresholds.criticalPct) cur.critHits += 1;
    histByLoc.set(r.Parking_Location, cur);
  }

  return activeZones
    .map((z) => {
      const cap = Math.max(1, z.capacity);
      const occupied = Math.min(cap, parkedByLoc.get(z.name) ?? 0);
      const available = Math.max(0, cap - occupied);
      const occPct = Number(((occupied / cap) * 100).toFixed(2));
      const hist = histByLoc.get(z.name);
      const peakPct = Number(Math.max(occPct, hist?.peak ?? 0).toFixed(2));

      const status: LocationStat['status'] =
        occPct >= thresholds.criticalPct
          ? 'Critical (>95%)'
          : occPct > thresholds.highPct
            ? 'High Congestion'
            : occPct < thresholds.lowPct
              ? 'Underutilized'
              : 'Balanced';

      return {
        location: z.name,
        totalCapacity: cap,
        avgOccupied: occupied,
        avgAvailable: available,
        avgOccupancyPct: occPct,
        peakOccupancyPct: peakPct,
        congestionFreqPct: hist && hist.count > 0 ? Number(((hist.highHits / hist.count) * 100).toFixed(1)) : occPct > thresholds.highPct ? 100 : 0,
        criticalFreqPct: hist && hist.count > 0 ? Number(((hist.critHits / hist.count) * 100).toFixed(1)) : occPct >= thresholds.criticalPct ? 100 : 0,
        observations: Math.max(occupied, hist?.count ?? 0),
        status,
      };
    })
    .sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct);
}

export function calculateLiveKpis(
  zones: ZoneConfig[],
  vehicles: LiveVehicleRecord[],
  historyRecords: ParkingRecord[],
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS,
  allowedLocations?: string[]
): KpiMetrics {
  const locStats = computeLiveLocationUsage(zones, vehicles, historyRecords, thresholds, allowedLocations);

  if (locStats.length === 0) {
    return calculateKpis([], thresholds);
  }

  let totalCapacity = 0;
  let occupiedSpaces = 0;
  for (const loc of locStats) {
    totalCapacity += loc.totalCapacity;
    occupiedSpaces += loc.avgOccupied;
  }
  const availableSpaces = Math.max(0, totalCapacity - occupiedSpaces);
  const avgOccupancyPct =
    totalCapacity > 0 ? Number(((occupiedSpaces / totalCapacity) * 100).toFixed(2)) : 0;

  const topLoc = locStats[0];
  const hourly = computeHourlyUsage(historyRecords);
  const topHour = [...hourly].sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct)[0];

  const highZones = locStats.filter(
    (l) => l.avgOccupancyPct > thresholds.highPct && l.avgOccupancyPct < thresholds.criticalPct
  ).length;
  const critZones = locStats.filter((l) => l.avgOccupancyPct >= thresholds.criticalPct).length;
  const lowZones = locStats.filter((l) => l.avgOccupancyPct < thresholds.lowPct).length;
  const n = locStats.length;
  const efficiencyRaw =
    100 -
    (highZones / n) * 28 -
    (critZones / n) * 55 -
    (lowZones / n) * 12;
  const parkingEfficiencyScore = Number(Math.max(0, Math.min(100, efficiencyRaw)).toFixed(1));

  return {
    totalCapacity,
    occupiedSpaces,
    availableSpaces,
    avgOccupancyPct,
    peakHourLabel: topHour ? topHour.timeLabel : 'N/A',
    peakHourOccupancy: topHour ? topHour.avgOccupancyPct : avgOccupancyPct,
    mostCrowdedLocation: topLoc.avgOccupied > 0 ? topLoc.location : 'None',
    mostCrowdedOccupancy: topLoc.avgOccupancyPct,
    totalVehiclesRecorded: vehicles.length + historyRecords.filter((r) => r.Source === 'csv').length,
    parkingEfficiencyScore,
    recordCount: vehicles.length + historyRecords.length,
  };
}

export function generateLiveSmartAlerts(
  zones: ZoneConfig[],
  vehicles: LiveVehicleRecord[],
  historyRecords: ParkingRecord[],
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): SmartAlert[] {
  const locStats = computeLiveLocationUsage(zones, vehicles, historyRecords, thresholds);
  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);
  const alerts: SmartAlert[] = [];

  for (const loc of locStats) {
    if (loc.avgOccupancyPct > thresholds.criticalPct || loc.avgOccupancyPct >= thresholds.criticalPct) {
      alerts.push({
        id: `live-crit-${loc.location}`,
        date: today,
        time: nowTime,
        location: loc.location,
        severity: 'critical',
        title: `Critical Occupancy (>${thresholds.criticalPct}%)`,
        message: `${loc.location} is at ${loc.avgOccupancyPct.toFixed(1)}% (${loc.avgOccupied}/${loc.totalCapacity} bays occupied, only ${loc.avgAvailable} open).`,
        occupancyPct: loc.avgOccupancyPct,
      });
    } else if (loc.avgOccupancyPct > thresholds.highPct) {
      alerts.push({
        id: `live-high-${loc.location}`,
        date: today,
        time: nowTime,
        location: loc.location,
        severity: 'high',
        title: `High Congestion Alert (>${thresholds.highPct}%)`,
        message: `${loc.location} is at ${loc.avgOccupancyPct.toFixed(1)}% (${loc.avgOccupied}/${loc.totalCapacity} bays occupied, ${loc.avgAvailable} open).`,
        occupancyPct: loc.avgOccupancyPct,
      });
    }
  }

  // Include historical alert events if CSV/history records also exist
  const historicalAlerts = generateSmartAlerts(historyRecords, thresholds).filter(
    (a) => a.id.startsWith('evt-') || a.id.startsWith('peak-')
  );

  return [...alerts, ...historicalAlerts];
}
