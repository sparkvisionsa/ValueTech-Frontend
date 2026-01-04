import React, { useState, useEffect } from "react";
import {
    ChevronRight,
    ChevronDown,
    FileText,
    Package,
    Search,
    Check,
    RefreshCcw,
    CheckCheck,
    Filter,
    Clock,
    ChevronLeft,
    ChevronRight as ChevronRightIcon,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    X,
    MoreVertical,
    Send
} from "lucide-react";
import { useRam } from "../context/RAMContext";
import { useSession } from "../context/SessionContext";
import EditAssetModal from "./EditAssetModal";

const ReportsTable = () => {
    const [reports, setReports] = useState([]);
    const [assetSubmitFilter, setAssetSubmitFilter] = useState("all");
    const [editLoading, setEditLoading] = useState({});
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [selectedReportId, setSelectedReportId] = useState(null);
    const [filteredReports, setFilteredReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [expandedReport, setExpandedReport] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [allReports, setAllReports] = useState([]); // Store all fetched reports
    const [dropdownOpen, setDropdownOpen] = useState(null); // Track which dropdown is open

    // Track loading states for individual actions
    const [loadingActions, setLoadingActions] = useState({
        fullCheck: {},
        halfCheck: {},
        retry: {},
        send: {}
    });

    const { token } = useSession();

    // Available statuses - simplified to Completed and Pending only
    const statusOptions = [
        { value: "all", label: "All Statuses" },
        { value: "completed", label: "Completed" },
        { value: "pending", label: "Pending" }
    ];

    const { ramInfo } = useRam();
    const tabsNum = ramInfo?.recommendedTabs || 1;

    // Set loading state for a specific action and report
    const setActionLoading = (actionType, reportId, isLoading) => {
        setLoadingActions(prev => ({
            ...prev,
            [actionType]: {
                ...prev[actionType],
                [reportId]: isLoading
            }
        }));
    };

    const handleOpenEdit = (asset, reportId) => {
        setSelectedAsset(asset);
        setSelectedReportId(reportId);
        setEditModalOpen(true);
        setEditModalOpen(true);
    };


    // Check if a specific action is loading
    const isActionLoading = (actionType, reportId) => {
        return loadingActions[actionType]?.[reportId] || false;
    };

    const handleFullCheck = async (reportId) => {
        if (isActionLoading('fullCheck', reportId)) return;

        setActionLoading('fullCheck', reportId, true);
        setDropdownOpen(null); // Close dropdown
        try {
            await window.electronAPI?.fullCheck?.(reportId, tabsNum);
            // Refresh the reports after action completes
            setTimeout(() => {
                fetchAllReports();
            }, 1000);
        } catch (error) {
            console.error('Full check error:', error);
            setError('Failed to perform full check');
        } finally {
            // Keep loading state for a bit to show feedback
            setTimeout(() => {
                setActionLoading('fullCheck', reportId, false);
            }, 500);
        }
    };

    const handleHalfCheck = async (reportId) => {
        if (isActionLoading('halfCheck', reportId)) return;

        setActionLoading('halfCheck', reportId, true);
        setDropdownOpen(null); // Close dropdown
        try {
            await window.electronAPI?.halfCheck?.(reportId, tabsNum);
            // Refresh the reports after action completes
            setTimeout(() => {
                fetchAllReports();
            }, 1000);
        } catch (error) {
            console.error('Half check error:', error);
            setError('Failed to perform half check');
        } finally {
            // Keep loading state for a bit to show feedback
            setTimeout(() => {
                setActionLoading('halfCheck', reportId, false);
            }, 500);
        }
    };

    const handleRetry = async (reportId) => {
        if (isActionLoading('retry', reportId)) return;

        setActionLoading('retry', reportId, true);
        setDropdownOpen(null); // Close dropdown
        try {
            await window.electronAPI?.macroFillRetry?.(reportId, tabsNum);
            // Refresh the reports after action completes
            setTimeout(() => {
                fetchAllReports();
            }, 1000);
        } catch (error) {
            console.error('Retry error:', error);
            setError('Failed to retry macro fill');
        } finally {
            // Keep loading state for a bit to show feedback
            setTimeout(() => {
                setActionLoading('retry', reportId, false);
            }, 500);
        }
    };

    const handleSend = async (reportId) => {
        if (isActionLoading('send', reportId)) return;

        setActionLoading('send', reportId, true);
        setDropdownOpen(null); // Close dropdown
        try {
            await window.electronAPI?.finalizeMultipleReports?.([reportId]);
            // Refresh the reports after action completes
            setTimeout(() => {
                fetchAllReports();
            }, 1000);
        } catch (error) {
            console.error('Send error:', error);
            setError('Failed to send report');
        } finally {
            // Keep loading state for a bit to show feedback
            setTimeout(() => {
                setActionLoading('send', reportId, false);
            }, 500);
        }
    };

    const fetchAllReports = async () => {
        try {
            setLoading(true);
            setError("");

            // Build query parameters
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: pageSize.toString(),
                sortBy: "createdAt",
                sortOrder: "desc"
            });

            const result = await window.electronAPI.apiRequest(
                "GET",
                `/api/report/getReportsByUserId?${params.toString()}`,
                {},
                {
                    Authorization: `Bearer ${token}`
                }
            );

            if (result.success) {
                setAllReports(result.data);
                setTotalPages(result.pagination.totalPages);
                setTotalItems(result.pagination.totalItems);

                applyFilters(result.data);
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

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setDropdownOpen(null);
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    // Apply frontend filters
    const applyFilters = (dataToFilter = allReports) => {
        let filtered = [...dataToFilter];

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(report =>
                report.report_id &&
                report.report_id.toLowerCase().includes(query)
            );
        }

        // Apply status filter
        if (statusFilter !== "all") {
            filtered = filtered.filter(report => {
                const status = getReportStatus(report);
                if (statusFilter === "completed") {
                    return status.toLowerCase() === "completed";
                } else if (statusFilter === "pending") {
                    return status.toLowerCase() !== "completed";
                }
                else if (statusFilter === "sent") {
                    return status.toLowerCase() === "sent";
                }
                return true;
            });
        }

        setFilteredReports(filtered);
        setReports(filtered); // Keep this for backward compatibility
    };

    // Clear all filters
    const clearAllFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
        // Reset to show all reports
        setFilteredReports(allReports);
        setReports(allReports);
    };

    useEffect(() => {
        fetchAllReports();
    }, [currentPage, pageSize]); // Only refetch on page or pageSize change

    // Apply filters when searchQuery or statusFilter changes
    useEffect(() => {
        applyFilters();
    }, [searchQuery, statusFilter]);

    // Toggle report expansion
    const toggleReportExpand = (reportId) => {
        setExpandedReport(expandedReport === reportId ? null : reportId);
    };

    // Toggle dropdown
    const toggleDropdown = (reportId, e) => {
        e.stopPropagation(); // Prevent event bubbling
        setDropdownOpen(dropdownOpen === reportId ? null : reportId);
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
    const capitalizeStatus = (value = "") => {
        return value
            .toString()
            .replace(/_/g, " ")                 // handle snake_case (IN_PROGRESS → IN PROGRESS)
            .trim()
            .toLowerCase()
            .replace(/\b\w/g, char => char.toUpperCase()); // capitalize each word
    };


    // Get asset data for a report
    const getAssetData = (report) => {
        return report.asset_data || [];
    };

    // Calculate report status based on submitState and other fields
    const getReportStatus = (report) => {
        // Priority 1
        if (report.report_status) {
            return capitalizeStatus(report.report_status);
        }

        // Priority 2
        if (report.status) {
            return capitalizeStatus(report.status);
        }

        // Priority 3
        const assetData = getAssetData(report);
        if (assetData.length === 0) return capitalizeStatus("draft");

        const allCompleted = assetData.every(asset => asset.submitState === 1);
        const anyCompleted = assetData.some(asset => asset.submitState === 1);

        if (allCompleted) return capitalizeStatus("completed");
        if (anyCompleted) return capitalizeStatus("in progress");
        return capitalizeStatus("pending");
    };


    // Get status color
    const getStatusColor = (status) => {
        const statusUpper = status.toUpperCase();

        // New statuses
        if (statusUpper === 'CONFIRMED') return 'bg-green-50 text-green-700 border-green-200';
        if (statusUpper === 'SENT') return 'bg-purple-50 text-purple-700 border-purple-200';

        // Existing statuses
        if (statusUpper === 'COMPLETED' || statusUpper === 'COMPLETE') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        if (statusUpper.includes('PROGRESS')) return 'bg-blue-50 text-blue-700 border-blue-100';
        if (statusUpper === 'PENDING' || statusUpper === 'DRAFT') return 'bg-amber-50 text-amber-700 border-amber-100';
        if (statusUpper === 'INCOMPLETE') return 'bg-orange-50 text-orange-700 border-orange-100';

        return 'bg-gray-50 text-gray-700 border-gray-100';
    };

    // Get status icon
    const getStatusIcon = (status) => {
        const statusUpper = status.toUpperCase();

        // New statuses
        if (statusUpper === 'CONFIRMED') return <CheckCircle2 className="w-3 h-3 fill-current" />;
        if (statusUpper === 'SENT') return <Send className="w-3 h-3" />;

        // Existing statuses
        if (statusUpper === 'COMPLETED' || statusUpper === 'COMPLETE') return <CheckCircle2 className="w-3 h-3" />;
        if (statusUpper.includes('PROGRESS')) return <Loader2 className="w-3 h-3" />;
        if (statusUpper === 'PENDING' || statusUpper === 'DRAFT') return <AlertTriangle className="w-3 h-3" />;
        if (statusUpper === 'INCOMPLETE') return <Clock className="w-3 h-3" />;

        return <FileText className="w-3 h-3" />;
    };


    // Clear search
    const clearSearch = () => {
        setSearchQuery("");
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
                    <div className="flex flex-col space-y-4">
                        {/* Header with clear button */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Reports</h2>
                            {(searchQuery || statusFilter !== "all") && (
                                <button
                                    onClick={clearAllFilters}
                                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                                >
                                    <X className="w-3 h-3" />
                                    Clear filters
                                </button>
                            )}
                        </div>

                        {/* Filter inputs in a grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Search Input */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by Report ID..."
                                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={clearSearch}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    >
                                        <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                    </button>
                                )}
                            </div>

                            {/* Status Filter */}
                            <div>
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-gray-400" />
                                    <div className="flex bg-gray-100 rounded-lg p-1">
                                        <button
                                            onClick={() => setStatusFilter("all")}
                                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${statusFilter === "all" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter("completed")}
                                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${statusFilter === "completed" ? "bg-white shadow-sm text-green-600" : "text-gray-600 hover:text-gray-900"}`}
                                        >
                                            Completed
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter("pending")}
                                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${statusFilter === "pending" ? "bg-white shadow-sm text-amber-600" : "text-gray-600 hover:text-gray-900"}`}
                                        >
                                            Pending
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter("sent")}
                                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${statusFilter === "sent" ? "bg-white shadow-sm text-amber-600" : "text-gray-600 hover:text-gray-900"}`}
                                        >
                                            Sent
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Page Size */}
                            <div>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(parseInt(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                >
                                    <option value="10">10 per page</option>
                                    <option value="20">20 per page</option>
                                    <option value="50">50 per page</option>
                                    <option value="100">100 per page</option>
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
                                onClick={() => fetchAllReports()}
                                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Filter Status */}
                            {(searchQuery || statusFilter !== "all") && (
                                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                                    Showing {filteredReports.length} of {allReports.length} reports
                                    {searchQuery && ` matching "${searchQuery}"`}
                                    {statusFilter !== "all" && ` with status: ${statusFilter}`}
                                </div>
                            )}

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
                                        {filteredReports.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                                                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                                    <p>No reports found</p>
                                                    {(searchQuery || statusFilter !== "all") && (
                                                        <button
                                                            onClick={clearAllFilters}
                                                            className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
                                                        >
                                                            Clear filters to see all reports
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredReports.map((report) => {
                                                const isExpanded = expandedReport === report._id;
                                                const assetData = getAssetData(report);
                                                const status = getReportStatus(report);
                                                const statusColor = getStatusColor(status);

                                                const isFullCheckLoading = isActionLoading('fullCheck', report.report_id);
                                                const isHalfCheckLoading = isActionLoading('halfCheck', report.report_id);
                                                const isRetryLoading = isActionLoading('retry', report.report_id);
                                                const isSendLoading = isActionLoading('send', report.report_id);

                                                const isAnyActionLoading = isFullCheckLoading || isHalfCheckLoading || isRetryLoading || isSendLoading;

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
                                                                <div className="relative">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => toggleDropdown(report._id, e)}
                                                                        disabled={isAnyActionLoading}
                                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                    >
                                                                        {isAnyActionLoading ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <MoreVertical className="w-4 h-4" />
                                                                        )}
                                                                    </button>

                                                                    {/* Dropdown Menu */}
                                                                    {dropdownOpen === report._id && (
                                                                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 overflow-hidden">
                                                                            {/* Full Check Button */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleFullCheck(report.report_id)}
                                                                                disabled={isFullCheckLoading}
                                                                                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-emerald-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-b border-gray-100"
                                                                            >
                                                                                {isFullCheckLoading ? (
                                                                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                                                                ) : (
                                                                                    <CheckCheck className="w-4 h-4 text-emerald-600" />
                                                                                )}
                                                                                <div className="flex-1">
                                                                                    <div className="font-medium">Full Check</div>
                                                                                </div>
                                                                            </button>

                                                                            {/* Half Check Button */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleHalfCheck(report.report_id)}
                                                                                disabled={isHalfCheckLoading}
                                                                                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-amber-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-b border-gray-100"
                                                                            >
                                                                                {isHalfCheckLoading ? (
                                                                                    <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                                                                                ) : (
                                                                                    <Check className="w-4 h-4 text-amber-600" />
                                                                                )}
                                                                                <div className="flex-1">
                                                                                    <div className="font-medium">Half Check (faster)</div>
                                                                                </div>
                                                                            </button>

                                                                            {/* Retry Button */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRetry(report.report_id)}
                                                                                disabled={isRetryLoading}
                                                                                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-blue-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-b border-gray-100"
                                                                            >
                                                                                {isRetryLoading ? (
                                                                                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                                                                ) : (
                                                                                    <RefreshCcw className="w-4 h-4 text-blue-600" />
                                                                                )}
                                                                                <div className="flex-1">
                                                                                    <div className="font-medium">Retry</div>
                                                                                </div>
                                                                            </button>

                                                                            {/* Send Button */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleSend(report.report_id)}
                                                                                disabled={isSendLoading}
                                                                                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-indigo-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                            >
                                                                                {isSendLoading ? (
                                                                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                                                                ) : (
                                                                                    <Send className="w-4 h-4 text-indigo-600" />
                                                                                )}
                                                                                <div className="flex-1">
                                                                                    <div className="font-medium">Send</div>
                                                                                </div>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* Expanded Asset Data Row */}
                                                        {isExpanded && (
                                                            <tr>
                                                                <td colSpan="4" className="bg-indigo-50/40">
                                                                    <div className="p-4">
                                                                        <div className="overflow-x-auto rounded-xl border border-indigo-900/15 bg-white">
                                                                            <div className="flex items-center justify-between px-4 py-2">
                                                                                <h3 className="text-sm font-semibold text-gray-800">
                                                                                    Assets
                                                                                </h3>

                                                                                <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                                                                                    <button
                                                                                        onClick={() => setAssetSubmitFilter("all")}
                                                                                        className={`px-3 py-1 text-xs rounded-md ${assetSubmitFilter === "all"
                                                                                            ? "bg-white shadow text-gray-900"
                                                                                            : "text-gray-600 hover:text-gray-900"
                                                                                            }`}
                                                                                    >
                                                                                        All
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => setAssetSubmitFilter("completed")}
                                                                                        className={`px-3 py-1 text-xs rounded-md ${assetSubmitFilter === "completed"
                                                                                            ? "bg-white shadow text-emerald-700"
                                                                                            : "text-gray-600 hover:text-gray-900"
                                                                                            }`}
                                                                                    >
                                                                                        Completed
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => setAssetSubmitFilter("pending")}
                                                                                        className={`px-3 py-1 text-xs rounded-md ${assetSubmitFilter === "pending"
                                                                                            ? "bg-white shadow text-amber-700"
                                                                                            : "text-gray-600 hover:text-gray-900"
                                                                                            }`}
                                                                                    >
                                                                                        Pending
                                                                                    </button>

                                                                                </div>
                                                                            </div>

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
                                                                                    {/* FILTER ASSETS HERE */}
                                                                                    {(() => {
                                                                                        // Get assets and apply filter
                                                                                        let filteredAssets = getAssetData(report);

                                                                                        if (assetSubmitFilter !== "all") {
                                                                                            filteredAssets = filteredAssets.filter(asset => {
                                                                                                if (assetSubmitFilter === "completed") {
                                                                                                    return asset.submitState === 1;
                                                                                                } else if (assetSubmitFilter === "pending") {
                                                                                                    return asset.submitState === 0;
                                                                                                } else if (assetSubmitFilter === "deleted") {
                                                                                                    return asset.submitState === -1;
                                                                                                }
                                                                                                return true;
                                                                                            });
                                                                                        }

                                                                                        // Count display
                                                                                        const totalAssets = getAssetData(report).length;
                                                                                        const filteredCount = filteredAssets.length;

                                                                                        return (
                                                                                            <>
                                                                                                {/* Filter status message */}
                                                                                                {assetSubmitFilter !== "all" && (
                                                                                                    <tr>
                                                                                                        <td colSpan="6" className="px-4 py-2 bg-blue-50 text-xs text-blue-700">
                                                                                                            Showing {filteredCount} of {totalAssets} assets ({assetSubmitFilter})
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                )}

                                                                                                {/* Empty state */}
                                                                                                {filteredAssets.length === 0 ? (
                                                                                                    <tr>
                                                                                                        <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                                                                                                            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                                                                                            <p>No assets found</p>
                                                                                                            {assetSubmitFilter !== "all" && (
                                                                                                                <p className="text-sm mt-1">
                                                                                                                    No {assetSubmitFilter} assets in this report
                                                                                                                </p>
                                                                                                            )}
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                ) : (
                                                                                                    // Render filtered assets
                                                                                                    filteredAssets.map((asset, index) => (
                                                                                                        <tr key={asset.internal_uid || asset.id || index} className="hover:bg-gray-50">
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
                                                                                                                <button
                                                                                                                    onClick={() => handleOpenEdit(asset, report._id)}
                                                                                                                    disabled={editLoading[asset.internal_uid || asset.id]}
                                                                                                                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium
                       border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                                                                                                                >
                                                                                                                    {editLoading[asset.internal_uid || asset.id] ? (
                                                                                                                        <>
                                                                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                                                                            Saving…
                                                                                                                        </>
                                                                                                                    ) : (
                                                                                                                        "Edit"
                                                                                                                    )}
                                                                                                                </button>
                                                                                                            </td>
                                                                                                        </tr>

                                                                                                    ))
                                                                                                )}
                                                                                            </>
                                                                                        );
                                                                                    })()}
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
                            {filteredReports.length > 0 && totalPages > 0 && (
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
                {!loading && filteredReports.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Showing Reports</p>
                                    <p className="text-2xl font-bold text-gray-900">{filteredReports.length}</p>
                                </div>
                                <FileText className="w-8 h-8 text-indigo-600" />
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Completed</p>
                                    <p className="text-2xl font-bold text-emerald-600">
                                        {filteredReports.filter(r => getReportStatus(r).toLowerCase() === "completed").length}
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
                                        {filteredReports.reduce((sum, report) => sum + (report.asset_data?.length || 0), 0)}
                                    </p>
                                </div>
                                <Package className="w-8 h-8 text-purple-600" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <EditAssetModal
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                asset={selectedAsset}
                reportId={selectedReportId}
                onAssetUpdate={fetchAllReports}
            />

        </div>
    );
};

export default ReportsTable;