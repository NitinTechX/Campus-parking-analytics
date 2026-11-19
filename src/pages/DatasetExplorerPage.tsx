import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  RotateCcw,
  Search,
  Upload,
} from 'lucide-react';
import type {
  CleaningReport,
  ImportHistoryEntry,
  ParkingRecord,
  ThresholdConfig,
} from '../types/parking';
import {
  recordsToCsv,
  SAMPLE_TEMPLATE_CSV,
  validateAndCleanCsv,
} from '../utils/dataCleaning';

interface DatasetExplorerPageProps {
  records: ParkingRecord[];
  allCleanedRecords: ParkingRecord[];
  cleaningReport: CleaningReport;
  thresholds: ThresholdConfig;
  isSimulated: boolean;
  dataMode?: 'demo' | 'live';
  uploadedFileName: string | null;
  importHistory: ImportHistoryEntry[];
  onCommitImport: (
    mode: 'replace' | 'append',
    parsedRecords: ParkingRecord[],
    report: CleaningReport,
    fileName: string
  ) => Promise<string | null> | void;
  onRestoreSample: () => void;
}

type SortField =
  | 'Date'
  | 'Time'
  | 'Day'
  | 'Parking_Location'
  | 'Total_Capacity'
  | 'Occupied_Spaces'
  | 'Available_Spaces'
  | 'Occupancy_Percentage'
  | 'Vehicle_Type';

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DatasetExplorerPage({
  records,
  allCleanedRecords,
  cleaningReport,
  thresholds,
  isSimulated,
  dataMode = 'demo',
  uploadedFileName,
  importHistory,
  onCommitImport,
  onRestoreSample,
}: DatasetExplorerPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineDate, setInlineDate] = useState('');
  const [inlineLocation, setInlineLocation] = useState('all');
  const [inlineVehicle, setInlineVehicle] = useState('all');
  const [inlinePeriod, setInlinePeriod] = useState('all');
  const [sortField, setSortField] = useState<SortField>('Date');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [committingImport, setCommittingImport] = useState(false);
  const [stagedImport, setStagedImport] = useState<{
    fileName: string;
    records: ParkingRecord[];
    report: CleaningReport;
  } | null>(null);

  const uniqueLocations = useMemo(
    () => Array.from(new Set(records.map((r) => r.Parking_Location))).sort(),
    [records]
  );
  const uniqueVehicles = useMemo(
    () => Array.from(new Set(records.map((r) => r.Vehicle_Type))).sort(),
    [records]
  );
  const uniquePeriods = useMemo(
    () => Array.from(new Set(records.map((r) => r.Time_Period))).sort(),
    [records]
  );

  const searchedRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = records.filter((r) => {
      if (inlineDate && r.Date !== inlineDate) return false;
      if (inlineLocation !== 'all' && r.Parking_Location !== inlineLocation) return false;
      if (inlineVehicle !== 'all' && r.Vehicle_Type !== inlineVehicle) return false;
      if (inlinePeriod !== 'all' && r.Time_Period !== inlinePeriod) return false;
      if (!q) return true;
      return [
        r.Date,
        r.Time,
        r.Day,
        r.Parking_Location,
        r.Vehicle_Type,
        String(r.Occupancy_Percentage),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    return [...base].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
  }, [
    records,
    searchQuery,
    inlineDate,
    inlineLocation,
    inlineVehicle,
    inlinePeriod,
    sortField,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(searchedRecords.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = searchedRecords.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
    setPage(1);
  };

  const processCsvFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type && !file.type.includes('csv')) {
      setUploadError('Invalid file format. Please upload a .csv file.');
      setStagedImport(null);
      return;
    }
    const text = await file.text();
    const result = validateAndCleanCsv(text);
    if (result.error || result.records.length === 0) {
      setUploadError(result.error ?? 'Uploaded CSV contained zero valid rows.');
      setStagedImport(null);
      return;
    }
    setUploadError(null);
    setStagedImport({
      fileName: file.name,
      records: result.records,
      report: result.cleaningReport,
    });
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop CSV Upload + Preview Staging */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Advanced CSV Data Management
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Required: Date, Time, Parking_Location, Total_Capacity, Occupied_Spaces (optional: Day, Available_Spaces, Vehicle_Type). Existing data is preserved until you confirm import.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                triggerDownload(SAMPLE_TEMPLATE_CSV, 'campus_parking_template.csv', 'text/csv')
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Sample Template
            </button>
            <button
              type="button"
              onClick={() =>
                triggerDownload(
                  recordsToCsv(allCleanedRecords),
                  'cleaned_campus_parking_dataset.csv',
                  'text/csv'
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Export Cleaned CSV
            </button>
            {dataMode === 'demo' && !isSimulated && (
              <button
                type="button"
                onClick={onRestoreSample}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Simulated
              </button>
            )}
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) processCsvFile(file);
          }}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
              : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/70 dark:bg-[#0D1628]'
          }`}
        >
          <Upload className="w-6 h-6 text-blue-600 dark:text-cyan-400 mb-2" />
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
            Drag &amp; drop a CSV dataset here, or click to browse
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Active source:{' '}
            {dataMode === 'live'
              ? `Live Database (${allCleanedRecords.length} persisted history records)`
              : isSimulated
                ? 'Simulated Demo Campus Dataset (588 records)'
                : `Uploaded CSV (${uploadedFileName})`}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processCsvFile(file);
              e.target.value = '';
            }}
            className="hidden"
          />
        </label>

        {uploadError && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-200 text-xs rounded-lg px-4 py-3">
            <strong>Validation Error:</strong> {uploadError}
          </div>
        )}

        {/* Staging Preview Before Importing */}
        {stagedImport && (
          <div className="border border-blue-300 dark:border-blue-700/60 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Preview Ready: {stagedImport.fileName} ({stagedImport.report.cleanedRows} valid
                  rows · Quality Score {stagedImport.report.qualityScore}%)
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 font-mono-num">
                  Missing handled: {stagedImport.report.missingValuesHandled} · Duplicates removed:{' '}
                  {stagedImport.report.duplicatesRemoved} · Invalid dates/capacity dropped:{' '}
                  {stagedImport.report.invalidDatesDropped +
                    stagedImport.report.invalidCapacityDropped}{' '}
                  · Negatives fixed: {stagedImport.report.negativeValuesFixed}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={committingImport}
                  onClick={async () => {
                    setCommittingImport(true);
                    setImportFeedback(null);
                    const err = await onCommitImport(
                      'replace',
                      stagedImport.records,
                      stagedImport.report,
                      stagedImport.fileName
                    );
                    setCommittingImport(false);
                    if (err) {
                      setUploadError(err);
                    } else {
                      setImportFeedback(
                        `Imported ${stagedImport.records.length} record(s) from "${stagedImport.fileName}"${
                          dataMode === 'live' ? ' into the persistent database' : ''
                        }.`
                      );
                      setStagedImport(null);
                      setPage(1);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium"
                >
                  {committingImport ? 'Importing...' : dataMode === 'live' ? 'Replace DB History' : 'Replace Active Dataset'}
                </button>
                <button
                  type="button"
                  disabled={committingImport}
                  onClick={async () => {
                    setCommittingImport(true);
                    setImportFeedback(null);
                    const err = await onCommitImport(
                      'append',
                      stagedImport.records,
                      stagedImport.report,
                      stagedImport.fileName
                    );
                    setCommittingImport(false);
                    if (err) {
                      setUploadError(err);
                    } else {
                      setImportFeedback(
                        `Appended ${stagedImport.records.length} record(s) from "${stagedImport.fileName}"${
                          dataMode === 'live' ? ' into the persistent database' : ''
                        }.`
                      );
                      setStagedImport(null);
                      setPage(1);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium"
                >
                  {committingImport ? 'Importing...' : dataMode === 'live' ? 'Append to DB' : 'Append to Existing'}
                </button>
                <button
                  type="button"
                  onClick={() => setStagedImport(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-48">
              <table className="w-full text-[11px] text-left">
                <thead>
                  <tr className="border-b border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                    <th className="py-1.5 px-2">Date</th>
                    <th className="py-1.5 px-2">Time</th>
                    <th className="py-1.5 px-2">Location</th>
                    <th className="py-1.5 px-2 text-right">Capacity</th>
                    <th className="py-1.5 px-2 text-right">Occupied</th>
                    <th className="py-1.5 px-2 text-right">Available</th>
                    <th className="py-1.5 px-2 text-right">Occ %</th>
                    <th className="py-1.5 px-2">Vehicle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono-num">
                  {stagedImport.records.slice(0, 8).map((r, idx) => (
                    <tr key={idx}>
                      <td className="py-1 px-2">{r.Date}</td>
                      <td className="py-1 px-2">{r.Time}</td>
                      <td className="py-1 px-2 font-sans">{r.Parking_Location}</td>
                      <td className="py-1 px-2 text-right">{r.Total_Capacity}</td>
                      <td className="py-1 px-2 text-right">{r.Occupied_Spaces}</td>
                      <td className="py-1 px-2 text-right">{r.Available_Spaces}</td>
                      <td className="py-1 px-2 text-right">{r.Occupancy_Percentage.toFixed(1)}%</td>
                      <td className="py-1 px-2 font-sans">{r.Vehicle_Type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {importFeedback && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-200 text-xs rounded-lg px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{importFeedback}</span>
          </div>
        )}
      </div>

      {/* Dataset Quality & Cleaning Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Records', value: cleaningReport.cleanedRows.toLocaleString() },
          { label: 'Dataset Quality Score', value: `${cleaningReport.qualityScore.toFixed(1)}%` },
          { label: 'Missing Values Handled', value: cleaningReport.missingValuesHandled.toLocaleString() },
          { label: 'Duplicate Records', value: cleaningReport.duplicatesRemoved.toLocaleString() },
          { label: 'Invalid Dates/Cap', value: (cleaningReport.invalidDatesDropped + cleaningReport.invalidCapacityDropped).toLocaleString() },
          { label: 'Negatives/Clamped', value: (cleaningReport.negativeValuesFixed + cleaningReport.clampedOccupiedRows).toLocaleString() },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-3.5"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.label}</div>
            <div className="text-xl font-bold font-mono-num text-slate-900 dark:text-slate-100 mt-1">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Explorer Search, Inline Filters & Table */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative min-w-[220px] flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search records..."
                className="w-full bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>

            <input
              type="date"
              value={inlineDate}
              onChange={(e) => {
                setInlineDate(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs font-mono-num text-slate-800 dark:text-slate-200"
            />

            <select
              value={inlinePeriod}
              onChange={(e) => {
                setInlinePeriod(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Time Periods</option>
              {uniquePeriods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={inlineLocation}
              onChange={(e) => {
                setInlineLocation(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Locations</option>
              {uniqueLocations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <select
              value={inlineVehicle}
              onChange={(e) => {
                setInlineVehicle(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Vehicles</option>
              {uniqueVehicles.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() =>
              triggerDownload(
                recordsToCsv(searchedRecords),
                'filtered_campus_parking_data.csv',
                'text/csv'
              )
            }
            disabled={searchedRecords.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download Filtered CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                {(
                  [
                    ['Date', 'Date'],
                    ['Time', 'Time'],
                    ['Day', 'Day'],
                    ['Parking_Location', 'Location'],
                    ['Total_Capacity', 'Capacity'],
                    ['Occupied_Spaces', 'Occupied'],
                    ['Available_Spaces', 'Available'],
                    ['Occupancy_Percentage', 'Occupancy %'],
                    ['Vehicle_Type', 'Vehicle'],
                  ] as Array<[SortField, string]>
                ).map(([field, label]) => {
                  const isNumeric = [
                    'Total_Capacity',
                    'Occupied_Spaces',
                    'Available_Spaces',
                    'Occupancy_Percentage',
                  ].includes(field);
                  return (
                    <th key={field} className={`py-2.5 px-2.5 font-medium ${isNumeric ? 'text-right' : ''}`}>
                      <button
                        type="button"
                        onClick={() => handleSort(field)}
                        className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200"
                      >
                        <span>{label}</span>
                        <ArrowDownUp className="w-3 h-3 opacity-60" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No records match your search or filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => (
                  <tr
                    key={`${r.Date}-${r.Time}-${r.Parking_Location}-${r.Vehicle_Type}-${i}`}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/35"
                  >
                    <td className="py-2.5 px-2.5 font-mono-num text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {r.Date}
                    </td>
                    <td className="py-2.5 px-2.5 font-mono-num text-slate-600 dark:text-slate-300">
                      {r.Time}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-700 dark:text-slate-300">{r.Day}</td>
                    <td className="py-2.5 px-2.5 font-medium text-slate-900 dark:text-slate-100">
                      {r.Parking_Location}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono-num text-slate-600 dark:text-slate-300">
                      {r.Total_Capacity}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono-num text-blue-600 dark:text-blue-300">
                      {r.Occupied_Spaces}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono-num text-emerald-600 dark:text-emerald-300">
                      {r.Available_Spaces}
                    </td>
                    <td
                      className={`py-2.5 px-2.5 text-right font-mono-num font-semibold ${
                        r.Occupancy_Percentage > thresholds.highPct
                          ? 'text-red-600 dark:text-red-400'
                          : r.Occupancy_Percentage < thresholds.lowPct
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {r.Occupancy_Percentage.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-700 dark:text-slate-300">
                      {r.Vehicle_Type}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">
            Showing {pageRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
            {(safePage - 1) * pageSize + pageRows.length} of {searchedRecords.length} records
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-200"
            >
              Previous
            </button>
            <span className="font-mono-num text-slate-700 dark:text-slate-300">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-200"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Dataset Import History */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-3 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <History className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
          <span>Dataset Import History</span>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800/70 text-xs">
          {importHistory.map((item) => (
            <div key={item.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {item.fileName}
                </span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="text-slate-600 dark:text-slate-300">
                  Mode: {item.mode} · {item.cleanedRows}/{item.rawRows} rows retained · Quality{' '}
                  {item.qualityScore}%
                </span>
              </div>
              <span className="font-mono-num text-slate-500 dark:text-slate-400">
                {item.timestamp.slice(0, 19).replace('T', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
