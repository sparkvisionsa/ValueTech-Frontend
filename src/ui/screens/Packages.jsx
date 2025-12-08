import React, { useState, useEffect } from 'react';
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
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-900">Packages & Balance</h1>

            {/* Balance full width */}
            <div className="mb-6 p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Balance</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                        <p className="text-sm text-gray-500">Total Number of Points</p>
                        <p className="text-2xl font-semibold text-gray-900">{totalPoints}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                        <p className="text-sm text-gray-500">Total Balance</p>
                        <p className="text-2xl font-semibold text-gray-900">{totalPoints}</p>
                    </div>
                </div>
            </div>

            {/* Subscriptions full width */}
            <div className="mb-8 p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-3 text-gray-900">Your Subscriptions</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Package Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subscriptions.length === 0 ? (
                                <tr>
                                    <td colSpan="2" className="px-4 py-3 text-sm text-gray-500">
                                        No subscriptions yet.
                                    </td>
                                </tr>
                            ) : (
                                subscriptions.map((sub) => (
                                    <tr key={sub._id} className="border-t">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{sub.packageId.name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{sub.packageId.points}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Package Form - Only for Admin */}
            {isAdmin && (
                <div className="mb-10 p-5 bg-white border border-gray-200 rounded-xl shadow-sm w-full">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900">{editingPackage ? 'Edit Package' : 'Add New Package'}</h2>
                    <form onSubmit={editingPackage ? handleUpdatePackage : handleAddPackage} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Points</label>
                            <input
                                type="number"
                                name="points"
                                value={formData.points}
                                onChange={handleInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Price</label>
                            <input
                                type="number"
                                step="0.01"
                                name="price"
                                value={formData.price}
                                onChange={handleInputChange}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>
                        <div className="flex space-x-2">
                            <button
                                type="submit"
                                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                            >
                                {editingPackage ? 'Update Package' : 'Add Package'}
                            </button>
                            {editingPackage && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* Packages Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
                <h2 className="px-6 pt-5 pb-2 text-xl font-semibold text-gray-900">Packages</h2>
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">Name</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">Points</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">Price</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-base">
                        {packages.map((pkg) => (
                            <tr key={pkg._id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 text-lg">{pkg.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-800 text-lg">{pkg.points}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-800 text-lg">${pkg.price}</td>
                                <td className="px-6 py-4 whitespace-nowrap font-medium">
                                    {isAdmin ? (
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => handleEdit(pkg)}
                                                className="bg-yellow-500 text-white px-3 py-2 rounded hover:bg-yellow-600 text-xs"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(pkg._id)}
                                                className="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 text-xs"
                                            >
                                                Delete
                                            </button>
                                            <button
                                                onClick={() => handleSubscribe(pkg._id)}
                                                className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-xs"
                                            >
                                                Subscribe
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleSubscribe(pkg._id)}
                                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
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
    );
};

export default Packages;