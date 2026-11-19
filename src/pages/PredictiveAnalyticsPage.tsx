import React from 'react';
import { AlertTriangle, Info, TrendingUp } from 'lucide-react';
import { PredictionForecastChart } from '../components/Charts';
import type { PredictionReport, ThresholdConfig } from '../types/parking';

export function PredictiveAnalyticsPage({
  predictions,
  thresholds,
}: {
  predictions: PredictionReport;
  thresholds: ThresholdConfig;
}) {
  return (
    <div className="space-y-6">
      {/* Methodology & Limitations Disclosure */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-700 dark:text-slate-200">
        <Info className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Statistical Forecast Disclosure:</strong>{' '}
          {predictions.methodologyNote}
        </div>
      </div>

      {/* Forecast Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Predicted Peak Demand Hour</div>
          <div className="text-2xl font-bold font-mono-num text-blue-600 dark:text-cyan-300 mt-1.5">
            {predictions.predictedPeakHour}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Projected campus average: {predictions.predictedPeakPct.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Zones Projected High Risk</div>
          <div className="text-2xl font-bold font-mono-num text-red-600 dark:text-red-400 mt-1.5">
            {predictions.zonePredictions.filter((z) => z.riskLevel !== 'Stable').length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Exceeding {thresholds.highPct}% threshold at projected peak
          </div>
        </div>

        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Model Statistical Confidence</div>
          <div className="text-2xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1.5">
            {predictions.confidencePct.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Based on active sample span &amp; hourly variance
          </div>
        </div>
      </div>

      {/* Forecast Chart */}
      <PredictionForecastChart data={predictions.hourlyForecast} />

      {/* Zone Risk Projection Table */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Zone-Level Congestion Risk Projections
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            OLS trend slope per day + peak hour projection
          </span>
        </div>

        {predictions.zonePredictions.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No records available to project zone congestion.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Parking Zone</th>
                  <th className="py-2.5 px-3 text-right font-medium">Current Avg</th>
                  <th className="py-2.5 px-3 text-right font-medium">Projected Peak</th>
                  <th className="py-2.5 px-3 text-right font-medium">Likely Peak Hour</th>
                  <th className="py-2.5 px-3 text-right font-medium">Daily Trend Slope</th>
                  <th className="py-2.5 pl-3 font-medium">Risk Classification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
                {predictions.zonePredictions.map((z) => (
                  <tr key={z.location} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {z.location}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-600 dark:text-slate-300">
                      {z.currentAvgPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900 dark:text-white">
                      {z.projectedNextPeakPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-blue-600 dark:text-cyan-300">
                      {z.projectedPeakHour}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-600 dark:text-slate-300">
                      {z.trendSlopePerDay >= 0 ? `+${z.trendSlopePerDay}` : z.trendSlopePerDay}%/day
                    </td>
                    <td className="py-2.5 pl-3">
                      {z.riskLevel === 'Critical Risk' ? (
                        <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Critical Risk
                        </span>
                      ) : z.riskLevel === 'Congestion Likely' ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-300 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Congestion Likely
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Stable
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
