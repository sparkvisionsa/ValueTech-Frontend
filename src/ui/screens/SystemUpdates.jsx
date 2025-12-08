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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-sm uppercase tracking-wide text-gray-500">Electron System</p>
                    <h1 className="text-3xl font-bold text-gray-900">System Updates</h1>
                    <p className="text-gray-600 text-sm">Publish updates and notify users. Mandatory updates will block non-admin access until applied.</p>
                </div>
                <button
                    onClick={() => {
                        fetchUpdateNotice();
                        loadUpdates();
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-800 border border-gray-300 hover:bg-gray-50"
                >
                    <RefreshCcw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {!isAdmin && latestUpdate && showCard && !dismissed && userUpdateState?.status !== 'applied' && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-blue-600" />
                        <div>
                            <p className="text-sm text-gray-700 font-semibold">Update available</p>
                            <p className="text-lg font-bold text-gray-900">Version {latestUpdate.version}</p>
                        </div>
                        <span className="ml-auto text-xs uppercase bg-blue-50 border border-blue-200 px-2 py-1 rounded-full text-blue-800">
                            {typeLabels[latestUpdate.updateType] || latestUpdate.updateType}
                        </span>
                    </div>
                    <p className="text-sm text-gray-700">
                        {latestUpdate.description || 'A new update is ready. Download and apply to continue.'}
                    </p>
                    <div className="text-sm text-gray-600">
                        Window: {humanDate(latestUpdate.windowStart)} → {humanDate(latestUpdate.windowEnd)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleDownload}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                            disabled={downloading}
                        >
                            <Download className="w-4 h-4" />
                            {userUpdateState?.status === 'downloaded' ? 'Downloaded' : (downloading ? 'Downloading...' : 'Download')}
                        </button>
                        {!isMandatory && (
                            <button
                                onClick={() => setDismissed(true)}
                                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-800 border border-gray-300 hover:bg-gray-50"
                            >
                                Later
                            </button>
                        )}
                        {userUpdateState?.status === 'downloaded' && (
                            <button
                                onClick={handleApply}
                                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white text-sm font-semibold hover:bg-green-700"
                                disabled={userUpdateState?.status === 'applied'}
                            >
                                <ShieldCheck className="w-4 h-4" />
                                {userUpdateState?.status === 'applied' ? 'Applied' : 'Apply'}
                            </button>
                        )}
                    </div>
                    {downloading && (
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-200"
                                style={{ width: `${downloadProgress}%` }}
                            />
                        </div>
                    )}
                    {applyMessage && (
                        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                            {applyMessage}
                        </div>
                    )}
                </div>
            )}

            {isAdmin ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <form onSubmit={handleSubmit} className="lg:col-span-1 bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
                        <h2 className="text-xl font-semibold text-gray-900">Create update</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                            <input
                                type="text"
                                value={form.version}
                                onChange={(e) => setForm({ ...form, version: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., v2.4.0"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select
                                    value={form.updateType}
                                    onChange={(e) => setForm({ ...form, updateType: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {Object.keys(typeLabels).map((key) => (
                                        <option key={key} value={key}>{typeLabels[key]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rollout</label>
                                <select
                                    value={form.rolloutType}
                                    onChange={(e) => setForm({ ...form, rolloutType: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {Object.keys(rolloutLabels).map((key) => (
                                        <option key={key} value={key}>{rolloutLabels[key]}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={form.status}
                                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="scheduled">Scheduled</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule window</label>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="datetime-local"
                                    value={form.windowStart}
                                    onChange={(e) => setForm({ ...form, windowStart: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    type="datetime-local"
                                    value={form.windowEnd}
                                    onChange={(e) => setForm({ ...form, windowEnd: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                placeholder="What is included in this update?"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <textarea
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                                placeholder="Optional rollout notes"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                        >
                            <Send className="w-4 h-4" />
                            {loading ? 'Publishing...' : 'Publish update'}
                        </button>
                    </form>

                    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Update history</h2>
                            {listLoading && <span className="text-xs text-gray-500">Loading...</span>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Version</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rollout</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Window</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Notes</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {updates.map((row) => (
                                        <tr key={row._id} className="hover:bg-gray-50 align-top">
                                            <td className="px-4 py-3 font-semibold text-gray-900">{row.version}</td>
                                            <td className="px-4 py-3 text-sm text-gray-800">
                                                {typeLabels[row.updateType] || row.updateType}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                                                    {rolloutLabels[row.rolloutType] || row.rolloutType}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${row.status === 'active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : row.status === 'scheduled'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {row.status}
                                                </span>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {row.broadcast ? 'Broadcast on' : 'Broadcast off'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-800">
                                                {humanDate(row.windowStart)}<br />{humanDate(row.windowEnd)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                                                {row.description || row.notes || '—'}
                                            </td>
                                            <td className="px-4 py-3 space-y-2">
                                                <button
                                                    onClick={() => patchStatus(row._id, { status: row.status === 'active' ? 'inactive' : 'active' })}
                                                    className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                                >
                                                    {row.status === 'active' ? 'Set inactive' : 'Set active'}
                                                </button>
                                                <button
                                                    onClick={() => patchStatus(row._id, { broadcast: !row.broadcast })}
                                                    className="w-full px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-xs font-semibold hover:bg-gray-200"
                                                >
                                                    {row.broadcast ? 'Stop broadcast' : 'Broadcast'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {updates.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-6 text-center text-gray-500 text-sm">
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
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
                        <div>
                            <p className="text-lg font-semibold text-gray-900">Updates are managed by admin</p>
                            <p className="text-sm text-gray-700">
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
