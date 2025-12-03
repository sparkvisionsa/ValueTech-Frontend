import React, { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';

const Packages = ({ onViewChange }) => {
    const { user, token } = useSession();
    const isAdmin = user?.phone === '011111';
    const [packages, setPackages] = useState([]);
    const [formData, setFormData] = useState({ name: '', points: '', price: '' });
    const [editingPackage, setEditingPackage] = useState(null);

    useEffect(() => {
        fetchPackages();
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
            onViewChange('recharge-balance'); // Navigate to recharge balance after subscribe
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
            <h1 className="text-2xl font-bold mb-4">Packages</h1>

            {/* Add/Edit Package Form - Only for Admin */}
            {isAdmin && (
                <div className="mb-8 p-4 border border-gray-300 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">{editingPackage ? 'Edit Package' : 'Add New Package'}</h2>
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
            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {packages.map((pkg) => (
                            <tr key={pkg._id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pkg.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pkg.points}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${pkg.price}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    {isAdmin ? (
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleEdit(pkg)}
                                                className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-xs"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(pkg._id)}
                                                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-xs"
                                            >
                                                Delete
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
