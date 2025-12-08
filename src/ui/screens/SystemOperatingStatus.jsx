import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw, Activity } from 'lucide-react';
import { useSystemControl } from '../context/SystemControlContext';

const MODULES = [
    { id: 'login', label: 'Login' },
    { id: 'registration', label: 'Registration' },
    { id: 'taqeem-login', label: 'Taqeem Login' },
    { id: 'profile', label: 'My Profile' },
    { id: 'check-status', label: 'Check Browser' },
    { id: 'validate-report', label: 'Validate Report' },
    { id: 'asset-create', label: 'Create Asset' },
    { id: 'upload-excel', label: 'Upload Excel' },
    { id: 'common-fields', label: 'Add Common Fields' },
    { id: 'grab-macro-ids', label: 'Grab Macro IDs' },
    { id: 'macro-edit', label: 'Edit Macro' },
    { id: 'delete-report', label: 'Delete Report' },
    { id: 'get-companies', label: 'Get Companies' },
    { id: 'packages', label: 'Packages & Balance' },
    { id: 'company-members', label: 'Company Members (company head only)' },
    { id: 'system-updates', label: 'System Updates' }
];

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
    const [saving, setSaving] = useState(false);
    const [countdown, setCountdown] = useState(null);

    useEffect(() => {
        if (systemState) {
            setDraft({
                systemName: systemState.systemName || 'Electron System',
                mode: systemState.mode || 'active',
                expectedReturn: systemState.expectedReturn ? systemState.expectedReturn.split('T')[0] : '',
                downtimeDays: systemState.downtimeDays || 0,
                downtimeHours: systemState.downtimeHours ?? 0,
                notes: systemState.notes || '',
                partialMessage: systemState.partialMessage || '',
                allowedModules: systemState.allowedModules?.length
                    ? systemState.allowedModules
                    : (systemState.mode === 'demo' ? DEMO_MODULES : [])
            });
        }
    }, [systemState]);

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
        setDraft((prev) => ({ ...prev, [field]: value }));
    };

    const toggleModule = (moduleId) => {
        setDraft((prev) => {
            const exists = prev.allowedModules.includes(moduleId);
            const allowedModules = exists
                ? prev.allowedModules.filter((m) => m !== moduleId)
                : [...prev.allowedModules, moduleId];
            return { ...prev, allowedModules };
        });
    };

    const computeExpectedFromDays = (days) => {
        const start = new Date();
        const num = Number(days);
        if (Number.isNaN(num)) return '';
        const date = new Date(start.getTime() + num * 24 * 60 * 60 * 1000);
        return date.toISOString().slice(0, 10);
    };

    const computeExpectedFromHours = (hours) => {
        const start = new Date();
        const num = Number(hours);
        if (Number.isNaN(num)) return '';
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
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
                    <div>
                        <h2 className="text-lg font-semibold text-yellow-800">Admin access required</h2>
                        <p className="text-sm text-yellow-700">
                            Please sign in with an admin account to manage the Electron System operating state.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-sm uppercase tracking-wide text-gray-500">Electron System</p>
                    <h1 className="text-3xl font-bold text-gray-900">Operating Status</h1>
                    <p className="text-gray-600 text-sm">Keep the system available, paused, or partially enabled. Changes apply instantly for non-admin users.</p>
                </div>
                <div className="flex items-center gap-2">
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
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                            disabled={saving}
                        >
                            <Activity className="w-4 h-4" />
                            {saving ? 'Activating...' : 'Activate now'}
                        </button>
                    )}
                    <button
                        onClick={fetchSystemState}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-800 border border-gray-300 hover:bg-gray-50"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {isAdmin && systemState?.mode === 'inactive' && countdown && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-blue-900 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 px-4 py-3 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-blue-900">Downtime ends in</span>
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
                                className="px-3 py-2 rounded-lg bg-white border border-blue-100 text-center shadow-xs"
                            >
                                <div className="text-lg font-bold text-blue-800 leading-tight">{item.value}</div>
                                <div className="text-[11px] uppercase tracking-wide text-blue-500">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center text-gray-700 font-semibold">
                            ES
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">System</p>
                            <p className="text-xl font-semibold text-gray-900">{draft.systemName}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase">Current mode</p>
                            <p className="text-base font-semibold text-gray-900 capitalize">{draft.mode}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                            <p className="text-xs text-gray-500 uppercase">Downtime (days)</p>
                            <p className="text-base font-semibold text-gray-900">{draft.downtimeDays || 0}</p>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                        Keep the controls simple: pick a mode, add optional notes, and choose allowed modules for partial mode.
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Operation mode</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {['active', 'inactive', 'partial', 'demo'].map((opt) => (
                                <label
                                    key={opt}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${draft.mode === opt ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
                                >
                                    <input
                                        type="radio"
                                        name="mode"
                                        value={opt}
                                        checked={draft.mode === opt}
                                        onChange={(e) => handleInput('mode', e.target.value)}
                                    />
                                    <span className="capitalize">{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {draft.mode !== 'active' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Expected return</label>
                                <input
                                    type="date"
                                    value={draft.expectedReturn || ''}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        const days = computeDaysFromExpected(value);
                                        setDraft((prev) => ({
                                            ...prev,
                                            expectedReturn: value,
                                            downtimeDays: days === '' ? prev.downtimeDays : days,
                                            downtimeHours: days === '' ? prev.downtimeHours : Number(days) * 24
                                        }));
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Downtime (days)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.00001"
                                    value={draft.downtimeDays}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        const expectedReturn = computeExpectedFromDays(value);
                                        setDraft((prev) => ({
                                            ...prev,
                                            downtimeDays: value,
                                            downtimeHours: prev.downtimeHours,
                                            expectedReturn: expectedReturn || prev.expectedReturn
                                        }));
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {draft.mode === 'inactive' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Inactive duration (hours)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.00001"
                                    value={draft.downtimeHours}
                                    onChange={(e) => {
                                        const hoursVal = e.target.value;
                                        const daysFromHours = Number(hoursVal) / 24;
                                        setDraft((prev) => ({
                                            ...prev,
                                            downtimeHours: hoursVal,
                                            expectedReturn: null, // rely on hours/days duration for countdown/expiry
                                            downtimeDays: Number.isNaN(daysFromHours) ? prev.downtimeDays : Number(daysFromHours.toFixed(3))
                                        }));
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex items-end">
                                <div className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
                                    Hours stay exactly as you enter them; we won't auto-convert them.
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            value={draft.notes}
                            onChange={(e) => handleInput('notes', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={3}
                            placeholder="Planned maintenance or context for users"
                        />
                    </div>

                    {draft.mode === 'partial' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Partial mode message</label>
                                <input
                                    type="text"
                                    value={draft.partialMessage}
                                    onChange={(e) => handleInput('partialMessage', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Shown to users when features are limited"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">Allowed modules</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {MODULES.map((mod) => (
                                        <label
                                            key={mod.id}
                                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${allowedLookup.has(mod.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={allowedLookup.has(mod.id)}
                                                onChange={() => toggleModule(mod.id)}
                                            />
                                            <span className="text-sm text-gray-800">{mod.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                        >
                            {saving ? 'Saving...' : 'Save state'}
                        </button>
                        <button
                            type="button"
                            onClick={fetchSystemState}
                            className="inline-flex items-center justify-center rounded-lg bg-gray-100 px-4 py-2 text-gray-800 font-semibold hover:bg-gray-200"
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
