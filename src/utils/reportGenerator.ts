import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type {
  CleaningReport,
  ParkingRecord,
  ReportType,
  ThresholdConfig,
} from '../types/parking';
import {
  calculateKpis,
  computeDateTrends,
  computeDayUsage,
  computeHourlyUsage,
  computeLocationUsage,
  computeVehicleDistribution,
  generateInsightsAndRecommendations,
} from './analytics';

export interface ReportPayload {
  title: string;
  subtitle: string;
  dateRange: string;
  kpis: ReturnType<typeof calculateKpis>;
  headers: string[];
  rows: Array<Array<string | number>>;
  findings: string[];
  recommendations: string[];
}

export interface LiveReportOverrides {
  dataMode: 'demo' | 'live';
  kpis: ReturnType<typeof calculateKpis>;
  locationStats: ReturnType<typeof computeLocationUsage>;
  liveVehicleRows?: Array<{
    date: string;
    time: string;
    location: string;
    plateNumber: string;
    vehicleType: string;
    status: string;
    source: string;
  }>;
}

export function buildStructuredReport(
  reportType: ReportType,
  records: ParkingRecord[],
  cleaningReport: CleaningReport,
  thresholds: ThresholdConfig,
  isSimulated: boolean,
  liveOverrides?: LiveReportOverrides
): ReportPayload {
  const isLive = liveOverrides?.dataMode === 'live';
  const kpis = isLive && liveOverrides ? liveOverrides.kpis : calculateKpis(records, thresholds);
  const dates = records.map((r) => r.Date).sort();
  const dateRange =
    dates.length > 0
      ? `${dates[0]} to ${dates[dates.length - 1]}`
      : isLive
        ? new Date().toISOString().slice(0, 10)
        : 'No active dates';
  const { insights, recommendations } = generateInsightsAndRecommendations(records, thresholds);

  let title = 'Occupancy Analysis Report';
  let headers: string[] = [];
  let rows: Array<Array<string | number>> = [];

  if (reportType === 'detailed') {
    title = 'Detailed Parking Activity & Occupancy Report';
    headers = [
      'Date',
      'Time',
      'Location',
      'Vehicle Count',
      'Capacity',
      'Occupancy (%)',
      'Vehicle Type',
      'Source',
    ];
    const sorted = [...records].sort((a, b) =>
      `${b.Date} ${b.Time}`.localeCompare(`${a.Date} ${a.Time}`)
    );
    rows = sorted.map((r) => [
      r.Date,
      r.Time,
      r.Parking_Location,
      r.Occupied_Spaces,
      r.Total_Capacity,
      `${r.Occupancy_Percentage.toFixed(1)}%`,
      r.Vehicle_Type,
      r.Source ?? (isSimulated ? 'simulated' : 'csv'),
    ]);
  } else if (reportType === 'daily') {
    title = 'Daily Parking Utilization Report';
    const trends = computeDateTrends(records);
    headers = ['Date', 'Avg Occupancy (%)', 'Avg Occupied Spaces'];
    rows = trends.map((t) => [t.date, t.avgOccupancyPct, t.avgOccupied]);
  } else if (reportType === 'weekly') {
    title = 'Weekly Parking Demand Report';
    const days = computeDayUsage(records);
    headers = ['Weekday', 'Avg Occupancy (%)', 'Avg Occupied', 'Avg Available', 'Observations'];
    rows = days.map((d) => [
      d.day,
      d.avgOccupancyPct,
      d.avgOccupied,
      d.avgAvailable,
      d.observations,
    ]);
  } else if (reportType === 'monthly') {
    title = 'Monthly Parking Utilization Summary';
    const monthMap = new Map<string, { pctSum: number; occSum: number; count: number }>();
    for (const r of records) {
      const ym = r.Date.slice(0, 7);
      const cur = monthMap.get(ym) ?? { pctSum: 0, occSum: 0, count: 0 };
      cur.pctSum += r.Occupancy_Percentage;
      cur.occSum += r.Occupied_Spaces;
      cur.count += 1;
      monthMap.set(ym, cur);
    }
    headers = ['Month (YYYY-MM)', 'Avg Occupancy (%)', 'Total Occupied Counts', 'Records'];
    rows = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => [ym, Number((v.pctSum / v.count).toFixed(2)), v.occSum, v.count]);
  } else if (reportType === 'location') {
    title = 'Location-Wise Parking Capacity Report';
    const locs =
      isLive && liveOverrides ? liveOverrides.locationStats : computeLocationUsage(records, thresholds);
    headers = [
      'Parking Location',
      'Capacity',
      isLive ? 'Live Occupied' : 'Avg Occupied',
      isLive ? 'Live Available' : 'Avg Available',
      isLive ? 'Occupancy (%)' : 'Avg Occupancy (%)',
      'Peak (%)',
      'Status',
    ];
    rows = locs.map((l) => [
      l.location,
      l.totalCapacity,
      l.avgOccupied,
      l.avgAvailable,
      l.avgOccupancyPct,
      l.peakOccupancyPct,
      l.status,
    ]);
  } else if (reportType === 'vehicle') {
    title = 'Vehicle-Wise Parking Distribution Report';
    const vehicles = computeVehicleDistribution(records);
    headers = ['Vehicle Type', 'Records', 'Total Parked Counts', 'Share (%)'];
    rows = vehicles.map((v) => [v.vehicleType, v.recordCount, v.totalOccupied, v.sharePct]);
  } else {
    title = 'Comprehensive Occupancy Analysis Report';
    const hourly = computeHourlyUsage(records);
    headers = ['Hour', 'Avg Occupancy (%)', 'Avg Occupied', 'Avg Available', 'Observations'];
    rows = hourly.map((h) => [
      h.timeLabel,
      h.avgOccupancyPct,
      h.avgOccupied,
      h.avgAvailable,
      h.observations,
    ]);
  }

  return {
    title,
    subtitle: isLive
      ? `Live Database Records (${kpis.occupiedSpaces} currently parked)`
      : `${isSimulated ? 'Simulated Demo Dataset' : 'Uploaded CSV Dataset'} · Quality Score ${cleaningReport.qualityScore}%`,
    dateRange,
    kpis,
    headers,
    rows,
    findings:
      isLive && records.length === 0
        ? [
            `Live campus capacity is ${kpis.totalCapacity} bays with ${kpis.occupiedSpaces} currently parked (${kpis.avgOccupancyPct.toFixed(1)}% occupancy).`,
          ]
        : insights,
    recommendations:
      isLive && records.length === 0
        ? ['Continue logging vehicle entries/exits or import historical CSV records to unlock hourly trend insights.']
        : recommendations,
  };
}

export function exportReportCsv(payload: ReportPayload, filePrefix: string): void {
  const escape = (val: string | number) => {
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    `# ${payload.title}`,
    `# Date Range: ${payload.dateRange}`,
    `# Source: ${payload.subtitle}`,
    payload.headers.map(escape).join(','),
    ...payload.rows.map((r) => r.map(escape).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filePrefix}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReportExcel(payload: ReportPayload, filePrefix: string): void {
  const wb = XLSX.utils.book_new();

  const summarySheetData = [
    ['Campus Parking Analytics 2.0 - Report'],
    ['Report Title', payload.title],
    ['Date Range', payload.dateRange],
    ['Dataset Info', payload.subtitle],
    [],
    ['KPI Metric', 'Value'],
    ['Total Parking Capacity', payload.kpis.totalCapacity],
    ['Currently Occupied Spaces', payload.kpis.occupiedSpaces],
    ['Available Parking Spaces', payload.kpis.availableSpaces],
    ['Average Occupancy Rate (%)', payload.kpis.avgOccupancyPct],
    ['Peak Parking Hour', `${payload.kpis.peakHourLabel} (${payload.kpis.peakHourOccupancy}%)`],
    ['Most Crowded Location', `${payload.kpis.mostCrowdedLocation} (${payload.kpis.mostCrowdedOccupancy}%)`],
    ['Total Vehicles Recorded', payload.kpis.totalVehiclesRecorded],
    ['Parking Efficiency Score', `${payload.kpis.parkingEfficiencyScore}/100`],
    [],
    ['Key Findings'],
    ...payload.findings.map((f, i) => [`${i + 1}. ${f}`]),
    [],
    ['Recommendations'],
    ...payload.recommendations.map((r, i) => [`${i + 1}. ${r}`]),
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
  const wsData = XLSX.utils.aoa_to_sheet([payload.headers, ...payload.rows]);

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');
  XLSX.utils.book_append_sheet(wb, wsData, 'Report Data');
  XLSX.writeFile(wb, `${filePrefix}.xlsx`);
}

export function exportReportPdf(payload: ReportPayload, filePrefix: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 44;

  // Header Banner
  doc.setFillColor(13, 22, 40);
  doc.rect(0, 0, pageWidth, 86, 'F');
  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(payload.title, margin, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Date Range: ${payload.dateRange}  |  ${payload.subtitle}`, margin, 56);
  doc.text(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, margin, 70);

  y = 110;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. Executive KPI Summary', margin, y);
  y += 16;

  const kpiPairs: Array<[string, string]> = [
    ['Total Capacity', `${payload.kpis.totalCapacity.toLocaleString()} bays`],
    ['Occupied Spaces', `${payload.kpis.occupiedSpaces.toLocaleString()} bays`],
    ['Available Spaces', `${payload.kpis.availableSpaces.toLocaleString()} bays`],
    ['Avg Occupancy Rate', `${payload.kpis.avgOccupancyPct.toFixed(1)}%`],
    ['Peak Hour', `${payload.kpis.peakHourLabel} (${payload.kpis.peakHourOccupancy.toFixed(1)}%)`],
    ['Most Crowded Zone', `${payload.kpis.mostCrowdedLocation}`],
    ['Vehicles Recorded', `${payload.kpis.totalVehiclesRecorded.toLocaleString()}`],
    ['Efficiency Score', `${payload.kpis.parkingEfficiencyScore}/100`],
  ];

  doc.setFontSize(9);
  const colW = (pageWidth - margin * 2) / 2;
  kpiPairs.forEach(([k, v], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = margin + col * colW;
    const ry = y + row * 18;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(`${k}:`, x, ry);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(v, x + 115, ry);
  });

  y += Math.ceil(kpiPairs.length / 2) * 18 + 16;

  // Breakdown Table + Mini Bar Visual
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Analytical Breakdown', margin, y);
  y += 14;

  const usableW = pageWidth - margin * 2;
  const colCount = Math.max(1, payload.headers.length);
  const cellW = usableW / colCount;
  const tableFontSize = colCount >= 7 ? 7 : 8;
  const maxChars = Math.max(10, Math.floor(cellW / (tableFontSize * 0.54)));

  const drawTableHeader = () => {
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, usableW, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(tableFontSize);
    doc.setTextColor(15, 23, 42);
    payload.headers.forEach((h, i) => {
      doc.text(String(h).slice(0, maxChars), margin + i * cellW + 3, y + 13);
    });
    y += 22;
  };

  drawTableHeader();

  doc.setFont('helvetica', 'normal');
  for (const row of payload.rows.slice(0, 50)) {
    if (y > 750) {
      doc.addPage();
      y = 48;
      drawTableHeader();
      doc.setFont('helvetica', 'normal');
    }
    doc.setFontSize(tableFontSize);
    row.forEach((cell, i) => {
      doc.text(String(cell).slice(0, maxChars), margin + i * cellW + 3, y + 11);
    });
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 16, pageWidth - margin, y + 16);
    y += 18;
  }

  y += 14;
  if (y > 680) {
    doc.addPage();
    y = 48;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. Key Findings & Recommendations', margin, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const item of [...payload.findings, ...payload.recommendations]) {
    const wrapped = doc.splitTextToSize(`• ${item}`, usableW);
    if (y + wrapped.length * 12 > 780) {
      doc.addPage();
      y = 48;
    }
    doc.text(wrapped, margin, y);
    y += wrapped.length * 12 + 4;
  }

  doc.save(`${filePrefix}.pdf`);
}
