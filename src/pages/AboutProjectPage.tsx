import React, { useState } from 'react';
import { Code2, Download, FolderGit2 } from 'lucide-react';
import { downloadPythonProjectZip, PYTHON_PROJECT_FILES } from '../utils/projectZip';

export function AboutProjectPage() {
  const [selectedFile, setSelectedFile] = useState(PYTHON_PROJECT_FILES[0].path);
  const [imgError, setImgError] = useState(false);

  const activeSource =
    PYTHON_PROJECT_FILES.find((f) => f.path === selectedFile)?.content ?? '';

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
        {!imgError ? (
          <img
            src="/src/assets/images/project_banner_1795108374652.jpg"
            alt="Campus Parking Analytics isometric architectural illustration"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-56 md:h-72 object-cover"
          />
        ) : (
          <div className="w-full h-56 bg-gradient-to-br from-[#0F2347] to-[#0A1120] flex items-center justify-center text-slate-200 text-sm font-medium">
            Campus Parking Analytics 2.0 — Smart Campus Parking Management Platform
          </div>
        )}
        <div className="p-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800/80">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Campus Parking Analytics 2.0
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Smart Campus Parking Management Platform · Full-Stack Analytics, Predictive Modeling &amp; Python/Streamlit Companion
            </p>
          </div>
          <button
            type="button"
            onClick={downloadPythonProjectZip}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download Python &amp; Streamlit Project (.zip)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-3 shadow-sm dark:shadow-none">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Problem Statement
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            University campuses experience recurring parking bottlenecks near main gates and
            academic blocks during peak morning lecture transitions, while peripheral zones such as
            libraries or sports complexes retain unused bays. Without temporal, spatial, and
            predictive analytics, campus administrators lack quantitative visibility to rebalance
            demand.
          </p>
        </div>

        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-3 shadow-sm dark:shadow-none">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Platform Objectives
          </h3>
          <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300 list-disc pl-5">
            <li>Compute 8 live-recalculated occupancy &amp; efficiency KPIs across campus zones.</li>
            <li>Provide an interactive Campus Parking Map, Zone Comparison, and Smart Alerts (&gt;80% / &ge;95% / &lt;30%).</li>
            <li>Deliver statistical demand forecasting and a grounded AI Parking Assistant.</li>
            <li>Enable drag-and-drop CSV cleaning, admin zone management, and CSV/Excel/PDF reporting.</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-3 shadow-sm dark:shadow-none">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Technologies &amp; Data Science Techniques
          </h3>
          <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300 list-disc pl-5">
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Full-Stack Web Platform:</strong>{' '}
              React 19, TypeScript, Express.js, Tailwind CSS v4, Gemini API (`@google/genai`), jsPDF, SheetJS (`xlsx`).
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Python Companion:</strong>{' '}
              Streamlit, Pandas, NumPy, Plotly, Matplotlib, Seaborn.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Data Science Methods:</strong>{' '}
              Schema validation, median imputation, deduplication, OLS trend projection, confidence bounds, and composite Efficiency Scoring.
            </li>
          </ul>
        </div>

        <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-3 shadow-sm dark:shadow-none">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Data Ethics &amp; Simulation Disclosure
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            The bundled 588-record dataset and schematic campus parking map represent{' '}
            <strong>simulated academic data</strong> for analytical demonstration—not live physical
            parking lot sensors or GPS feeds. Predictive curves represent historical statistical
            trend projections with explicit uncertainty bounds.
          </p>
        </div>
      </div>

      {/* GitHub Source Inspector */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <FolderGit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>GitHub-Ready Python &amp; Streamlit Source Files</span>
          </div>
          <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
            pip install -r requirements.txt · streamlit run app.py
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-1 max-h-80 overflow-y-auto pr-1">
            {PYTHON_PROJECT_FILES.map((file) => {
              const active = file.path === selectedFile;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedFile(file.path)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-mono-num transition-colors ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{file.path}</span>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8 bg-slate-900 dark:bg-[#0A1120] border border-slate-800 rounded-lg p-3 max-h-80 overflow-auto">
            <pre className="text-[11px] leading-relaxed font-mono-num text-slate-200 whitespace-pre">
              {activeSource.slice(0, 12000)}
              {activeSource.length > 12000 ? '\n\n... (download .zip for complete CSV file)' : ''}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
