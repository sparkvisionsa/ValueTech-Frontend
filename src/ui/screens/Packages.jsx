import React, { useState, useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import { useSession } from '../context/SessionContext';

const BANK_ACCOUNT_NUMBER = '0123456789';
const API_BASE_URL = 'http://localhost:3000';

const Packages = () => {
    const { user, token } = useSession();
    const isAdmin = user?.phone === '011111';
    const [packages, setPackages] = useState([]);
    const [formData, setFormData] = useState({ name: '', points: '', price: '' });
    const [editingPackage, setEditingPackage] = useState(null);
    const [totalPoints, setTotalPoints] = useState(0);
    const [subscriptions, setSubscriptions] = useState([]);
    const [requests, setRequests] = useState([]);
    const [isBankModalOpen, setIsBankModalOpen] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [isAdminRequestsOpen, setIsAdminRequestsOpen] = useState(false);
    const [uploadingRequestId, setUploadingRequestId] = useState(null);
    const [processingRequestId, setProcessingRequestId] = useState(null);
    const requestsRef = useRef(null);

    useEffect(() => {
        fetchPackages();
    }, []);

    useEffect(() => {
        if (!token) {
            setTotalPoints(0);
            setSubscriptions([]);
            setRequests([]);
            return;
        }
        fetchSubscriptions();
        fetchRequests();
    }, [token]);

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
        if (!token) return;
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const response = await window.electronAPI.apiRequest('GET', '/api/packages/subscriptions', {}, headers);
            setTotalPoints(response.totalPoints);
            setSubscriptions(response.subscriptions);
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
            setTotalPoints(0);
            setSubscriptions([]);
        }
    };

    const notifyRequestUpdates = async (items) => {
        if (!token || !Array.isArray(items)) return;
        const pendingNotifications = items.filter(
            (request) => request.status !== 'pending' && !request.userNotified
        );
        if (pendingNotifications.length === 0) return;

        const messages = pendingNotifications.map((request) => {
            const name = request.packageName || request.packageId?.name || 'Package';
            const statusLabel = request.status === 'confirmed' ? 'confirmed' : 'rejected';
            return `Your request for ${name} was ${statusLabel}.`;
        });

        alert(messages.join('\n'));

        const headers = { Authorization: `Bearer ${token}` };
        await Promise.all(
            pendingNotifications.map((request) =>
                window.electronAPI.apiRequest('POST', `/api/packages/requests/${request._id}/ack`, {}, headers)
            )
        );

        setRequests((prev) =>
            prev.map((request) =>
                pendingNotifications.some((item) => item._id === request._id)
                    ? { ...request, userNotified: true }
                    : request
            )
        );

        if (pendingNotifications.some((request) => request.status === 'confirmed')) {
            fetchSubscriptions();
        }
    };

    const fetchRequests = async () => {
        if (!token) return;
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const response = await window.electronAPI.apiRequest('GET', '/api/packages/requests', {}, headers);
            const items = response || [];
            setRequests(items);
            if (!isAdmin) {
                await notifyRequestUpdates(items);
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
            setRequests([]);
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
            fetchPackages();
        } catch (error) {
            console.error('Error adding package:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to add package';
            alert(`Failed to add package: ${errorMsg}`);
        }
    };

    const handleSubscribe = (pkg) => {
        setSelectedPackage(pkg);
        setIsBankModalOpen(true);
    };

    const scrollToRequests = () => {
        requestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleCreateRequest = async () => {
        if (!selectedPackage) return;
        if (!token) {
            alert('Login required to request a package.');
            return;
        }
        try {
            const headers = { Authorization: `Bearer ${token}` };
            await window.electronAPI.apiRequest(
                'POST',
                '/api/packages/requests',
                { packageId: selectedPackage._id },
                headers
            );
            alert('Request created. Upload your transfer image to continue.');
            setIsBankModalOpen(false);
            setSelectedPackage(null);
            await fetchRequests();
            scrollToRequests();
        } catch (error) {
            console.error('Error creating request:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Request failed';
            alert(`Request failed: ${errorMsg}`);
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

    const handleUploadTransfer = async (requestId, file) => {
        if (!file) return;
        if (!token) {
            alert('Login required to upload transfer image.');
            return;
        }

        setUploadingRequestId(requestId);
        try {
            const formData = new FormData();
            formData.append('transferImage', file);

            const response = await fetch(`${API_BASE_URL}/api/packages/requests/${requestId}/upload`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                let message = 'Failed to upload transfer image';
                try {
                    const payload = await response.json();
                    message = payload?.message || message;
                } catch (parseError) {
                    const text = await response.text();
                    if (text) message = text;
                }
                throw new Error(message);
            }

            const updatedRequest = await response.json();
            setRequests((prev) =>
                prev.map((request) => (request._id === requestId ? updatedRequest : request))
            );
            alert('Transfer image uploaded.');
        } catch (error) {
            console.error('Upload failed:', error);
            const errorMsg = error.message || 'Upload failed';
            alert(`Upload failed: ${errorMsg}`);
        } finally {
            setUploadingRequestId(null);
        }
    };

    const handleUpdateRequestStatus = async (requestId, status) => {
        if (!token) {
            alert('Login required to update requests.');
            return;
        }
        setProcessingRequestId(requestId);
        try {
            const headers = { Authorization: `Bearer ${token}` };
            await window.electronAPI.apiRequest(
                'PATCH',
                `/api/packages/requests/${requestId}/status`,
                { status },
                headers
            );
            alert(status === 'confirmed' ? 'Request approved.' : 'Request rejected.');
            await fetchRequests();
        } catch (error) {
            console.error('Error updating request status:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Update failed';
            alert(`Update failed: ${errorMsg}`);
        } finally {
            setProcessingRequestId(null);
        }
    };

    const resolvePackageName = (request) => request.packageName || request.packageId?.name || 'Package';
    const resolvePackagePoints = (request) => request.packagePoints || request.packageId?.points || 0;
    const resolveUserId = (requestUser) => {
        if (!requestUser) return null;
        if (typeof requestUser === 'string') return requestUser;
        return requestUser._id;
    };

    const myRequests = isAdmin && user?._id
        ? requests.filter((request) => resolveUserId(request.userId) === user._id)
        : requests;
    const pendingRequestsCount = requests.filter((request) => request.status === 'pending').length;

    const statusStyles = {
        pending: 'border-amber-200 bg-amber-50 text-amber-700',
        confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        rejected: 'border-rose-200 bg-rose-50 text-rose-700'
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

            {isAdmin && (
                <div className="rounded-2xl border border-blue-900/15 bg-white shadow-sm p-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-blue-900/50">Requests</p>
                        <h3 className="text-[15px] font-semibold text-blue-950">Pending approvals</h3>
                        <p className="text-[11px] text-slate-600">Pending: {pendingRequestsCount}</p>
                    </div>
                    <button
                        onClick={() => {
                            setIsAdminRequestsOpen(true);
                            fetchRequests();
                        }}
                        className="rounded-md bg-blue-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800"
                    >
                        Requests
                    </button>
                </div>
            )}

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

            {/* Requests section */}
            <div ref={requestsRef} className="rounded-2xl border border-blue-900/15 bg-white shadow-sm p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-blue-900/50">Requests</p>
                        <h3 className="text-[15px] font-semibold text-blue-950">My Requests</h3>
                    </div>
                    <span className="text-[10px] text-blue-900/60">Upload your transfer image to verify payment.</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-blue-900/10 bg-white">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-blue-900 via-slate-900 to-blue-900 text-white">
                                <th className="px-3 py-2 text-left text-[11px] font-semibold">Package</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold">Points</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold">Transfer Image</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold">Status</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-900/10">
                            {myRequests.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-3 py-2 text-[11px] text-slate-500">
                                        No requests yet.
                                    </td>
                                </tr>
                            ) : (
                                myRequests.map((request) => {
                                    const status = request.status || 'pending';
                                    const statusStyle = statusStyles[status] || statusStyles.pending;
                                    const imageUrl = request.transferImagePath
                                        ? `${API_BASE_URL}${request.transferImagePath}`
                                        : null;
                                    return (
                                        <tr key={request._id} className="hover:bg-blue-50/50">
                                            <td className="px-3 py-2 text-[11px] font-semibold text-blue-950">
                                                {resolvePackageName(request)}
                                            </td>
                                            <td className="px-3 py-2 text-[11px] text-slate-600">
                                                {resolvePackagePoints(request)}
                                            </td>
                                            <td className="px-3 py-2 text-[11px] text-slate-600">
                                                {imageUrl ? (
                                                    <a href={imageUrl} target="_blank" rel="noreferrer">
                                                        <img
                                                            src={imageUrl}
                                                            alt="Transfer"
                                                            className="h-10 w-14 rounded-md object-cover border border-blue-900/10"
                                                        />
                                                    </a>
                                                ) : (
                                                    <span className="text-[10px] text-slate-500">No image</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-[11px] text-slate-600">
                                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyle}`}>
                                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-[11px] text-slate-600">
                                                {status === 'pending' ? (
                                                    <label className="inline-flex items-center rounded-md border border-blue-900/20 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-blue-900 hover:bg-blue-50 cursor-pointer">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            disabled={uploadingRequestId === request._id}
                                                            onChange={(event) => {
                                                                const file = event.target.files?.[0];
                                                                if (!file) return;
                                                                handleUploadTransfer(request._id, file);
                                                                event.target.value = '';
                                                            }}
                                                        />
                                                        {uploadingRequestId === request._id
                                                            ? 'Uploading...'
                                                            : request.transferImagePath
                                                                ? 'Replace Image'
                                                                : 'Upload Image'}
                                                    </label>
                                                ) : (
                                                    <span className="text-[10px] text-slate-500">Locked</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
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
                                                    onClick={() => handleSubscribe(pkg)}
                                                    className="rounded-md bg-blue-900 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-sm hover:bg-blue-800"
                                                >
                                                    Subscribe
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleSubscribe(pkg)}
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

            {isBankModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-blue-900/20">
                        <div className="px-4 py-3 border-b border-blue-900/10">
                            <h3 className="text-[15px] font-semibold text-blue-950">Bank Transfer</h3>
                            <p className="text-[11px] text-slate-600">
                                Send money to this account to complete the payment process and receive points.
                            </p>
                        </div>
                        <div className="px-4 py-3 space-y-3">
                            <div className="rounded-xl border border-blue-900/10 bg-blue-50/60 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-blue-900/60">Account Number</p>
                                <p className="text-[14px] font-semibold text-blue-950">{BANK_ACCOUNT_NUMBER}</p>
                            </div>
                            {selectedPackage && (
                                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                                    <div className="rounded-lg border border-blue-900/10 bg-white px-2.5 py-2">
                                        <p className="text-[10px] uppercase tracking-[0.18em] text-blue-900/60">Package</p>
                                        <p className="font-semibold text-blue-950">{selectedPackage.name}</p>
                                    </div>
                                    <div className="rounded-lg border border-blue-900/10 bg-white px-2.5 py-2">
                                        <p className="text-[10px] uppercase tracking-[0.18em] text-blue-900/60">Points</p>
                                        <p className="font-semibold text-blue-950">{selectedPackage.points}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-4 py-3 border-t border-blue-900/10 flex items-center justify-end gap-2">
                            <button
                                onClick={() => {
                                    setIsBankModalOpen(false);
                                    setSelectedPackage(null);
                                }}
                                className="rounded-md border border-blue-900/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRequest}
                                className="rounded-md bg-blue-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-800"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isAdminRequestsOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl border border-blue-900/20">
                        <div className="px-4 py-3 border-b border-blue-900/10 flex items-center justify-between">
                            <div>
                                <h3 className="text-[15px] font-semibold text-blue-950">Requests</h3>
                                <p className="text-[11px] text-slate-600">Approve or reject package requests.</p>
                            </div>
                            <button
                                onClick={() => setIsAdminRequestsOpen(false)}
                                className="rounded-md border border-blue-900/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
                            >
                                Close
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="overflow-x-auto rounded-xl border border-blue-900/10 bg-white">
                                <table className="min-w-full">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-blue-900 via-slate-900 to-blue-900 text-white">
                                            <th className="px-3 py-2 text-left text-[11px] font-semibold">User</th>
                                            <th className="px-3 py-2 text-left text-[11px] font-semibold">Taqeem Username</th>
                                            <th className="px-3 py-2 text-left text-[11px] font-semibold">Package</th>
                                            <th className="px-3 py-2 text-left text-[11px] font-semibold">Points</th>
                                            <th className="px-3 py-2 text-left text-[11px] font-semibold">Transfer Image</th>
                                            <th className="px-3 py-2 text-left text-[11px] font-semibold">Status</th>
                                            <th className="px-3 py-2 text-left text-[11px] font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-blue-900/10">
                                        {requests.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="px-3 py-2 text-[11px] text-slate-500">
                                                    No requests yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            requests.map((request) => {
                                                const status = request.status || 'pending';
                                                const statusStyle = statusStyles[status] || statusStyles.pending;
                                                const imageUrl = request.transferImagePath
                                                    ? `${API_BASE_URL}${request.transferImagePath}`
                                                    : null;
                                                const canApprove = status === 'pending' && Boolean(request.transferImagePath);
                                                const isProcessing = processingRequestId === request._id;
                                                return (
                                                    <tr key={request._id} className="hover:bg-blue-50/50">
                                                        <td className="px-3 py-2 text-[11px] font-semibold text-blue-950">
                                                            {request.userId?.phone || 'Unknown'}
                                                        </td>
                                                        <td className="px-3 py-2 text-[11px] text-slate-600">
                                                            {request.userId?.taqeem?.username || '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-[11px] text-slate-600">
                                                            {resolvePackageName(request)}
                                                        </td>
                                                        <td className="px-3 py-2 text-[11px] text-slate-600">
                                                            {resolvePackagePoints(request)}
                                                        </td>
                                                        <td className="px-3 py-2 text-[11px] text-slate-600">
                                                            {imageUrl ? (
                                                                <a href={imageUrl} target="_blank" rel="noreferrer">
                                                                    <img
                                                                        src={imageUrl}
                                                                        alt="Transfer"
                                                                        className="h-10 w-14 rounded-md object-cover border border-blue-900/10"
                                                                    />
                                                                </a>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-500">No image</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-[11px] text-slate-600">
                                                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyle}`}>
                                                                {status.charAt(0).toUpperCase() + status.slice(1)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-[11px] text-slate-600">
                                                            <div className="flex flex-wrap gap-2">
                                                                <button
                                                                    onClick={() => handleUpdateRequestStatus(request._id, 'confirmed')}
                                                                    disabled={!canApprove || isProcessing}
                                                                    className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateRequestStatus(request._id, 'rejected')}
                                                                    disabled={status !== 'pending' || isProcessing}
                                                                    className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                            {!request.transferImagePath && status === 'pending' && (
                                                                <p className="mt-1 text-[10px] text-amber-600">Transfer image required.</p>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Packages;
