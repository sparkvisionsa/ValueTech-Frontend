import React, { useEffect, useMemo, useState } from "react";
import reportApi from "../../api/report.service";

const submitStateMap = {
  1: "Completed",
  0: "Pending",
  2: "Failed",
};

function StatusBadge({ state, reportStatus }) {
  // Prefer submit_state mapping, fallback to report_status string
  const label =
    state !== undefined && state !== null ? submitStateMap[state] || "Unknown" : reportStatus || "-";

  // tailwind classes
  const cls =
    state === 1
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : state === 0
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      : state === 2
      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      : "bg-slate-50 text-slate-700 ring-1 ring-slate-200";

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

export default function ReportsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // filters
  const [reportId, setReportId] = useState("");
  const [source, setSource] = useState("ALL");
  const [submitState, setSubmitState] = useState("ALL");

  async function load() {
    setLoading(true);
    try {
      const res = await reportApi.getMyReports({ page, limit });
      console.log(res);
      
      setRows(res.data.data || []);
      setTotal(res.data.totalApprox || 0);
    } finally {
      setLoading(false);
    }
  }

  async function searchByReportId() {
    if (!reportId.trim()) return load();
    setLoading(true);
    try {
      const res = await reportApi.lookupReportById(reportId.trim());
      setRows(res.data.status === "success" ? [res.data.data] : []);
      setTotal(res.data.status === "success" ? 1 : 0);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (source !== "ALL" && r.source !== source) return false;
      if (submitState !== "ALL" && Number(r.raw?.submit_state) !== Number(submitState)) return false;
      return true;
    });
  }, [rows, source, submitState]);

  const totalPages = Math.max(1, Math.ceil((total || 1) / limit));

  const isFirst = page === 1;
  const isLast = page === totalPages;

  const getPageNumbers = () => {
  const delta = 2; // how many pages before/after current
  const range = [];
  const rangeWithDots = [];
  let last;

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - delta && i <= page + delta)
    ) {
      range.push(i);
    }
  }

  for (let i of range) {
    if (last) {
      if (i - last === 2) {
        rangeWithDots.push(last + 1);
      } else if (i - last !== 1) {
        rangeWithDots.push("...");
      }
    }
    rangeWithDots.push(i);
    last = i;
  }

  return rangeWithDots;
};


  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My Reports</h2>
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{filteredRows.length}</span> rows (page{" "}
            <span className="font-medium text-slate-700">{page}</span>)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">Report ID</label>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Search Report ID"
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
            />
          </div>

          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">Source</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="ALL">All Sources</option>
              <option value="UrgentReport">UrgentReport</option>
              <option value="DuplicateReport">DuplicateReport</option>
              <option value="MultiApproachReport">MultiApproachReport</option>
              <option value="SubmitReportsQuickly">SubmitReportsQuickly</option>
              <option value="ElrajhiReport">ElrajhiReport</option>
              <option value="Reports">Report</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">Submit State</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={submitState}
              onChange={(e) => setSubmitState(e.target.value)}
            >
              <option value="ALL">All States</option>
              <option value="1">Completed</option>
              <option value="0">Pending</option>
              <option value="2">Failed</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={searchByReportId}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Searching..." : "Search"}
          </button>

          <button
            onClick={load}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-[10px] text-slate-700">
            <thead className="bg-blue-900/10 text-blue-900 sticky top-0">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 ">#</th>
                <th className="whitespace-nowrap px-4 py-3">Report ID</th>
                <th className="whitespace-nowrap px-4 py-3">Client Name</th>
                <th className="whitespace-nowrap px-4 py-3">Source</th>  
                <th className="whitespace-nowrap px-4 py-3">Status</th>
              </tr>
            </thead>

           <tbody className="divide-y divide-slate-100">
  {loading ? (
    <tr>
      <td className="px-4 py-6 text-slate-500 text-center" colSpan={3}>
        Loading...
      </td>
    </tr>
  ) : filteredRows.length === 0 ? (
    <tr>
      <td className="px-4 py-6 text-slate-500 text-center" colSpan={3}>
        No records
      </td>
    </tr>
  ) : (
    filteredRows.map((r, index) => {
      const serial = (page - 1) * limit + index + 1;

      return (
        <tr key={r._id || r.report_id} className="hover:bg-slate-50">
          <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-slate-500">
            {serial}
          </td>

          <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-slate-500">
            {r.report_id || "-"}
          </td>

          <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-slate-500">
            {r.raw?.client_name || r.title || "-"}
          </td>

          <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-slate-500">
            {r.source || "-"}
          </td>

          <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-slate-500">
            <StatusBadge
              state={Number(r.raw?.submit_state)}
              reportStatus={r.raw?.report_status}
            />
          </td>
        </tr>
      );
    })
  )}
</tbody>

          </table>
        </div>

        {/* Pagination */}
        {/* <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            Page <span className="font-semibold text-slate-900">{page}</span> /{" "}
            <span className="font-semibold text-slate-900">{totalPages}</span>
            <span className="ml-2 text-slate-400">(approx total: {total})</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isFirst || loading}
              onClick={() => setPage(1)}
            >
              First
            </button>
            <button
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isFirst || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLast || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
            <button
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLast || loading}
              onClick={() => setPage(totalPages)}
            >
              Last
            </button>
          </div>
        </div> */}


        <div className="flex flex-wrap items-center gap-1">
  {getPageNumbers().map((p, idx) =>
    p === "..." ? (
      <span
        key={idx}
        className="px-2 text-sm text-slate-400"
      >
        ...
      </span>
    ) : (
      <button
        key={p}
        onClick={() => setPage(p)}
        disabled={loading}
        className={`h-9 min-w-[36px] rounded-md border px-3 text-sm font-medium
          ${
            p === page
              ? "bg-black text-white border-black"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
          }
          disabled:opacity-60`}
      >
        {p}
      </button>
    )
  )}
</div>

      </div>
    </div>
  );
}
