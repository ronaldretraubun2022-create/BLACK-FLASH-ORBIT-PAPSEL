import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  Upload,
} from "lucide-react";
import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
} from "../services/backupService";

export function BackupCenter() {
  const fileInputRef = useRef(null);
  const [lastExportAt, setLastExportAt] = useState("");
  const [importSummary, setImportSummary] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  async function handleExportBackup() {
    setError("");
    setSuccess("");
    setImportSummary(null);
    setIsExporting(true);

    try {
      const backup = await exportWorkspaceBackup();
      const exportedAt = backup.metadata?.exportedAt || new Date().toISOString();

      setLastExportAt(exportedAt);
      setSuccess("Backup JSON berhasil didownload.");
    } catch (backupError) {
      setError(backupError.message || "Gagal export backup.");
    } finally {
      setIsExporting(false);
    }
  }

  function openImportPicker() {
    setError("");
    setSuccess("");
    fileInputRef.current?.click();
  }

  async function handleImportBackup(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setError("");
    setSuccess("");
    setImportSummary(null);
    setIsImporting(true);

    try {
      const summary = await importWorkspaceBackup(file);

      setImportSummary(summary);
      setSuccess("Import backup selesai diproses.");
    } catch (backupError) {
      setError(backupError.message || "Gagal import backup.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
            <DatabaseBackup size={20} />
          </span>
          <p className="mt-5 text-[10px] font-black tracking-[0.24em] text-cyan-300">
            BACKUP CENTER
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Workspace Backup & Restore
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Export dan import data AI Workspace personal: chat sessions,
            messages, prompt library, dan profil aman tanpa token atau secret.
          </p>
        </div>

        <div className="grid gap-2 sm:min-w-56">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-wait disabled:opacity-60"
            disabled={isExporting || isImporting}
            onClick={handleExportBackup}
            type="button"
          >
            <Download size={16} />
            {isExporting ? "Exporting..." : "Export Backup"}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100 disabled:cursor-wait disabled:opacity-60"
            disabled={isExporting || isImporting}
            onClick={openImportPicker}
            type="button"
          >
            <Upload size={16} />
            {isImporting ? "Importing..." : "Import Backup JSON"}
          </button>
          <input
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportBackup}
            ref={fileInputRef}
            type="file"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <StatusTile
          label="Last Export"
          value={lastExportAt ? formatDate(lastExportAt) : "Belum ada export"}
        />
        <StatusTile
          label="Import Status"
          value={
            importSummary
              ? `${importSummary.importedSessions || 0} sessions, ${
                  importSummary.importedMessages || 0
                } messages`
              : "Menunggu file JSON"
          }
        />
        <StatusTile
          label="Skipped Records"
          value={String(importSummary?.skippedRecords || 0)}
        />
      </div>

      {success && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm font-bold text-cyan-100">
          <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm font-bold text-rose-200">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <span>{error}</span>
        </div>
      )}

      {importSummary?.errors?.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
            Import Warnings
          </p>
          <ul className="mt-3 grid gap-2 text-xs leading-5 text-amber-100/80">
            {importSummary.errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StatusTile({ label, value }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </article>
  );
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
