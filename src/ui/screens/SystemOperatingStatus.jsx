import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw, Activity } from 'lucide-react';
import { useSystemControl } from '../context/SystemControlContext';
import navigation from '../constants/navigation';

const { valueSystemGroups, tabToGroup } = navigation;
const MODULE_GROUP_ORDER = [
    'uploadReports',
    'uploadSingleReport',
    'taqeemInfo',
    'deleteReport',
    'evaluationSources',
    'settings',
    'companyConsole',
    'adminConsole'
];

const buildOrderedGroups = (groups, order) => {
    const seen = new Set();
    const ordered = [];
    order.forEach((id) => {
        if (groups[id]) {
            ordered.push(groups[id]);
            seen.add(id);
        }
    });
    Object.values(groups).forEach((group) => {
        if (!seen.has(group.id)) {
            ordered.push(group);
        }
    });
    return ordered;
};

const MODULE_GROUPS = buildOrderedGroups(valueSystemGroups, MODULE_GROUP_ORDER);

const SystemOperatingStatus = () => {
    const { systemState, updateSystemState, fetchSystemState, isAdmin } = useSystemControl();
    const DEMO_MODULES = ['taqeem-login', 'profile', 'asset-create', 'packages', 'get-companies'];
    const [draft, setDraft] = useState({
        systemName: 'Electron System',
        mode: 'active',
        expectedReturn: '',
        downtimeDays: 0,
        downtimeHours: 0,
        notes: '',
        partialMessage: '',
        allowedModules: []
    });
    const [draftDirty, setDraftDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [countdown, setCountdown] = useState(null);

    const buildDraftFromState = (state) => ({
        systemName: state.systemName || 'Electron System',
        mode: state.mode || 'active',
        expectedReturn: state.expectedReturn ? state.expectedReturn.split('T')[0] : '',
        downtimeDays: state.downtimeDays || 0,
        downtimeHours: state.downtimeHours ?? 0,
        notes: state.notes || '',
        partialMessage: state.partialMessage || '',
        allowedModules: state.allowedModules?.length
            ? state.allowedModules
            : (state.mode === 'demo' ? DEMO_MODULES : [])
    });

    useEffect(() => {
        if (!systemState || draftDirty) return;
        setDraft(buildDraftFromState(systemState));
    }, [systemState, draftDirty]);

    useEffect(() => {
        if (!systemState) {
            setCountdown(null);
            return;
        }

        const msFromDays = Number(systemState.downtimeDays || 0) * 24 * 60 * 60 * 1000;
        const msFromHours = Number(systemState.downtimeHours || 0) * 60 * 60 * 1000;
        const durationMs = msFromHours > 0 ? msFromHours : msFromDays;

        const target = systemState.expectedReturn
            ? new Date(systemState.expectedReturn).getTime()
            : durationMs > 0
                ? new Date(systemState.updatedAt || Date.now()).getTime() + durationMs
                : null;

        if (!target || Number.isNaN(target)) {
            setCountdown(null);
            return;
        }

        const formatRemaining = (ms) => {
            const clamped = Math.max(0, ms);
            const totalSeconds = Math.floor(clamped / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const pad = (v) => String(v).padStart(2, '0');
            return {
                days: pad(days),
                hours: pad(hours),
                minutes: pad(minutes),
                seconds: pad(seconds)
            };
        };

        const tick = () => {
            const now = Date.now();
            setCountdown(formatRemaining(target - now));
        };

        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [systemState]);

    const handleInput = (field, value) => {
        setDraftDirty(true);
        setDraft((prev) => ({ ...prev, [field]: value }));
    };

    const toggleGroup = (group) => {
        setDraftDirty(true);
        setDraft((prev) => {
            const groupTabIds = group.tabs.map((tab) => tab.id);
            const hasGroup = prev.allowedModules.includes(group.id);
            const hasAnyChild = groupTabIds.some((id) => prev.allowedModules.includes(id));
            if (hasGroup || hasAnyChild) {
                const allowedModules = prev.allowedModules.filter(
                    (id) => id !== group.id && !groupTabIds.includes(id)
                );
                return { ...prev, allowedModules };
            }
            return { ...prev, allowedModules: [...prev.allowedModules, group.id] };
        });
    };

    const toggleModule = (moduleId) => {
        setDraftDirty(true);
        setDraft((prev) => {
            const exists = prev.allowedModules.includes(moduleId);
            if (exists) {
                return { ...prev, allowedModules: prev.allowedModules.filter((m) => m !== moduleId) };
            }
            const allowedModules = [...prev.allowedModules, moduleId];
            const groupId = tabToGroup?.[moduleId];
            if (groupId && !allowedModules.includes(groupId)) {
                allowedModules.push(groupId);
            }
            return { ...prev, allowedModules };
        });
    };

    const computeExpectedFromDays = (days) => {
        const start = new Date();
        const num = Number(days);
        if (Number.isNaN(num) || num <= 0) return '';
        const date = new Date(start.getTime() + num * 24 * 60 * 60 * 1000);
        return date.toISOString().slice(0, 10);
    };

    const computeExpectedFromHours = (hours) => {
        const start = new Date();
        const num = Number(hours);
        if (Number.isNaN(num) || num <= 0) return '';
        const date = new Date(start.getTime() + num * 60 * 60 * 1000);
        return date.toISOString().slice(0, 10);
    };

    const computeDaysFromExpected = (dateStr) => {
        if (!dateStr) return '';
        const target = new Date(dateStr).getTime();
        if (Number.isNaN(target)) return '';
        const now = Date.now();
        const diffMs = target - now;
        return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const allowedModules =
                draft.mode === 'partial'
                    ? draft.allowedModules
                    : draft.mode === 'demo'
                        ? DEMO_MODULES
                        : [];

            await updateSystemState({
                mode: draft.mode,
                expectedReturn: draft.expectedReturn || null,
                downtimeDays: Number(draft.downtimeDays) || 0,
                downtimeHours: Number(draft.downtimeHours) || 0,
                notes: draft.notes,
                partialMessage: draft.partialMessage,
                allowedModules
            });
            setDraftDirty(false);
            alert('System state updated.');
            await fetchSystemState();
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Failed to update system state';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const allowedLookup = useMemo(() => new Set(draft.allowedModules), [draft.allowedModules]);

    if (!isAdmin) {
        return (
            <div className="p-6">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                        <h2 className="text-[15px] font-semibold text-amber-900">Admin access required</h2>
                        <p className="text-[11px] text-amber-700">
                            Please sign in with an admin account to manage the Electron System operating state.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-900/15 bg-gradient-to-r from-white via-blue-50 to-white px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-sm">
                        <Activity className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-blue-900/60 font-semibold">
                            Electron System
                        </div>
                        <h2 className="text-lg font-bold text-blue-950">Operating Status</h2>
                        <p className="text-[11px] text-slate-600">
                            Keep the system available, paused, or partially enabled. Changes apply instantly for non-admin users.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {systemState?.mode === 'inactive' && (
                        <button
                            onClick={async () => {
                                setSaving(true);
                                try {
                                    await updateSystemState({
                                        mode: 'active',
                                        expectedReturn: null,
                                        downtimeDays: 0,
                                        downtimeHours: 0,
                                        notes: systemState?.notes || '',
                                        partialMessage: systemState?.partialMessage || '',
                                        allowedModules: systemState?.allowedModules || []
                                    });
                                    await fetchSystemState();
                                    alert('System activated.');
                                } catch (err) {
                                    const msg = err?.response?.data?.message || err.message || 'Failed to activate system';
                                    alert(msg);
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-900 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
                            disabled={saving}
                        >
                            <Activity className="w-4 h-4" />
                            {saving ? 'Activating...' : 'Activate now'}
                        </button>
                    )}
                    <button
                        onClick={fetchSystemState}
                        className="inline-flex items-center gap-2 rounded-md border border-blue-900/20 bg-white px-3 py-2 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {isAdmin && systemState?.mode === 'inactive' && countdown && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-900/15 bg-gradient-to-r from-blue-50 via-white to-blue-50 px-3 py-2 text-[11px] text-blue-900 shadow-sm">
                    <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="w-4 h-4 text-blue-700" />
                        <span>Downtime ends in</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: 'Days', value: countdown.days },
                            { label: 'Hours', value: countdown.hours },
                            { label: 'Minutes', value: countdown.minutes },
                            { label: 'Seconds', value: countdown.seconds }
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="px-3 py-2 rounded-xl bg-white border border-blue-900/10 text-center shadow-sm"
                            >
                                <div className="text-[15px] font-semibold text-blue-900 leading-tight">{item.value}</div>
                                <div className="text-[9px] uppercase tracking-wide text-blue-900/60">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-blue-900/15 bg-white shadow-sm p-4 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-900/10 flex items-center justify-center text-blue-900 font-semibold">
                            ES
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-blue-900/50">System</p>
                            <p className="text-[15px] font-semibold text-blue-950">{draft.systemName}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-900/10">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-blue-900/50">Current mode</p>
                            <p className="text-[13px] font-semibold text-blue-950 capitalize">{draft.mode}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-900/10">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-blue-900/50">Downtime (days)</p>
                            <p className="text-[13px] font-semibold text-blue-950">{draft.downtimeDays || 0}</p>
                        </div>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-900/10 text-[11px] text-blue-900/80">
                        Keep the controls simple: pick a mode, add optional notes, and choose allowed modules for partial mode.
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="rounded-2xl border border-blue-900/15 bg-white shadow-sm p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-blue-950">Operation mode</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {['active', 'inactive', 'partial', 'demo'].map((opt) => (
                                <label
                                    key={opt}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold ${draft.mode === opt ? 'border-blue-900/30 bg-blue-50 text-blue-950' : 'border-blue-900/15 text-slate-700'}`}
                                >
                                    <input
                                        type="radio"
                                        name="mode"
                                        value={opt}
                                        checked={draft.mode === opt}
                                        onChange={(e) => handleInput('mode', e.target.value)}
                                        className="h-4 w-4 text-blue-900 border-blue-400 focus:ring-blue-600"
                                    />
                                    <span className="capitalize">{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {draft.mode !== 'active' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-blue-950 mb-1">Expected return</label>
                                <input
                                    type="date"
                                    value={draft.expectedReturn || ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setDraftDirty(true);
                                        if (!value) {
                                            setDraft((prev) => ({
                                                ...prev,
                                                expectedReturn: '',
                                                downtimeDays: 0,
                                                downtimeHours: 0
                                            }));
                                            return;
                                        }
                                        const days = computeDaysFromExpected(value);
                                        setDraft((prev) => ({
                                            ...prev,
                                            expectedReturn: value,
                                            downtimeDays: days === '' ? prev.downtimeDays : days,
                                            downtimeHours: days === '' ? prev.downtimeHours : Number(days) * 24
                                        }));
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-blue-950 mb-1">Downtime (days)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.00001"
                                    value={draft.downtimeDays}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        const expectedReturn = computeExpectedFromDays(value);
                                        setDraftDirty(true);
                                        setDraft((prev) => ({
                                            ...prev,
                                            downtimeDays: value,
                                            downtimeHours: prev.downtimeHours,
                                            expectedReturn
                                        }));
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                />
                            </div>
                        </div>
                    )}

                    {draft.mode === 'inactive' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-blue-950 mb-1">Inactive duration (hours)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.00001"
                                    value={draft.downtimeHours}
                                    onChange={(e) => {
                                        const hoursVal = e.target.value;
                                        const daysFromHours = Number(hoursVal) / 24;
                                        setDraftDirty(true);
                                        setDraft((prev) => ({
                                            ...prev,
                                            downtimeHours: hoursVal,
                                            expectedReturn: null, // rely on hours/days duration for countdown/expiry
                                            downtimeDays: Number.isNaN(daysFromHours) ? prev.downtimeDays : Number(daysFromHours.toFixed(3))
                                        }));
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                />
                            </div>
                            <div className="flex items-end">
                                <div className="w-full px-3 py-2 rounded-lg bg-blue-50 border border-blue-900/10 text-[11px] text-blue-900/70">
                                    Hours stay exactly as you enter them. Set days/hours to 0 to keep the system inactive until you switch it back.
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[11px] font-semibold text-blue-950 mb-1">Notes</label>
                        <textarea
                            value={draft.notes}
                            onChange={(e) => handleInput('notes', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                            rows={3}
                            placeholder="Planned maintenance or context for users"
                        />
                    </div>

                    {draft.mode === 'partial' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-blue-950 mb-1">Partial mode message</label>
                                <input
                                    type="text"
                                    value={draft.partialMessage}
                                    onChange={(e) => handleInput('partialMessage', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                    placeholder="Shown to users when features are limited"
                                />
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold text-blue-950 mb-2">Allowed modules</p>
                                <div className="space-y-4">
                                    {MODULE_GROUPS.map((group) => {
                                        const groupChecked = allowedLookup.has(group.id)
                                            || group.tabs.some((tab) => allowedLookup.has(tab.id));
                                        return (
                                            <div key={group.id} className="space-y-2">
                                                <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-900/60">
                                                    <input
                                                        type="checkbox"
                                                        checked={groupChecked}
                                                        onChange={() => toggleGroup(group)}
                                                        className="h-4 w-4 text-blue-900 border-blue-400 focus:ring-blue-600"
                                                    />
                                                    <span>{group.title}</span>
                                                </label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {group.tabs.map((mod) => (
                                                        <label
                                                            key={mod.id}
                                                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] ${allowedLookup.has(mod.id) ? 'border-blue-900/30 bg-blue-50 text-blue-950' : 'border-blue-900/15 text-slate-700'
                                                                }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={allowedLookup.has(mod.id)}
                                                                onChange={() => toggleModule(mod.id)}
                                                                className="h-4 w-4 text-blue-900 border-blue-400 focus:ring-blue-600"
                                                            />
                                                            <span>{mod.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center justify-center rounded-md bg-blue-900 px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
                        >
                            {saving ? 'Saving...' : 'Save state'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setDraftDirty(false);
                                if (systemState) {
                                    setDraft(buildDraftFromState(systemState));
                                }
                                fetchSystemState();
                            }}
                            className="inline-flex items-center justify-center rounded-md border border-blue-900/20 bg-white px-4 py-2 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
                        >
                            Reset changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SystemOperatingStatus;
