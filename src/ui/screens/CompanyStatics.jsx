import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Building2, FileText, Loader2, RefreshCcw, ShieldCheck, Users } from 'lucide-react';
import { useSession } from '../context/SessionContext';

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);

const buildLast7Days = () => {
    const labels = [];
    const today = new Date();
    for (let i = 6; i >= 0; i -= 1) {
        const day = new Date(today);
        day.setDate(today.getDate() - i);
        labels.push(day.toISOString().slice(0, 10));
    }
    return labels;
};

const formatShortDay = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US', { weekday: 'short' });
};

const CompanyStatics = () => {
    const { user, token } = useSession();
    const isCompanyHead = user?.type === 'company' || user?.role === 'company-head';
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadStats = useCallback(async () => {
        if (!window?.electronAPI) return;
        setLoading(true);
        setError('');
        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const data = await window.electronAPI.apiRequest('GET', '/api/companies/stats', {}, headers);
            setStats(data || null);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to load company statics';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (isCompanyHead) {
            loadStats();
        }
    }, [isCompanyHead, loadStats]);

    if (!isCompanyHead) {
        return (
            <div className="p-6">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                        <h2 className="text-[15px] font-semibold text-amber-900">Company head required</h2>
                        <p className="text-[11px] text-amber-700">
                            Please sign in with the company head account to view company statics.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const totals = stats?.totals || {};
    const reportTypes = stats?.reportTypes || {};
    const reportStatus = stats?.reportStatus || {};
    const weekly = stats?.weekly || {};
    const company = stats?.company || {};

    const reportTypeTotal = Object.values(reportTypes).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const reportStatusTotal = Object.values(reportStatus).reduce((sum, value) => sum + (Number(value) || 0), 0);

    const weeklyLabels = weekly.labels?.length ? weekly.labels : buildLast7Days();
    const weeklyUsers = weekly.users?.length ? weekly.users : weeklyLabels.map(() => 0);
    const weeklyReports = weekly.reports?.length ? weekly.reports : weeklyLabels.map(() => 0);
    const maxUsers = Math.max(1, ...weeklyUsers);
    const maxReports = Math.max(1, ...weeklyReports);

    const summaryCards = useMemo(() => ([
        { label: 'Company users', value: totals.users, icon: Users, tone: 'from-blue-500 to-sky-500' },
        { label: 'Team members', value: totals.members, icon: Building2, tone: 'from-indigo-500 to-blue-600' },
        { label: 'Total reports', value: totals.reports, icon: FileText, tone: 'from-amber-500 to-orange-500' },
        { label: 'Urgent incomplete', value: reportStatus.incomplete, icon: Activity, tone: 'from-emerald-500 to-teal-600' }
    ]), [totals, reportStatus.incomplete]);

    const reportTypeRows = [
        { key: 'standard', label: 'Standard reports', value: reportTypes.standard, tone: 'from-blue-500 to-sky-500' },
        { key: 'urgent', label: 'Urgent reports', value: reportTypes.urgent, tone: 'from-amber-500 to-orange-500' },
        { key: 'duplicate', label: 'Duplicate reports', value: reportTypes.duplicate, tone: 'from-slate-400 to-slate-600' },
        { key: 'multiApproach', label: 'Multi approach', value: reportTypes.multiApproach, tone: 'from-emerald-500 to-teal-500' },
        { key: 'elrajhi', label: 'Elrajhi batch', value: reportTypes.elrajhi, tone: 'from-cyan-500 to-blue-600' }
    ];

    const reportStatusRows = [
        { key: 'incomplete', label: 'Incomplete', value: reportStatus.incomplete, tone: 'from-amber-500 to-orange-500' },
        { key: 'complete', label: 'Complete', value: reportStatus.complete, tone: 'from-emerald-500 to-teal-600' },
        { key: 'sent', label: 'Sent', value: reportStatus.sent, tone: 'from-blue-500 to-sky-500' },
        { key: 'confirmed', label: 'Confirmed', value: reportStatus.confirmed, tone: 'from-cyan-500 to-blue-600' }
    ];

    return (
        <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-900/15 bg-gradient-to-r from-white via-blue-50 to-white px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-sm">
                        <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-blue-900/60 font-semibold">Company Pulse</div>
                        <h2 className="text-lg font-bold text-blue-950">
                            {company.name || user?.companyName || 'Company Statics'}
                        </h2>
                        <p className="text-[11px] text-slate-600">
                            Head: {company.headName || user?.headName || 'Company Lead'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={loadStats}
                        className="inline-flex items-center gap-2 rounded-md border border-blue-900/20 bg-white px-3 py-2 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        {loading ? 'Refreshing' : 'Refresh'}
                    </button>
                    <span className="rounded-full border border-blue-900/15 bg-white px-3 py-1 text-[10px] text-blue-900/70">
                        {stats?.generatedAt ? new Date(stats.generatedAt).toLocaleString() : 'Waiting for data'}
                    </span>
                </div>
            </div>
            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {summaryCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.label}
                            className="relative overflow-hidden rounded-2xl border border-blue-900/15 bg-white p-4 shadow-sm card-animate"
                            style={{ animationDelay: `${index * 70}ms` }}
                        >
                            <span className={`pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-gradient-to-br ${card.tone} opacity-20 blur-2xl`} />
                            <div className="relative flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-blue-900/50">{card.label}</p>
                                    <p className="mt-1 text-[18px] font-semibold text-blue-950">
                                        {formatNumber(card.value)}
                                    </p>
                                </div>
                                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${card.tone} text-white shadow-sm`}>
                                    <Icon className="w-5 h-5" />
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-2xl border border-blue-900/15 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-blue-900/50">Reports</p>
                            <h2 className="text-[15px] font-semibold text-blue-950">Company Report Mix</h2>
                        </div>
                        <span className="text-[10px] font-semibold text-blue-900/60">
                            Total {formatNumber(reportTypeTotal)}
                        </span>
                    </div>

                    <div className="mt-5 space-y-4">
                        {reportTypeRows.map((row) => {
                            const value = Number(row.value) || 0;
                            const percent = reportTypeTotal > 0 ? Math.round((value / reportTypeTotal) * 100) : 0;
                            return (
                                <div key={row.key} className="space-y-2">
                                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                                        <span className="font-medium text-blue-950">{row.label}</span>
                                        <span>{formatNumber(value)} ({percent}%)</span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-blue-900/10 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${row.tone}`}
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="rounded-2xl border border-blue-900/15 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-blue-900/50">Weekly Activity</p>
                            <h2 className="text-[15px] font-semibold text-blue-950">Users + Reports</h2>
                        </div>
                        <span className="text-[10px] font-semibold text-blue-900/60">Last 7 days</span>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-2">
                        {weeklyLabels.map((label, index) => {
                            const userValue = Number(weeklyUsers[index]) || 0;
                            const reportValue = Number(weeklyReports[index]) || 0;
                            const userHeight = Math.max(12, Math.round((userValue / maxUsers) * 100));
                            const reportHeight = Math.max(12, Math.round((reportValue / maxReports) * 100));
                            return (
                                <div key={label} className="flex flex-col items-center gap-2">
                                    <div className="flex flex-col items-center justify-end gap-1 h-24">
                                        <div
                                            className="w-2.5 rounded-full bg-gradient-to-t from-blue-500 to-sky-400 shadow-[0_8px_16px_rgba(2,132,199,0.25)]"
                                            style={{ height: `${userHeight}%` }}
                                            title={`${formatNumber(userValue)} users`}
                                        />
                                        <div
                                            className="w-2.5 rounded-full bg-gradient-to-t from-emerald-500 to-teal-400 shadow-[0_8px_16px_rgba(16,185,129,0.25)]"
                                            style={{ height: `${reportHeight}%` }}
                                            title={`${formatNumber(reportValue)} reports`}
                                        />
                                    </div>
                                    <span className="text-[9px] text-blue-900/60">{formatShortDay(label)}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 flex items-center gap-3 text-[10px] text-blue-900/60">
                        <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            Users
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Reports
                        </span>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-blue-900/15 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-blue-900/50">Urgent Pipeline</p>
                        <h2 className="text-[15px] font-semibold text-blue-950">Urgent Report Status</h2>
                    </div>
                    <span className="text-[10px] font-semibold text-blue-900/60">
                        Total {formatNumber(reportStatusTotal)}
                    </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {reportStatusRows.map((row) => {
                        const value = Number(row.value) || 0;
                        const percent = reportStatusTotal > 0 ? Math.round((value / reportStatusTotal) * 100) : 0;
                        return (
                            <div key={row.key} className="space-y-2">
                                <div className="flex items-center justify-between text-[11px] text-slate-600">
                                    <span className="font-medium text-blue-950">{row.label}</span>
                                    <span>{formatNumber(value)} ({percent}%)</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-blue-900/10 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full bg-gradient-to-r ${row.tone}`}
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default CompanyStatics;
