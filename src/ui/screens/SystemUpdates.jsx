import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { useSystemControl } from '../context/SystemControlContext';
import { AlertTriangle, Download, RefreshCcw, Send, ShieldCheck, Bell } from 'lucide-react';

const typeLabels = {
    feature: 'Feature Addition',
    bugfix: 'Bug Fix',
    security: 'Security',
    maintenance: 'Maintenance',
    other: 'Other'
};

const rolloutLabels = {
    mandatory: 'Mandatory',
    optional: 'Optional',
    monitoring: 'Monitoring'
};

const humanDate = (value) => (value ? new Date(value).toLocaleString() : 'Not scheduled');

const SystemUpdates = () => {
    const { user, token, isAuthenticated } = useSession();
    const { latestUpdate, userUpdateState, fetchUpdateNotice, markDownloaded, applyUpdate } = useSystemControl();
    const isAdmin = user?.phone === '011111';

    const [form, setForm] = useState({
        version: '',
        updateType: 'feature',
        rolloutType: 'optional',
        status: 'active',
        windowStart: '',
        windowEnd: '',
        description: '',
        notes: '',
        broadcast: true
    });
    const [updates, setUpdates] = useState([]);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const [applyMessage, setApplyMessage] = useState('');
    const [showCard, setShowCard] = useState(true);
    const [dismissed, setDismissed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [listLoading, setListLoading] = useState(false);

    const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

    const loadUpdates = async () => {
        if (!isAdmin) return;
        setListLoading(true);
        try {
            const data = await window.electronAPI.apiRequest('GET', '/api/updates', {}, headers);
            setUpdates(data || []);
        } catch (err) {
            console.error('Failed to load updates', err);
        } finally {
            setListLoading(false);
        }
    };

    useEffect(() => {
        loadUpdates();
    }, [isAdmin, headers]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setDismissed(false);
        setShowCard(true);
    }, [latestUpdate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await window.electronAPI.apiRequest('POST', '/api/updates', form, headers);
            setForm({
                version: '',
                updateType: 'feature',
                rolloutType: 'optional',
                status: 'active',
                windowStart: '',
                windowEnd: '',
                description: '',
                notes: '',
                broadcast: true
            });
            await loadUpdates();
            await fetchUpdateNotice();
            alert('Update created and broadcasted.');
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Failed to create update';
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    const patchStatus = async (id, payload) => {
        try {
            await window.electronAPI.apiRequest('PATCH', `/api/updates/${id}/status`, payload, headers);
            await loadUpdates();
            await fetchUpdateNotice();
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Failed to update status';
            alert(msg);
        }
    };

    const isMandatory = latestUpdate?.rolloutType === 'mandatory';

    const handleDownload = async () => {
        if (!latestUpdate) return;
        if (!isAuthenticated) {
            alert('Login to download updates.');
            return;
        }
        try {
            setApplyMessage('');
            setDownloading(true);
            setDownloadProgress(0);

            const stepper = setInterval(() => {
                setDownloadProgress((prev) => {
                    const next = Math.min(prev + 15, 95);
                    return next;
                });
            }, 120);

            await markDownloaded(latestUpdate._id);

            clearInterval(stepper);
            setDownloadProgress(100);
            setTimeout(() => {
                setDownloading(false);
            }, 300);
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Failed to download update';
            alert(msg);
            setDownloading(false);
            setDownloadProgress(0);
        }
    };

    const handleApply = async () => {
        if (!latestUpdate) return;
        if (!isAuthenticated) {
            alert('Login to apply updates.');
            return;
        }
        try {
            await applyUpdate(latestUpdate._id);
            setApplyMessage('Update applied successfully. You are up to date.');
            setShowCard(false);
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Failed to apply update';
            alert(msg);
        }
    };

    return (
        <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-900/15 bg-gradient-to-r from-white via-blue-50 to-white px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-sm">
                        <Bell className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-blue-900/60 font-semibold">
                            Electron System
                        </div>
                        <h2 className="text-lg font-bold text-blue-950">System Updates</h2>
                        <p className="text-[11px] text-slate-600">
                            Publish updates and notify users. Mandatory updates block non-admin access until applied.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        fetchUpdateNotice();
                        loadUpdates();
                    }}
                    className="inline-flex items-center gap-2 rounded-md border border-blue-900/20 bg-white px-3 py-2 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
                >
                    <RefreshCcw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {!isAdmin && latestUpdate && showCard && !dismissed && userUpdateState?.status !== 'applied' && (
                <div className="rounded-2xl border border-blue-900/15 bg-white p-4 space-y-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-blue-900/10 text-blue-900 flex items-center justify-center">
                            <Bell className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[11px] text-slate-700 font-semibold">Update available</p>
                            <p className="text-[15px] font-bold text-blue-950">Version {latestUpdate.version}</p>
                        </div>
                        <span className="ml-auto text-[10px] uppercase bg-blue-50 border border-blue-900/15 px-2 py-1 rounded-full text-blue-900 font-semibold">
                            {typeLabels[latestUpdate.updateType] || latestUpdate.updateType}
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-700">
                        {latestUpdate.description || 'A new update is ready. Download and apply to continue.'}
                    </p>
                    <div className="text-[11px] text-slate-600">
                        Window: {humanDate(latestUpdate.windowStart)} to {humanDate(latestUpdate.windowEnd)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleDownload}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-900 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
                            disabled={downloading}
                        >
                            <Download className="w-4 h-4" />
                            {userUpdateState?.status === 'downloaded' ? 'Downloaded' : (downloading ? 'Downloading...' : 'Download')}
                        </button>
                        {!isMandatory && (
                            <button
                                onClick={() => setDismissed(true)}
                                className="inline-flex items-center gap-2 rounded-md border border-blue-900/20 bg-white px-3 py-2 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
                            >
                                Later
                            </button>
                        )}
                        {userUpdateState?.status === 'downloaded' && (
                            <button
                                onClick={handleApply}
                                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-500"
                                disabled={userUpdateState?.status === 'applied'}
                            >
                                <ShieldCheck className="w-4 h-4" />
                                {userUpdateState?.status === 'applied' ? 'Applied' : 'Apply'}
                            </button>
                        )}
                    </div>
                    {downloading && (
                        <div className="w-full bg-blue-900/10 h-2 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-900 transition-all duration-200"
                                style={{ width: `${downloadProgress}%` }}
                            />
                        </div>
                    )}
                    {applyMessage && (
                        <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                            {applyMessage}
                        </div>
                    )}
                </div>
            )}

            {isAdmin ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <form onSubmit={handleSubmit} className="lg:col-span-1 rounded-2xl border border-blue-900/15 bg-white shadow-sm p-4 space-y-4">
                        <h2 className="text-[15px] font-semibold text-blue-950">Create update</h2>
                        <div>
                            <label className="block text-[11px] font-semibold text-blue-950 mb-1">Version</label>
                            <input
                                type="text"
                                value={form.version}
                                onChange={(e) => setForm({ ...form, version: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                placeholder="e.g., v2.4.0"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-blue-950 mb-1">Type</label>
                                <select
                                    value={form.updateType}
                                    onChange={(e) => setForm({ ...form, updateType: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                >
                                    {Object.keys(typeLabels).map((key) => (
                                        <option key={key} value={key}>{typeLabels[key]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-blue-950 mb-1">Rollout</label>
                                <select
                                    value={form.rolloutType}
                                    onChange={(e) => setForm({ ...form, rolloutType: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                >
                                    {Object.keys(rolloutLabels).map((key) => (
                                        <option key={key} value={key}>{rolloutLabels[key]}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-blue-950 mb-1">Status</label>
                                <select
                                    value={form.status}
                                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="scheduled">Scheduled</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-blue-950">
                                    <input
                                        type="checkbox"
                                        checked={form.broadcast}
                                        onChange={(e) => setForm({ ...form, broadcast: e.target.checked })}
                                    />
                                    Broadcast to users
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-blue-950 mb-1">Schedule window</label>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="datetime-local"
                                    value={form.windowStart}
                                    onChange={(e) => setForm({ ...form, windowStart: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                />
                                <input
                                    type="datetime-local"
                                    value={form.windowEnd}
                                    onChange={(e) => setForm({ ...form, windowEnd: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-blue-950 mb-1">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                rows={3}
                                placeholder="What is included in this update?"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-blue-950 mb-1">Notes</label>
                            <textarea
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-blue-900/20 bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                rows={2}
                                placeholder="Optional rollout notes"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-900 px-4 py-3 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
                        >
                            <Send className="w-4 h-4" />
                            {loading ? 'Publishing...' : 'Publish update'}
                        </button>
                    </form>

                    <div className="lg:col-span-2 rounded-2xl border border-blue-900/15 bg-white shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-blue-900/10 flex items-center justify-between">
                            <h2 className="text-[15px] font-semibold text-blue-950">Update history</h2>
                            {listLoading && <span className="text-[11px] text-slate-500">Loading...</span>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="bg-gradient-to-r from-blue-900 via-slate-900 to-blue-900">
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/90">Version</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/90">Type</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/90">Rollout</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/90">Status</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/90">Window</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/90">Notes</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/90">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-blue-900/10">
                                    {updates.map((row) => (
                                        <tr key={row._id} className="hover:bg-blue-50/50 align-top">
                                            <td className="px-4 py-3 text-[11px] font-semibold text-blue-950">{row.version}</td>
                                            <td className="px-4 py-3 text-[11px] text-slate-700">
                                                {typeLabels[row.updateType] || row.updateType}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-900 border border-blue-900/15">
                                                    {rolloutLabels[row.rolloutType] || row.rolloutType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-semibold border ${row.status === 'active'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : row.status === 'scheduled'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                                    }`}>
                                                    {row.status}
                                                </span>
                                                <div className="text-[10px] text-slate-500 mt-1">
                                                    {row.broadcast ? 'Broadcast on' : 'Broadcast off'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[11px] text-slate-700">
                                                {humanDate(row.windowStart)}<br />{humanDate(row.windowEnd)}
                                            </td>
                                            <td className="px-4 py-3 text-[11px] text-slate-600 whitespace-pre-wrap">
                                                {row.description || row.notes || '-'}
                                            </td>
                                            <td className="px-4 py-3 space-y-2">
                                                <button
                                                    onClick={() => patchStatus(row._id, { status: row.status === 'active' ? 'inactive' : 'active' })}
                                                    className="w-full px-3 py-2 rounded-md bg-blue-900 text-white text-[10px] font-semibold hover:bg-blue-800"
                                                >
                                                    {row.status === 'active' ? 'Set inactive' : 'Set active'}
                                                </button>
                                                <button
                                                    onClick={() => patchStatus(row._id, { broadcast: !row.broadcast })}
                                                    className="w-full px-3 py-2 rounded-md border border-blue-900/20 bg-white text-blue-900 text-[10px] font-semibold hover:bg-blue-50"
                                                >
                                                    {row.broadcast ? 'Stop broadcast' : 'Broadcast'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {updates.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-6 text-center text-slate-500 text-[11px]">
                                                No updates yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-blue-900/15 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                            <p className="text-[15px] font-semibold text-blue-950">Updates are managed by admin</p>
                            <p className="text-[11px] text-slate-600">
                                You will be notified here and on the welcome banner when new Electron System builds are ready.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemUpdates;
