import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { useSession } from '../context/SessionContext';

const Packages = () => {
    const { user, token } = useSession();
    const isAdmin = user?.phone === '011111';
    const [packages, setPackages] = useState([]);
    const [formData, setFormData] = useState({ name: '', points: '', price: '' });
    const [editingPackage, setEditingPackage] = useState(null);
    const [totalPoints, setTotalPoints] = useState(0);
    const [subscriptions, setSubscriptions] = useState([]);

    useEffect(() => {
        fetchPackages();
        fetchSubscriptions();
    }, []);

    const fetchPackages = async () => {
        try {
            const response = await window.electronAPI.apiRequest('GET', '/api/packages');
            setPackages(response || []);
        } catch (error) {
            console.error('Error fetching packages:', error);
            setPackages([]);
        }
    };

    const fetchSubscriptions = async () => {
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const response = await window.electronAPI.apiRequest('GET', '/api/packages/subscriptions', {}, headers);
            setTotalPoints(response.totalPoints);
            setSubscriptions(response.subscriptions);
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
            setTotalPoints(0);
            setSubscriptions([]);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleAddPackage = async (e) => {
        e.preventDefault();
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await window.electronAPI.apiRequest('POST', '/api/packages', formData, headers);
            alert('Package added successfully!');
            setFormData({ name: '', points: '', price: '' });
            fetchPackages(); // Refresh the list
        } catch (error) {
            console.error('Error adding package:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to add package';
            alert(`Failed to add package: ${errorMsg}`);
        }
    };

    const handleSubscribe = async (packageId) => {
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await window.electronAPI.apiRequest('POST', '/api/packages/subscribe', { packageId }, headers);
            alert('Subscribed successfully!');
            fetchSubscriptions();
        } catch (error) {
            console.error('Error subscribing to package:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Subscription failed';
            alert(`Subscription failed: ${errorMsg}`);
        }
    };

    const handleEdit = (pkg) => {
        setEditingPackage(pkg);
        setFormData({ name: pkg.name, points: pkg.points, price: pkg.price });
    };

    const handleDelete = async (packageId) => {
        if (window.confirm('Are you sure you want to delete this package?')) {
            try {
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                await window.electronAPI.apiRequest('DELETE', `/api/packages/${packageId}`, {}, headers);
                alert('Package deleted successfully!');
                fetchPackages();
            } catch (error) {
                console.error('Error deleting package:', error);
                const errorMsg = error.response?.data?.message || error.message || 'Failed to delete package';
                alert(`Failed to delete package: ${errorMsg}`);
            }
        }
    };

    const handleUpdatePackage = async (e) => {
        e.preventDefault();
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await window.electronAPI.apiRequest('PUT', `/api/packages/${editingPackage._id}`, formData, headers);
            alert('Package updated successfully!');
            setFormData({ name: '', points: '', price: '' });
            setEditingPackage(null);
            fetchPackages();
        } catch (error) {
            console.error('Error updating package:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to update package';
            alert(`Failed to update package: ${errorMsg}`);
        }
    };

    const handleCancelEdit = () => {
        setEditingPackage(null);
        setFormData({ name: '', points: '', price: '' });
    };

    return (
        <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-900/15 bg-gradient-to-r from-white via-blue-50 to-white px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-sm">
                        <Package className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-blue-900/60 font-semibold">Billing</div>
                        <h2 className="text-lg font-bold text-blue-950">Packages & Balance</h2>
                        <p className="text-[11px] text-slate-600">Track subscriptions, points, and available packages.</p>
                    </div>
                </div>
            </div>

            {/* Balance full width */}
            <div className="rounded-2xl border border-blue-900/15 bg-white shadow-sm p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-blue-900/50">Balance</p>
                        <h3 className="text-[15px] font-semibold text-blue-950">Current Balance</h3>
                    </div>
                    <span className="text-[10px] text-blue-900/60">Updated from subscriptions</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-900/10">
                        <p className="text-[11px] text-blue-900/60">Total Number of Points</p>
                        <p className="text-[18px] font-semibold text-blue-950">{totalPoints}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-900/10">
                        <p className="text-[11px] text-blue-900/60">Total Balance</p>
                        <p className="text-[18px] font-semibold text-blue-950">{totalPoints}</p>
                    </div>
                </div>
            </div>

            {/* Subscriptions full width */}
            <div className="rounded-2xl border border-blue-900/15 bg-white shadow-sm p-3 space-y-2">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-blue-900/50">Subscriptions</p>
                    <h3 className="text-[15px] font-semibold text-blue-950">Your Subscriptions</h3>
                </div>
                <div className="overflow-x-auto rounded-xl border border-blue-900/10 bg-white">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-blue-900 via-slate-900 to-blue-900 text-white">
                                <th className="px-3 py-2 text-left text-[11px] font-semibold">Package Name</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold">Points</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-900/10">
                            {subscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan="2" className="px-3 py-2 text-[11px] text-slate-500">
                                        No subscriptions yet.
                                    </td>
                                </tr>
                            ) : (
                                subscriptions.map((sub) => (
                                    <tr key={sub._id} className="hover:bg-blue-50/50">
                                        <td className="px-3 py-2 text-[11px] font-semibold text-blue-950">{sub.packageId.name}</td>
                                        <td className="px-3 py-2 text-[11px] text-slate-600">{sub.packageId.points}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Package Form - Only for Admin */}
            {isAdmin && (
                <div className="rounded-2xl border border-blue-900/15 bg-white shadow-sm p-3 space-y-2 w-full">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-blue-900/50">Manage</p>
                        <h3 className="text-[15px] font-semibold text-blue-950">{editingPackage ? 'Edit Package' : 'Add New Package'}</h3>
                    </div>
                    <form onSubmit={editingPackage ? handleUpdatePackage : handleAddPackage} className="space-y-2">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-4 md:items-end">
                            <div className="space-y-1">
                                <label className="block text-[11px] font-semibold text-blue-950">Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="block w-full px-2.5 py-1.5 border border-blue-900/20 rounded-lg bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[11px] font-semibold text-blue-950">Points</label>
                                <input
                                    type="number"
                                    name="points"
                                    value={formData.points}
                                    onChange={handleInputChange}
                                    className="block w-full px-2.5 py-1.5 border border-blue-900/20 rounded-lg bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[11px] font-semibold text-blue-950">Price</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleInputChange}
                                    className="block w-full px-2.5 py-1.5 border border-blue-900/20 rounded-lg bg-white/90 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                                    required
                                />
                            </div>
                            <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                                {editingPackage && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="rounded-md border border-blue-900/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="rounded-md bg-blue-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800"
                                >
                                    {editingPackage ? 'Update Package' : 'Add Package'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Packages Table */}
            <div className="rounded-2xl border border-blue-900/15 bg-white shadow-sm overflow-hidden">
                <div className="px-3 py-2 border-b border-blue-900/10">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-blue-900/50">Packages</p>
                    <h3 className="text-[15px] font-semibold text-blue-950">Available Packages</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-blue-900 via-slate-900 to-blue-900 text-white">
                                <th className="px-3 py-2 text-left text-[11px] font-semibold">Name</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold">Points</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold">Price</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-900/10">
                            {packages.map((pkg) => (
                                <tr key={pkg._id} className="hover:bg-blue-50/50">
                                    <td className="px-3 py-2 whitespace-nowrap text-[11px] font-semibold text-blue-950">{pkg.name}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-700">{pkg.points}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-700">${pkg.price}</td>
                                    <td className="px-3 py-2 whitespace-nowrap font-medium">
                                        {isAdmin ? (
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => handleEdit(pkg)}
                                                    className="rounded-md border border-blue-900/20 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-blue-900 hover:bg-blue-50"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(pkg._id)}
                                                    className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100"
                                                >
                                                    Delete
                                                </button>
                                                <button
                                                    onClick={() => handleSubscribe(pkg._id)}
                                                    className="rounded-md bg-blue-900 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-sm hover:bg-blue-800"
                                                >
                                                    Subscribe
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleSubscribe(pkg._id)}
                                                className="rounded-md bg-blue-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800"
                                            >
                                                Subscribe
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Packages;
