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
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 flex items-start gap-3">
                    <ShieldCheck className="w-6 h-6 text-yellow-600 mt-1" />
                    <div>
                        <h2 className="text-lg font-semibold text-yellow-800">Company head required</h2>
                        <p className="text-sm text-yellow-700">
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
        { label: 'Company users', value: totals.users, icon: Users, tone: 'from-emerald-500 to-teal-600' },
        { label: 'Team members', value: totals.members, icon: Building2, tone: 'from-cyan-500 to-sky-500' },
        { label: 'Total reports', value: totals.reports, icon: FileText, tone: 'from-amber-500 to-orange-500' },
        { label: 'Urgent incomplete', value: reportStatus.incomplete, icon: Activity, tone: 'from-rose-500 to-pink-500' }
    ]), [totals, reportStatus.incomplete]);

    const reportTypeRows = [
        { key: 'standard', label: 'Standard reports', value: reportTypes.standard, tone: 'from-cyan-500 to-blue-600' },
        { key: 'urgent', label: 'Urgent reports', value: reportTypes.urgent, tone: 'from-rose-500 to-orange-500' },
        { key: 'duplicate', label: 'Duplicate reports', value: reportTypes.duplicate, tone: 'from-amber-500 to-yellow-500' },
        { key: 'multiApproach', label: 'Multi approach', value: reportTypes.multiApproach, tone: 'from-emerald-500 to-teal-500' },
        { key: 'elrajhi', label: 'Elrajhi batch', value: reportTypes.elrajhi, tone: 'from-indigo-500 to-blue-500' }
    ];

    const reportStatusRows = [
        { key: 'incomplete', label: 'Incomplete', value: reportStatus.incomplete, tone: 'from-slate-400 to-slate-600' },
        { key: 'complete', label: 'Complete', value: reportStatus.complete, tone: 'from-emerald-500 to-teal-600' },
        { key: 'sent', label: 'Sent', value: reportStatus.sent, tone: 'from-cyan-500 to-sky-500' },
        { key: 'confirmed', label: 'Confirmed', value: reportStatus.confirmed, tone: 'from-amber-500 to-orange-500' }
    ];

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 text-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.45)]">
                <div className="pointer-events-none absolute -left-10 top-8 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl float-slow" />
                <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl float-slower" />
                <div className="pointer-events-none absolute bottom-0 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />

                <div className="relative flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 border border-white/20">
                                <Building2 className="w-6 h-6 text-emerald-200" />
                            </span>
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Company Pulse</p>
                                <h1 className="font-display text-[22px] font-semibold text-white text-compact">
                                    {company.name || user?.companyName || 'Company Statics'}
                                </h1>
                                <p className="text-[11px] text-slate-300">
                                    Head: {company.headName || user?.headName || 'Company Lead'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={loadStats}
                                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white border border-white/20 hover:bg-white/20"
                            >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                                {loading ? 'Refreshing' : 'Refresh'}
                            </button>
                            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] text-slate-200 border border-white/10">
                                {stats?.generatedAt ? new Date(stats.generatedAt).toLocaleString() : 'Waiting for data'}
                            </span>
                        </div>
                    </div>
                    {error && (
                        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-[11px] text-rose-200">
                            {error}
                        </div>
                    )}
                </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {summaryCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.label}
                            className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur card-animate"
                            style={{ animationDelay: `${index * 70}ms` }}
                        >
                            <span className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${card.tone} opacity-30 blur-2xl`} />
                            <div className="relative flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{card.label}</p>
                                    <p className="mt-1 font-display text-[22px] font-semibold text-slate-900 text-compact">
                                        {formatNumber(card.value)}
                                    </p>
                                </div>
                                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${card.tone} text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]`}>
                                    <Icon className="w-5 h-5" />
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_32px_rgba(15,23,42,0.12)]">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Reports</p>
                            <h2 className="font-display text-[16px] font-semibold text-slate-900">Company Report Mix</h2>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
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
                                        <span className="font-medium text-slate-800">{row.label}</span>
                                        <span>{formatNumber(value)} ({percent}%)</span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
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

                <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_32px_rgba(15,23,42,0.12)]">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Weekly Activity</p>
                            <h2 className="font-display text-[16px] font-semibold text-slate-900">Users + Reports</h2>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">Last 7 days</span>
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
                                            className="w-2.5 rounded-full bg-gradient-to-t from-emerald-500 to-teal-400 shadow-[0_8px_16px_rgba(16,185,129,0.25)]"
                                            style={{ height: `${userHeight}%` }}
                                            title={`${formatNumber(userValue)} users`}
                                        />
                                        <div
                                            className="w-2.5 rounded-full bg-gradient-to-t from-amber-500 to-orange-400 shadow-[0_8px_16px_rgba(251,146,60,0.25)]"
                                            style={{ height: `${reportHeight}%` }}
                                            title={`${formatNumber(reportValue)} reports`}
                                        />
                                    </div>
                                    <span className="text-[9px] text-slate-500">{formatShortDay(label)}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Users
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            Reports
                        </span>
                    </div>
                </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-[0_18px_32px_rgba(15,23,42,0.12)]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Urgent Pipeline</p>
                        <h2 className="font-display text-[16px] font-semibold text-slate-900">Urgent Report Status</h2>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">
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
                                    <span className="font-medium text-slate-800">{row.label}</span>
                                    <span>{formatNumber(value)} ({percent}%)</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
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
