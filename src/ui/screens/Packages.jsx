import React, { useState, useEffect } from 'react';

const Packages = ({ onViewChange }) => {
    const [packages, setPackages] = useState([]);
    const [formData, setFormData] = useState({ name: '', points: '', price: '' });

    useEffect(() => {
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        try {
            const response = await window.electronAPI.ipcRenderer.invoke('api-request', {
                method: 'GET',
                url: '/api/packages',
            });
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
            await window.electronAPI.ipcRenderer.invoke('api-request', {
                method: 'POST',
                url: '/api/packages',
                data: formData,
            });
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
            await window.electronAPI.ipcRenderer.invoke('api-request', {
                method: 'POST',
                url: '/api/packages/subscribe',
                data: { packageId },
            });
            alert('Subscribed successfully!');
            onViewChange('recharge-balance'); // Navigate to recharge balance after subscribe
        } catch (error) {
            console.error('Error subscribing to package:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Subscription failed';
            alert(`Subscription failed: ${errorMsg}`);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Packages</h1>

            {/* Add Package Form */}
            <div className="mb-8 p-4 border border-gray-300 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Add New Package</h2>
                <form onSubmit={handleAddPackage} className="space-y-4">
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
                    <button
                        type="submit"
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                    >
                        Add Package
                    </button>
                </form>
            </div>

            {/* Packages List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                    <div key={pkg._id} className="border border-gray-300 rounded-lg p-4 shadow-md">
                        <h2 className="text-xl font-semibold mb-2">{pkg.name}</h2>
                        <p className="text-gray-600 mb-2">Points: {pkg.points}</p>
                        <p className="text-gray-600 mb-4">Price: ${pkg.price}</p>
                        <button
                            onClick={() => handleSubscribe(pkg._id)}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            Subscribe
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Packages;
