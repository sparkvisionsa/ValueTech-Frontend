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
    Send,
    Table,
    Eye
} from "lucide-react";
import { useRam } from "../context/RAMContext";
import { useSession } from "../context/SessionContext";
import EditAssetModal from "./EditAssetModal";

const ReportsTable = () => {
    const [reports, setReports] = useState([]);
    const [assetFilter, setAssetFilter] = useState("all");
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
    const [allReports, setAllReports] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(null);

    const [loadingActions, setLoadingActions] = useState({
        fullCheck: {},
        halfCheck: {},
        retry: {},
        send: {}
    });

    const { token } = useSession();

    const { ramInfo } = useRam();
    const tabsNum = ramInfo?.recommendedTabs || 1;

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
    };

    const isActionLoading = (actionType, reportId) => {
        return loadingActions[actionType]?.[reportId] || false;
    };

    const handleFullCheck = async (reportId) => {
        if (isActionLoading('fullCheck', reportId)) return;

        setActionLoading('fullCheck', reportId, true);
        setDropdownOpen(null);
        try {
            await window.electronAPI?.fullCheck?.(reportId, tabsNum);
            setTimeout(() => {
                fetchAllReports();
            }, 1000);
        } catch (error) {
            console.error('Full check error:', error);
            setError('Failed to perform full check');
        } finally {
            setTimeout(() => {
                setActionLoading('fullCheck', reportId, false);
            }, 500);
        }
    };

    const handleHalfCheck = async (reportId) => {
        if (isActionLoading('halfCheck', reportId)) return;

        setActionLoading('halfCheck', reportId, true);
        setDropdownOpen(null);
        try {
            await window.electronAPI?.halfCheck?.(reportId, tabsNum);
            setTimeout(() => {
                fetchAllReports();
            }, 1000);
        } catch (error) {
            console.error('Half check error:', error);
            setError('Failed to perform half check');
        } finally {
            setTimeout(() => {
                setActionLoading('halfCheck', reportId, false);
            }, 500);
        }
    };

    const handleRetry = async (reportId) => {
        if (isActionLoading('retry', reportId)) return;

        setActionLoading('retry', reportId, true);
        setDropdownOpen(null);
        try {
            await window.electronAPI?.macroFillRetry?.(reportId, tabsNum);
            setTimeout(() => {
                fetchAllReports();
            }, 1000);
        } catch (error) {
            console.error('Retry error:', error);
            setError('Failed to retry macro fill');
        } finally {
            setTimeout(() => {
                setActionLoading('retry', reportId, false);
            }, 500);
        }
    };

    const handleSend = async (reportId) => {
        if (isActionLoading('send', reportId)) return;

        setActionLoading('send', reportId, true);
        setDropdownOpen(null);
        try {
            await window.electronAPI?.finalizeMultipleReports?.([reportId]);
            setTimeout(() => {
                fetchAllReports();
            }, 1000);
        } catch (error) {
            console.error('Send error:', error);
            setError('Failed to send report');
        } finally {
            setTimeout(() => {
                setActionLoading('send', reportId, false);
            }, 500);
        }
    };

    const fetchAllReports = async () => {
        try {
            setLoading(true);
            setError("");

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

    useEffect(() => {
        const handleClickOutside = () => {
            setDropdownOpen(null);
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const applyFilters = (dataToFilter = allReports) => {
        let filtered = [...dataToFilter];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(report =>
                report.report_id &&
                report.report_id.toLowerCase().includes(query)
            );
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter(report => {
                const status = getReportStatus(report);
                if (statusFilter === "completed") {
                    return status.toLowerCase() === "completed";
                } else if (statusFilter === "pending") {
                    return status.toLowerCase() !== "completed" && status.toLowerCase() !== "sent";
                }
                else if (statusFilter === "sent") {
                    return status.toLowerCase() === "sent";
                }
                return true;
            });
        }

        setFilteredReports(filtered);
        setReports(filtered);
    };

    const clearAllFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
        setFilteredReports(allReports);
        setReports(allReports);
    };

    useEffect(() => {
        fetchAllReports();
    }, [currentPage, pageSize]);

    useEffect(() => {
        applyFilters();
    }, [searchQuery, statusFilter]);

    const toggleReportExpand = (reportId) => {
        setExpandedReport(expandedReport === reportId ? null : reportId);
    };

    const toggleDropdown = (reportId, e) => {
        e.stopPropagation();
        setDropdownOpen(dropdownOpen === reportId ? null : reportId);
    };

    const handlePageChange = (page) => {
        const pageNumber = Number(page);
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "—";
        try {
            return new Date(dateString).toLocaleDateString();
        } catch {
            return dateString;
        }
    };

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
            .replace(/_/g, " ")
            .trim()
            .toLowerCase()
            .replace(/\b\w/g, char => char.toUpperCase());
    };

    const getAssetData = (report) => {
        return report.asset_data || [];
    };

    const getReportStatus = (report) => {
        if (report.report_status) {
            return capitalizeStatus(report.report_status);
        }

        if (report.status) {
            return capitalizeStatus(report.status);
        }

        const assetData = getAssetData(report);
        if (assetData.length === 0) return capitalizeStatus("draft");

        const allCompleted = assetData.every(asset => asset.submitState === 1);
        const anyCompleted = assetData.some(asset => asset.submitState === 1);

        if (allCompleted) return capitalizeStatus("completed");
        if (anyCompleted) return capitalizeStatus("in progress");
        return capitalizeStatus("pending");
    };

    const getStatusColor = (status) => {
        const statusUpper = status.toUpperCase();

        if (statusUpper === 'CONFIRMED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        if (statusUpper === 'SENT') return 'border-purple-200 bg-purple-50 text-purple-700';
        if (statusUpper === 'COMPLETED' || statusUpper === 'COMPLETE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        if (statusUpper.includes('PROGRESS')) return 'border-blue-200 bg-blue-50 text-blue-700';
        if (statusUpper === 'PENDING' || statusUpper === 'DRAFT') return 'border-amber-200 bg-amber-50 text-amber-700';
        if (statusUpper === 'INCOMPLETE') return 'border-orange-200 bg-orange-50 text-orange-700';

        return 'border-gray-200 bg-gray-50 text-gray-700';
    };

    const getStatusIcon = (status) => {
        const statusUpper = status.toUpperCase();

        if (statusUpper === 'CONFIRMED') return <CheckCircle2 className="w-2.5 h-2.5" />;
        if (statusUpper === 'SENT') return <Send className="w-2.5 h-2.5" />;
        if (statusUpper === 'COMPLETED' || statusUpper === 'COMPLETE') return <CheckCircle2 className="w-2.5 h-2.5" />;
        if (statusUpper.includes('PROGRESS')) return <Loader2 className="w-2.5 h-2.5 animate-spin" />;
        if (statusUpper === 'PENDING' || statusUpper === 'DRAFT') return <AlertTriangle className="w-2.5 h-2.5" />;
        if (statusUpper === 'INCOMPLETE') return <Clock className="w-2.5 h-2.5" />;

        return <FileText className="w-2.5 h-2.5" />;
    };

    const clearSearch = () => {
        setSearchQuery("");
    };

    return (
        <div className="min-h-screen bg-gray-50 py-3 px-3">
            <div className="mx-auto flex flex-col gap-3">
                {/* Header Section - Made more compact */}
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Reports Management</h1>
                        <p className="text-xs text-gray-600">
                            View and manage all reports
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={fetchAllReports}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-100 text-gray-800 text-xs font-semibold hover:bg-gray-200 border border-gray-200"
                    >
                        <RefreshCcw className="w-3 h-3" />
                        Refresh
                    </button>
                </div>

                {/* Search and Filter Bar - Made more compact */}
                <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                <Search className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by Report ID..."
                                className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                            {searchQuery && (
                                <button
                                    onClick={clearSearch}
                                    className="absolute inset-y-0 right-0 pr-2 flex items-center"
                                >
                                    <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                                </button>
                            )}
                        </div>

                        {/* Status Filter - Made more compact */}
                        <div className="flex items-center gap-1.5">
                            <Filter className="h-3.5 w-3.5 text-gray-400" />
                            <div className="flex bg-gray-100 rounded-md p-0.5 gap-0.5">
                                <button
                                    onClick={() => setStatusFilter("all")}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${statusFilter === "all" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setStatusFilter("pending")}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${statusFilter === "pending" ? "bg-white shadow-sm text-amber-600" : "text-gray-600 hover:text-gray-900"}`}
                                >
                                    Pending
                                </button>
                                <button
                                    onClick={() => setStatusFilter("completed")}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${statusFilter === "completed" ? "bg-white shadow-sm text-emerald-600" : "text-gray-600 hover:text-gray-900"}`}
                                >
                                    Completed
                                </button>
                                <button
                                    onClick={() => setStatusFilter("sent")}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${statusFilter === "sent" ? "bg-white shadow-sm text-purple-600" : "text-gray-600 hover:text-gray-900"}`}
                                >
                                    Sent
                                </button>
                            </div>
                        </div>

                        {/* Page Size */}
                        <div className="w-full sm:w-auto">
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(parseInt(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="w-full sm:w-auto px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                            >
                                <option value="10">10 per page</option>
                                <option value="20">20 per page</option>
                                <option value="50">50 per page</option>
                                <option value="100">100 per page</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Reports Table - Made more compact */}
                <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            <span className="ml-2 text-xs text-gray-600">Loading reports...</span>
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center">
                            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                            <p className="text-xs text-rose-600 mb-2">{error}</p>
                            <button
                                onClick={() => fetchAllReports()}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 font-medium"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <>
                            {(searchQuery || statusFilter !== "all") && (
                                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                                    Showing {filteredReports.length} of {allReports.length} reports
                                    {searchQuery && ` matching "${searchQuery}"`}
                                    {statusFilter !== "all" && ` with status: ${statusFilter}`}
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <table className="min-w-full text-xs">
                                    <thead className="bg-gray-50 text-gray-700 uppercase">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-semibold"></th>
                                            <th className="px-3 py-2 text-left font-semibold">Report ID</th>
                                            <th className="px-3 py-2 text-left font-semibold">Status</th>
                                            <th className="px-3 py-2 text-left font-semibold">Assets</th>
                                            <th className="px-3 py-2 text-left font-semibold">Created Date</th>
                                            <th className="px-3 py-2 text-left font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {filteredReports.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-3 py-6 text-center text-gray-500">
                                                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                    <p className="text-xs">No reports found</p>
                                                    {(searchQuery || statusFilter !== "all") && (
                                                        <button
                                                            onClick={clearAllFilters}
                                                            className="mt-1 text-xs text-blue-600 hover:text-blue-800"
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
                                                        <tr className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-3 py-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleReportExpand(report._id)}
                                                                    className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="w-3 h-3" />
                                                                    ) : (
                                                                        <ChevronRight className="w-3 h-3" />
                                                                    )}
                                                                </button>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <p className="font-medium text-gray-900">{report.report_id || "—"}</p>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${statusColor}`}>
                                                                    {getStatusIcon(status)}
                                                                    {status}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="inline-flex items-center gap-1">
                                                                    <Package className="w-3 h-3 text-gray-400" />
                                                                    <span className="text-gray-700">{assetData.length}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 text-gray-600">
                                                                {formatDate(report.createdAt)}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="relative">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => toggleDropdown(report._id, e)}
                                                                        disabled={isAnyActionLoading}
                                                                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    >
                                                                        {isAnyActionLoading ? (
                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                        ) : (
                                                                            <MoreVertical className="w-3 h-3" />
                                                                        )}
                                                                    </button>

                                                                    {dropdownOpen === report._id && (
                                                                        <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10 overflow-hidden">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleFullCheck(report.report_id)}
                                                                                disabled={isFullCheckLoading}
                                                                                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-emerald-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-100"
                                                                            >
                                                                                {isFullCheckLoading ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                                                                                ) : (
                                                                                    <CheckCheck className="w-3 h-3 text-emerald-600" />
                                                                                )}
                                                                                Full Check
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleHalfCheck(report.report_id)}
                                                                                disabled={isHalfCheckLoading}
                                                                                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-amber-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-100"
                                                                            >
                                                                                {isHalfCheckLoading ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                                                                                ) : (
                                                                                    <Check className="w-3 h-3 text-amber-600" />
                                                                                )}
                                                                                Half Check
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRetry(report.report_id)}
                                                                                disabled={isRetryLoading}
                                                                                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-blue-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border-b border-gray-100"
                                                                            >
                                                                                {isRetryLoading ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                                                                                ) : (
                                                                                    <RefreshCcw className="w-3 h-3 text-blue-600" />
                                                                                )}
                                                                                Retry
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleSend(report.report_id)}
                                                                                disabled={isSendLoading}
                                                                                className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-indigo-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                            >
                                                                                {isSendLoading ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                                                                ) : (
                                                                                    <Send className="w-3 h-3 text-indigo-600" />
                                                                                )}
                                                                                Send
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {isExpanded && (
                                                            <tr>
                                                                <td colSpan="6" className="bg-gray-50 border-t border-gray-200">
                                                                    <div className="px-3 py-2">
                                                                        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                                                                            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <Table className="w-3 h-3 text-gray-600" />
                                                                                    <h4 className="text-xs font-semibold text-gray-900">Assets in Report</h4>
                                                                                    <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                                                                                        {assetData.length} assets
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-xs text-gray-500">
                                                                                    Report ID: {report.report_id}
                                                                                </div>
                                                                            </div>

                                                                            {/* Asset Filter Buttons */}
                                                                            <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <span className="text-xs font-medium text-gray-600">Filter:</span>
                                                                                    <div className="flex bg-gray-100 rounded-md p-0.5 gap-0.5">
                                                                                        <button
                                                                                            onClick={() => setAssetFilter('all')}
                                                                                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${assetFilter === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                                                                                        >
                                                                                            All
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => setAssetFilter('completed')}
                                                                                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${assetFilter === 'completed' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-600 hover:text-gray-900'}`}
                                                                                        >
                                                                                            Submitted
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => setAssetFilter('incomplete')}
                                                                                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${assetFilter === 'incomplete' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-600 hover:text-gray-900'}`}
                                                                                        >
                                                                                            Pending
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <div className="overflow-x-auto">
                                                                                <table className="min-w-full text-xs">
                                                                                    <thead className="bg-gray-50 text-gray-500 uppercase">
                                                                                        <tr>
                                                                                            <th className="px-3 py-1.5 text-left font-semibold">Asset ID</th>
                                                                                            <th className="px-3 py-1.5 text-left font-semibold">Name</th>
                                                                                            <th className="px-3 py-1.5 text-left font-semibold">Inspection Date</th>
                                                                                            <th className="px-3 py-1.5 text-left font-semibold">Value</th>
                                                                                            <th className="px-3 py-1.5 text-left font-semibold">Submit State</th>
                                                                                            <th className="px-3 py-1.5 text-left font-semibold">Actions</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {(() => {
                                                                                            let filteredAssets = [...assetData];

                                                                                            if (assetFilter === 'completed') {
                                                                                                filteredAssets = assetData.filter(asset => asset.submitState === 1);
                                                                                            } else if (assetFilter === 'incomplete') {
                                                                                                filteredAssets = assetData.filter(asset => asset.submitState !== 1);
                                                                                            }

                                                                                            if (filteredAssets.length === 0) {
                                                                                                return (
                                                                                                    <tr>
                                                                                                        <td colSpan="6" className="px-3 py-3 text-center text-gray-500">
                                                                                                            <Package className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                                                                                                            <p className="text-xs">
                                                                                                                {assetFilter === 'all'
                                                                                                                    ? 'No assets found in this report'
                                                                                                                    : assetFilter === 'completed'
                                                                                                                        ? 'No completed assets found'
                                                                                                                        : 'No incomplete assets found'}
                                                                                                            </p>
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                );
                                                                                            }

                                                                                            return filteredAssets.map((asset) => (
                                                                                                <tr key={asset.internal_uid} className="border-t hover:bg-gray-50">
                                                                                                    <td className="px-3 py-1.5">
                                                                                                        <span className="font-mono text-gray-900">{asset.id || "—"}</span>
                                                                                                    </td>
                                                                                                    <td className="px-3 py-1.5 text-gray-700">
                                                                                                        {asset.asset_name || "—"}
                                                                                                    </td>
                                                                                                    <td className="px-3 py-1.5">
                                                                                                        <span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs">
                                                                                                            {asset.inspection_date || "—"}
                                                                                                        </span>
                                                                                                    </td>
                                                                                                    <td className="px-3 py-1.5">
                                                                                                        <span className="font-medium">
                                                                                                            {formatCurrency(asset.final_value)}
                                                                                                        </span>
                                                                                                    </td>
                                                                                                    <td className="px-3 py-1.5">
                                                                                                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium border ${asset.submitState === 1
                                                                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                                                            : 'border-amber-200 bg-amber-50 text-amber-700'
                                                                                                            }`}>
                                                                                                            {asset.submitState === 1 ? (
                                                                                                                <CheckCircle2 className="w-2.5 h-2.5" />
                                                                                                            ) : (
                                                                                                                <Clock className="w-2.5 h-2.5" />
                                                                                                            )}
                                                                                                            {asset.submitState === 1 ? 'Submitted' : 'Pending'}
                                                                                                        </span>
                                                                                                    </td>
                                                                                                    <td className="px-3 py-1.5">
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => handleOpenEdit(asset, report._id)}
                                                                                                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                                                                            disabled={editLoading[asset.internal_uid]}
                                                                                                        >
                                                                                                            {editLoading[asset.internal_uid] ? (
                                                                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                                                            ) : (
                                                                                                                'Edit'
                                                                                                            )}
                                                                                                        </button>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ));
                                                                                        })()}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
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

                            {/* Pagination - Made more compact */}
                            {filteredReports.length > 0 && (
                                <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                                    <div className="text-xs text-gray-600">
                                        Showing <span className="font-semibold">{((currentPage - 1) * pageSize) + 1}</span> to{" "}
                                        <span className="font-semibold">{Math.min(currentPage * pageSize, totalItems)}</span> of{" "}
                                        <span className="font-semibold">{totalItems}</span> reports
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1}
                                            className="inline-flex items-center justify-center w-6 h-6 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft className="w-3 h-3" />
                                        </button>

                                        <div className="flex items-center gap-0.5 mx-1">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                let pageNum;
                                                if (totalPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (currentPage <= 3) {
                                                    pageNum = i + 1;
                                                } else if (currentPage >= totalPages - 2) {
                                                    pageNum = totalPages - 4 + i;
                                                } else {
                                                    pageNum = currentPage - 2 + i;
                                                }

                                                return (
                                                    <button
                                                        key={pageNum}
                                                        type="button"
                                                        onClick={() => handlePageChange(pageNum)}
                                                        className={`w-6 h-6 rounded text-xs font-medium ${currentPage === pageNum
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                            className="inline-flex items-center justify-center w-6 h-6 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ChevronRightIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Edit Asset Modal */}
            {editModalOpen && selectedAsset && (
                <EditAssetModal
                    asset={selectedAsset}
                    reportId={selectedReportId}
                    isOpen={editModalOpen}
                    onClose={() => {
                        setEditModalOpen(false);
                        setSelectedAsset(null);
                        setSelectedReportId(null);
                    }}
                    onSave={() => {
                        fetchAllReports();
                    }}
                />
            )}
        </div>
    );
};

export default ReportsTable;