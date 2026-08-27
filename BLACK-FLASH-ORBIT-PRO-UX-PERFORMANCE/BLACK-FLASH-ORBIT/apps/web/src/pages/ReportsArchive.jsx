import { useEffect, useState } from "react";
import { Download, FileText, RefreshCcw } from "lucide-react";
import { api } from "../services/api";

export function ReportsArchive() {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState("-");
  const [error, setError] = useState("");

  async function loadReports() {
    setIsLoading(true);
    setError("");

    try {
      const data = await api.getReports();
      setReports(data);
      setLastSync(new Date().toLocaleTimeString("id-ID"));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <div className="mx-auto max-w-7xl">
      <section className="rounded-3xl border border-cyan-300/15 bg-white/[0.035] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.28em] text-cyan-300">
              NEWSROOM ARCHIVE
            </p>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">
              Reports Archive
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
              Kelola laporan audit, security review, dependency scan, dan build
              validation untuk kesiapan deploy BLACK FLASH ORBIT.
            </p>
          </div>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-300/20"
            onClick={loadReports}
            type="button">
            <RefreshCcw size={16} />
            Refresh Reports
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-200">
            Last Sync: {lastSync}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1">
            Reports: {reports.length}
          </span>
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm font-bold text-rose-200">
          {error}
        </div>
      )}

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total Reports" value={reports.length} />
        <SummaryCard
          label="Average Score"
          value={
            reports.length
              ? Math.round(
                  reports.reduce(
                    (sum, item) => sum + Number(item.score || 0),
                    0,
                  ) / reports.length,
                )
              : 0
          }
        />
        <SummaryCard
          label="Ready"
          value={reports.filter((item) => item.status === "READY").length}
        />
        <SummaryCard
          label="Active"
          value={reports.filter((item) => item.status === "ACTIVE").length}
        />
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
              REPORT TABLE
            </p>
            <h3 className="mt-2 text-xl font-black text-white">
              Audit Reports
            </h3>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold text-slate-400">
            /api/v1/reports
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="py-3 pr-4">ID</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Score</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Created</th>
                <th className="py-3 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="py-5 text-cyan-200" colSpan="6">
                    Loading reports...
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr className="border-b border-white/5" key={report.id}>
                    <td className="py-4 pr-4 font-black text-white">
                      {report.id}
                    </td>
                    <td className="py-4 pr-4 text-slate-300">{report.type}</td>
                    <td className="py-4 pr-4 font-black text-cyan-200">
                      {report.score}%
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="py-4 pr-4 text-slate-500">
                      {formatDate(report.createdAt)}
                    </td>
                    <td className="py-4 pr-4">
                      <button
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-slate-300 opacity-70"
                        disabled
                        type="button">
                        <Download size={14} />
                        Export Soon
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <FileText className="text-cyan-300" size={18} />
      <p className="mt-4 text-[10px] font-black tracking-[0.18em] text-slate-500">
        {label.toUpperCase()}
      </p>
      <h3 className="mt-2 text-2xl font-black text-white">{value}</h3>
    </article>
  );
}

function StatusBadge({ status }) {
  return (
    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black text-cyan-200">
      {status}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getErrorMessage(error) {
  if (typeof error === "string") return error;
  if (typeof error?.message === "string") return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Gagal memuat reports.";
  }
}
