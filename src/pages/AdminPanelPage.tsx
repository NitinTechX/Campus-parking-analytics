import React, { useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Lock,
  LogOut,
  Plus,
  ShieldCheck,
  Sliders,
  Trash2,
} from 'lucide-react';
import type { ActivityEntry, ThresholdConfig, ZoneConfig } from '../types/parking';

interface AdminPanelPageProps {
  role: 'admin' | 'viewer';
  zones: ZoneConfig[];
  thresholds: ThresholdConfig;
  activityLog: ActivityEntry[];
  onSignInAdmin: (passcode: string) => Promise<string | null>;
  onSignOutAdmin: () => Promise<void>;
  onAddZone: (zone: Omit<ZoneConfig, 'id'>) => Promise<string | null>;
  onUpdateZone: (id: string, patch: Partial<ZoneConfig>) => Promise<string | null>;
  onDeleteZone: (id: string) => Promise<string | null>;
  onUpdateThresholds: (next: ThresholdConfig) => Promise<string | null>;
}

export function AdminPanelPage({
  role,
  zones,
  thresholds,
  activityLog,
  onSignInAdmin,
  onSignOutAdmin,
  onAddZone,
  onUpdateZone,
  onDeleteZone,
  onUpdateThresholds,
}: AdminPanelPageProps) {
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCap, setNewCap] = useState('120');
  const [newCategory, setNewCategory] = useState<ZoneConfig['category']>('Academic');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCap, setEditCap] = useState('');

  const [confirmDeleteZone, setConfirmDeleteZone] = useState<ZoneConfig | null>(null);

  const [lowPct, setLowPct] = useState(String(thresholds.lowPct));
  const [highPct, setHighPct] = useState(String(thresholds.highPct));
  const [criticalPct, setCriticalPct] = useState(String(thresholds.criticalPct));

  const isAdmin = role === 'admin';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const err = await onSignInAdmin(passcode);
    if (err) setAuthError(err);
    else setPasscode('');
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    const capNum = Number(newCap);
    if (!newName.trim() || Number.isNaN(capNum) || capNum <= 0) {
      setActionError('Enter a valid zone name and positive bay capacity.');
      return;
    }
    const err = await onAddZone({
      name: newName.trim(),
      code: newCode.trim() || `ZN-${zones.length + 1}`,
      capacity: Math.round(capNum),
      category: newCategory,
      mapX: 30 + ((zones.length * 17) % 55),
      mapY: 30 + ((zones.length * 19) % 50),
      active: true,
    });
    if (err) setActionError(err);
    else {
      setActionSuccess(`Added parking zone "${newName.trim()}".`);
      setNewName('');
      setNewCode('');
      setNewCap('120');
    }
  };

  const handleSaveEdit = async (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    const capNum = Number(editCap);
    if (!editName.trim() || Number.isNaN(capNum) || capNum <= 0) {
      setActionError('Enter a valid name and positive capacity.');
      return;
    }
    const err = await onUpdateZone(id, { name: editName.trim(), capacity: Math.round(capNum) });
    if (err) setActionError(err);
    else {
      setEditingId(null);
      setActionSuccess('Updated parking zone configuration.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteZone) return;
    setActionError(null);
    setActionSuccess(null);
    const err = await onDeleteZone(confirmDeleteZone.id);
    if (err) setActionError(err);
    else setActionSuccess(`Deleted parking zone "${confirmDeleteZone.name}".`);
    setConfirmDeleteZone(null);
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    const err = await onUpdateThresholds({
      lowPct: Number(lowPct),
      highPct: Number(highPct),
      criticalPct: Number(criticalPct),
    });
    if (err) setActionError(err);
    else setActionSuccess('Updated global occupancy alert thresholds.');
  };

  return (
    <div className="space-y-6">
      {/* Server-Enforced Role Access Card */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm dark:shadow-none">
        <div className="flex items-start gap-3">
          {isAdmin ? (
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Role-Based Access Control · Current Role:{' '}
              <span className={isAdmin ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-300'}>
                {isAdmin ? 'Parking Admin (Authenticated)' : 'Read-Only Viewer'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Zone &amp; threshold mutations are enforced on the Express backend via signed HTTP-only session tokens.
              {!isAdmin && ' Demo admin passcode: CAMPUS-ADMIN-2026'}
            </p>
          </div>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={onSignOutAdmin}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            Switch to Viewer
          </button>
        ) : (
          <form onSubmit={handleLogin} className="flex items-center gap-2">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter admin passcode"
              className="bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium whitespace-nowrap"
            >
              Sign In as Admin
            </button>
          </form>
        )}
      </div>

      {authError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-200 text-xs rounded-lg px-4 py-3">
          {authError}
        </div>
      )}
      {actionError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-200 text-xs rounded-lg px-4 py-3">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-200 text-xs rounded-lg px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {actionSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Zone Registry Management */}
        <div className="xl:col-span-8 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-5 shadow-sm dark:shadow-none">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Campus Parking Zone Registry
          </h3>

          {isAdmin && (
            <form
              onSubmit={handleCreateZone}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800"
            >
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New Zone Name (e.g. Science Annex)"
                className="sm:col-span-4 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Code (SA-07)"
                className="sm:col-span-2 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono-num"
              />
              <input
                type="number"
                min={1}
                value={newCap}
                onChange={(e) => setNewCap(e.target.value)}
                placeholder="Capacity"
                className="sm:col-span-2 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono-num"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ZoneConfig['category'])}
                className="sm:col-span-2 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2 text-xs"
              >
                <option value="Academic">Academic</option>
                <option value="Gate">Gate</option>
                <option value="Residential">Residential</option>
                <option value="Dining">Dining</option>
                <option value="Recreation">Recreation</option>
              </select>
              <button
                type="submit"
                className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Zone
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Zone Name</th>
                  <th className="py-2 px-2 font-medium">Code</th>
                  <th className="py-2 px-2 font-medium">Category</th>
                  <th className="py-2 px-2 text-right font-medium">Capacity</th>
                  <th className="py-2 px-2 font-medium">Status</th>
                  {isAdmin && <th className="py-2 pl-2 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
                {zones.map((z) => {
                  const isEditing = editingId === z.id;
                  return (
                    <tr key={z.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-white dark:bg-[#0D1628] border border-blue-500 rounded px-2 py-1 text-xs w-full"
                          />
                        ) : (
                          z.name
                        )}
                      </td>
                      <td className="py-2.5 px-2 font-mono-num text-slate-500 dark:text-slate-400">
                        {z.code}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">
                        {z.category}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono-num text-slate-900 dark:text-slate-100">
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            value={editCap}
                            onChange={(e) => setEditCap(e.target.value)}
                            className="bg-white dark:bg-[#0D1628] border border-blue-500 rounded px-2 py-1 text-xs w-20 text-right font-mono-num"
                          />
                        ) : (
                          `${z.capacity} bays`
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => onUpdateZone(z.id, { active: !z.active })}
                            className={`text-xs font-medium ${
                              z.active
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {z.active ? 'Active' : 'Disabled'}
                          </button>
                        ) : (
                          <span className={z.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                            {z.active ? 'Active' : 'Disabled'}
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-2.5 pl-2 text-right space-x-2 whitespace-nowrap">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(z.id)}
                                className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-slate-500 hover:underline"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(z.id);
                                  setEditName(z.name);
                                  setEditCap(String(z.capacity));
                                }}
                                title="Edit zone"
                                className="p-1 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
                              >
                                <Edit3 className="w-3.5 h-3.5 inline" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteZone(z)}
                                title="Delete zone"
                                className="p-1 text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Threshold Configuration */}
        <div className="xl:col-span-4 bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-4 shadow-sm dark:shadow-none h-fit">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Sliders className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <span>Occupancy Thresholds</span>
          </div>

          <form onSubmit={handleSaveThresholds} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Low Utilization Alert (&lt; %)
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={lowPct}
                onChange={(e) => setLowPct(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono-num disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                High Congestion Alert (&gt; %)
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={highPct}
                onChange={(e) => setHighPct(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono-num disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Critical Alert (&ge; %)
              </label>
              <input
                type="number"
                disabled={!isAdmin}
                value={criticalPct}
                onChange={(e) => setCriticalPct(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0D1628] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono-num disabled:opacity-60"
              />
            </div>

            {isAdmin && (
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
              >
                Save Thresholds
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Activity History Log */}
      <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800/90 rounded-xl p-5 space-y-3 shadow-sm dark:shadow-none">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Platform &amp; Admin Activity History
        </h3>
        <div className="divide-y divide-slate-200 dark:divide-slate-800/70 max-h-72 overflow-y-auto">
          {activityLog.map((entry) => (
            <div key={entry.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {entry.action}
                </span>
                <span className="text-slate-400 mx-1.5">·</span>
                <span className="text-slate-600 dark:text-slate-300">{entry.details}</span>
              </div>
              <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                [{entry.actorRole}] {entry.timestamp.slice(0, 19).replace('T', ' ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteZone && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Confirm Zone Deletion
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong>{confirmDeleteZone.name}</strong> (
              {confirmDeleteZone.code}) from the campus zone registry? This will also update the
              interactive campus map.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteZone(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium"
              >
                Delete Zone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
