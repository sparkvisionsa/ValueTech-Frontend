import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from '../context/SessionContext';

const FEATURE_OPTIONS = [
    { id: 'taqeem-login', label: 'Taqeem Login' },
    { id: 'get-companies', label: 'Get Companies' },
    { id: 'check-status', label: 'Check Browser' },
    { id: 'validate-report', label: 'Validate Report' },
    { id: 'asset-create', label: 'Create Asset' },
    { id: 'upload-excel', label: 'Upload Excel' },
    { id: 'common-fields', label: 'Add Common Fields' },
    { id: 'grab-macro-ids', label: 'Grab Macro IDs' },
    { id: 'macro-edit', label: 'Edit Macro' },
    { id: 'delete-report', label: 'Delete Report' },
    { id: 'packages', label: 'Packages' }
];

const CompanyMembers = () => {
    const { token, user } = useSession();
    const [members, setMembers] = useState([]);
    const [form, setForm] = useState({ displayName: '', phone: '', password: '', permissions: [] });
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
    const isHead = user?.type === 'company' || user?.role === 'company-head';

    const loadMembers = async () => {
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const data = await window.electronAPI.apiRequest('GET', '/api/companies/members', {}, headers);
            setMembers(data?.members || []);
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Failed to load members';
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            loadMembers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const togglePermission = (value) => {
        setForm((prev) => {
            const exists = prev.permissions.includes(value);
            const permissions = exists
                ? prev.permissions.filter((p) => p !== value)
                : [...prev.permissions, value];
            return { ...prev, permissions };
        });
    };

    const resetForm = () => {
        setForm({ displayName: '', phone: '', password: '', permissions: [] });
        setEditingId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            if (editingId) {
                const payload = { ...form };
                if (!payload.password) {
                    delete payload.password;
                }
                const data = await window.electronAPI.apiRequest('PUT', `/api/companies/members/${editingId}`, payload, headers);
                setMessage({ type: 'success', text: data?.message || 'Member updated' });
            } else {
                const data = await window.electronAPI.apiRequest('POST', '/api/companies/members', form, headers);
                setMessage({ type: 'success', text: data?.message || 'Member added' });
            }
            await loadMembers();
            resetForm();
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Unable to save member';
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this member?')) return;
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const data = await window.electronAPI.apiRequest('DELETE', `/api/companies/members/${id}`, {}, headers);
            setMessage({ type: 'success', text: data?.message || 'Member removed' });
            await loadMembers();
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Unable to delete member';
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    if (!isHead) {
        return (
            <div className="max-w-3xl mx-auto bg-white shadow-sm border border-gray-200 rounded-xl p-8">
                <p className="text-center text-gray-700 font-semibold">Only company heads can manage members.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500 uppercase tracking-wide">Company</p>
                    <h1 className="text-3xl font-bold text-gray-900">Members &amp; Access</h1>
                    <p className="text-gray-600 text-sm">Add teammates, edit access, and remove accounts.</p>
                </div>
                <button
                    onClick={loadMembers}
                    className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    disabled={loading}
                >
                    Refresh
                </button>
            </div>

            {message.text && (
                <div className={`p-4 rounded-lg border ${message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleSubmit} className="lg:col-span-1 bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit member' : 'Add member'}</h2>
                        {editingId && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Cancel edit
                            </button>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
                        <input
                            type="text"
                            value={form.displayName}
                            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                            placeholder="Optional"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                            type="tel"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password {editingId ? '(leave blank to keep)' : ''}</label>
                        <input
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500"
                            placeholder={editingId ? 'Optional' : 'Required'}
                            required={!editingId}
                        />
                    </div>

                    <div>
                        <p className="block text-sm font-medium text-gray-700 mb-2">Allowed features</p>
                        <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                            {FEATURE_OPTIONS.map((feature) => (
                                <label
                                    key={feature.id}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${form.permissions.includes(feature.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={form.permissions.includes(feature.id)}
                                        onChange={() => togglePermission(feature.id)}
                                    />
                                    <span className="text-gray-800">{feature.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-blue-600 text-white font-semibold py-3 hover:bg-blue-700 disabled:opacity-60"
                    >
                        {loading ? 'Saving...' : editingId ? 'Update member' : 'Add member'}
                    </button>
                </form>

                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Members</h2>
                        <span className="text-sm text-gray-500">{members.length} users</span>
                    </div>

                    {members.length === 0 ? (
                        <div className="text-center text-gray-600 py-10 border border-dashed border-gray-200 rounded-lg">
                            No members yet. Add your first teammate on the left.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {members.map((member) => (
                                <div key={member._id} className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-gray-900">{member.displayName || 'Unnamed user'}</p>
                                        <p className="text-sm text-gray-600">📱 {member.phone}</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {(member.permissions || []).map((perm) => {
                                                const feature = FEATURE_OPTIONS.find((f) => f.id === perm);
                                                return (
                                                    <span key={perm} className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                                        {feature?.label || perm}
                                                    </span>
                                                );
                                            })}
                                            {(member.permissions || []).length === 0 && (
                                                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                                                    Full access
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingId(member._id);
                                                setForm({
                                                    displayName: member.displayName || '',
                                                    phone: member.phone,
                                                    password: '',
                                                    permissions: member.permissions || []
                                                });
                                            }}
                                            className="px-3 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-800 hover:bg-gray-50"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(member._id)}
                                            className="px-3 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700"
                                            disabled={loading}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompanyMembers;
