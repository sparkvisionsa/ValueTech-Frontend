import React, { useState, useEffect } from "react";
import {
    ChevronRight,
    ChevronDown,
    FileText,
    Calendar,
    DollarSign,
    Package,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight as ChevronRightIcon,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    Download,
    Edit2,
    Eye,
    EyeOff
} from "lucide-react";
import { getAllReports } from "../../api/report";

const ReportsTable = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [expandedReport, setExpandedReport] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    // Available statuses from your model
    const statusOptions = [
        { value: "all", label: "All Statuses" },
        { value: "draft", label: "Draft" },
        { value: "pending", label: "Pending" },
        { value: "in_progress", label: "In Progress" },
        { value: "completed", label: "Completed" },
        { value: "archived", label: "Archived" }
    ];

    const fetchReports = async () => {
        try {
            setLoading(true);
            setError("");

            // Ensure page is a number
            console.log("page in curent fetch", currentPage);
            const pageNumber = Number(currentPage);

            // Build query parameters
            const params = {
                page: pageNumber,
                limit: pageSize,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            };

            // Add filters
            if (statusFilter !== "all") {
                params.status = statusFilter;
            }
            if (searchTerm) {
                params.search = searchTerm;
            }

            const result = await getAllReports(params);

            if (result.success) {
                setReports(result.data);
                setTotalPages(result.pagination.totalPages);
                setTotalItems(result.pagination.totalItems);
            } else {
                setError(result.message || "Failed to fetch reports");
            }
        } catch (err) {
            console.error("Error fetching reports:", err);
            setError(err.message || "Failed to fetch reports");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports(currentPage);
    }, [currentPage, statusFilter, searchTerm, pageSize]);

    // Toggle report expansion
    const toggleReportExpand = (reportId) => {
        setExpandedReport(expandedReport === reportId ? null : reportId);
    };

    // Handle page change
    const handlePageChange = (page) => {
        const pageNumber = Number(page);
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return "—";
        try {
            return new Date(dateString).toLocaleDateString();
        } catch {
            return dateString;
        }
    };

    // Format currency
    const formatCurrency = (value) => {
        if (!value) return "—";
        try {
            const num = parseInt(value);
            if (isNaN(num)) return value;

            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(num);
        } catch {
            return value;
        }
    };

    // Get asset data for a report
    const getAssetData = (report) => {
        return report.asset_data || [];
    };

    // Calculate report status based on submitState and other fields
    const getReportStatus = (report) => {
        // If report has status field, use it
        if (report.status) return report.status;

        // Otherwise determine from asset data
        const assetData = getAssetData(report);
        if (assetData.length === 0) return "Draft";

        const allCompleted = assetData.every(asset => asset.submitState === 1);
        const anyCompleted = assetData.some(asset => asset.submitState === 1);

        if (allCompleted) return "Completed";
        if (anyCompleted) return "In Progress";
        return "Pending";
    };

    // Get status color
    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'in_progress':
            case 'in progress': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'pending': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'draft': return 'bg-gray-50 text-gray-700 border-gray-100';
            case 'archived': return 'bg-purple-50 text-purple-700 border-purple-100';
            default: return 'bg-gray-50 text-gray-700 border-gray-100';
        }
    };

    // Get status icon
    const getStatusIcon = (status) => {
        switch (status.toLowerCase()) {
            case 'completed': return <CheckCircle2 className="w-3 h-3" />;
            case 'in_progress':
            case 'in progress': return <Loader2 className="w-3 h-3 animate-spin" />;
            case 'pending': return <AlertTriangle className="w-3 h-3" />;
            default: return <FileText className="w-3 h-3" />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-[95vw] mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-6 text-white">
                        <div className="flex items-center gap-3 mb-2">
                            <FileText className="w-7 h-7" />
                            <h1 className="text-2xl font-bold">Reports Management</h1>
                        </div>
                        <p className="text-indigo-100 text-sm">
                            View and manage all reports in the system
                        </p>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Search */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Search Reports
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search by title, report ID..."
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Status Filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status Filter
                                </label>
                                <div className="relative">
                                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
                                    >
                                        {statusOptions.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Page Size */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Items per page
                                </label>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(parseInt(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="10">10</option>
                                    <option value="20">20</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Reports Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                            <span className="ml-3 text-gray-600">Loading reports...</span>
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center">
                            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <p className="text-red-600">{error}</p>
                            <button
                                onClick={() => fetchReports(currentPage)}
                                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Table Container */}
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm leading-tight">
                                    <thead className="bg-indigo-900/95 text-white/90">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Report ID</th>
                                            <th className="px-4 py-3 text-left">Status</th>
                                            <th className="px-4 py-3 text-left">Assets</th>
                                            <th className="px-4 py-3 text-left">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {reports.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                                    <p>No reports found</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            reports.map((report) => {
                                                const isExpanded = expandedReport === report._id;
                                                const assetData = getAssetData(report);
                                                const status = getReportStatus(report);
                                                const statusColor = getStatusColor(status);

                                                return (
                                                    <React.Fragment key={report._id}>
                                                        {/* Main Report Row */}
                                                        <tr className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleReportExpand(report._id)}
                                                                    className="inline-flex items-center gap-2 text-left font-semibold text-indigo-900"
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="w-4 h-4 text-indigo-600" />
                                                                    ) : (
                                                                        <ChevronRight className="w-4 h-4 text-indigo-600" />
                                                                    )}
                                                                    <span>{report.report_id || "—"}</span>
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs border ${statusColor}`}>
                                                                    {getStatusIcon(status)}
                                                                    {status}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="inline-flex items-center gap-2">
                                                                    <Package className="w-4 h-4 text-gray-400" />
                                                                    <span className="text-gray-700">{assetData.length}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                                                                        title="Edit report"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                        Edit
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* Expanded Asset Data Row */}
                                                        {isExpanded && (
                                                            <tr>
                                                                <td colSpan="7" className="bg-indigo-50/40">
                                                                    <div className="p-4">
                                                                        <div className="overflow-x-auto rounded-xl border border-indigo-900/15 bg-white">
                                                                            <table className="min-w-full text-sm leading-tight">
                                                                                <thead className="bg-indigo-900/95 text-white/90">
                                                                                    <tr>
                                                                                        <th className="px-4 py-3 text-left">Asset Name</th>
                                                                                        <th className="px-4 py-3 text-left">Page No</th>
                                                                                        <th className="px-4 py-3 text-left">Inspection Date</th>
                                                                                        <th className="px-4 py-3 text-left">Final Value</th>
                                                                                        <th className="px-4 py-3 text-left">Submit State</th>
                                                                                        <th className="px-4 py-3 text-left">Actions</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-200">
                                                                                    {assetData.length === 0 ? (
                                                                                        <tr>
                                                                                            <td colSpan="6" className="px-4 py-4 text-center text-gray-500">
                                                                                                No asset data available
                                                                                            </td>
                                                                                        </tr>
                                                                                    ) : (
                                                                                        assetData.map((asset, index) => (
                                                                                            <tr key={asset.id || index} className="hover:bg-gray-50">
                                                                                                <td className="px-4 py-3 font-medium text-gray-900">
                                                                                                    {asset.asset_name || "—"}
                                                                                                </td>
                                                                                                <td className="px-4 py-3 text-gray-700">
                                                                                                    {asset.pg_no || "—"}
                                                                                                </td>
                                                                                                <td className="px-4 py-3 text-gray-700">
                                                                                                    {formatDate(asset.inspection_date)}
                                                                                                </td>
                                                                                                <td className="px-4 py-3 font-medium">
                                                                                                    {formatCurrency(asset.final_value)}
                                                                                                </td>
                                                                                                <td className="px-4 py-3">
                                                                                                    {asset.submitState === 1 ? (
                                                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700 border border-emerald-100">
                                                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                                                            Complete
                                                                                                        </span>
                                                                                                    ) : asset.submitState === -1 ? (
                                                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs text-red-700 border border-red-100">
                                                                                                            <AlertTriangle className="w-3 h-3" />
                                                                                                            Deleted
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700 border border-amber-100">
                                                                                                            <AlertTriangle className="w-3 h-3" />
                                                                                                            Pending
                                                                                                        </span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="px-4 py-3">
                                                                                                    <div className="flex items-center gap-2">
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                                                                                                            title="Edit asset"
                                                                                                        >
                                                                                                            <Edit2 className="w-3 h-3" />
                                                                                                            Edit
                                                                                                        </button>
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
                                                                                                            title="View details"
                                                                                                        >
                                                                                                            <Eye className="w-3 h-3" />
                                                                                                            View
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))
                                                                                    )}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {reports.length > 0 && totalPages > 0 && (
                                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                                    <div className="text-sm text-gray-600">
                                        Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                                        <span className="font-medium">
                                            {Math.min(currentPage * pageSize, totalItems)}
                                        </span> of{" "}
                                        <span className="font-medium">{totalItems}</span> reports
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Previous
                                        </button>

                                        <div className="flex items-center gap-1">
                                            {/* Generate pagination buttons safely */}
                                            {(() => {
                                                const buttons = [];
                                                const maxButtons = 5;

                                                // Calculate start and end
                                                let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
                                                let end = Math.min(totalPages, start + maxButtons - 1);

                                                // Adjust start if we're near the end
                                                if (end - start + 1 < maxButtons) {
                                                    start = Math.max(1, end - maxButtons + 1);
                                                }

                                                // Generate buttons
                                                for (let i = start; i <= end; i++) {
                                                    buttons.push(
                                                        <button
                                                            key={i}
                                                            onClick={() => handlePageChange(i)}
                                                            className={`w-8 h-8 flex items-center justify-center text-sm font-medium rounded ${currentPage === i
                                                                ? "bg-indigo-600 text-white"
                                                                : "text-gray-700 hover:bg-gray-100"
                                                                }`}
                                                        >
                                                            {i}
                                                        </button>
                                                    );
                                                }

                                                return buttons;
                                            })()}
                                        </div>

                                        <button
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                            <ChevronRightIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Stats Summary */}
                {!loading && reports.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Total Reports</p>
                                    <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
                                </div>
                                <FileText className="w-8 h-8 text-indigo-600" />
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Completed</p>
                                    <p className="text-2xl font-bold text-emerald-600">
                                        {reports.filter(r => getReportStatus(r) === "Completed").length}
                                    </p>
                                </div>
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Total Assets</p>
                                    <p className="text-2xl font-bold text-purple-600">
                                        {reports.reduce((sum, report) => sum + (report.asset_data?.length || 0), 0)}
                                    </p>
                                </div>
                                <Package className="w-8 h-8 text-purple-600" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportsTable;