import { Activity, Clock3, RadioTower, Server } from "lucide-react";

function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) return "Unavailable";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${hours}h ${minutes}m ${remainingSeconds}s`;
}

export function StatusCard({ health, isLoading, error }) {
  const isOnline = health?.status === "online" && !error;
  const statusLabel = isLoading ? "Checking" : isOnline ? "Online" : "Offline";

  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-white/[0.035] shadow-2xl shadow-cyan-950/20">
      <div className="flex flex-col gap-6 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span
            className={`flex size-12 items-center justify-center rounded-2xl border ${
              isOnline
                ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-300"
                : "border-rose-300/25 bg-rose-300/10 text-rose-300"
            }`}
          >
            <RadioTower size={22} />
          </span>
          <div>
            <p className="text-[10px] font-bold tracking-[0.24em] text-slate-500">
              LIVE BACKEND STATUS
            </p>
            <h2 className="mt-1 text-xl font-black text-white">
              {health?.service || "BLACK FLASH ORBIT"}
            </h2>
          </div>
        </div>

        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] ${
            isOnline
              ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-300"
              : "border-rose-300/25 bg-rose-300/10 text-rose-300"
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              isOnline
                ? "bg-cyan-300 shadow-[0_0_16px_#67e8f9]"
                : "bg-rose-300"
            }`}
          />
          {statusLabel}
        </span>
      </div>

      <div className="grid gap-px bg-white/10 sm:grid-cols-3">
        <StatusMetric
          icon={Server}
          label="Environment"
          value={health?.environment || "Unavailable"}
        />
        <StatusMetric
          icon={Activity}
          label="Version"
          value={health?.version || "Unavailable"}
        />
        <StatusMetric
          icon={Clock3}
          label="Uptime"
          value={formatUptime(health?.uptime)}
        />
      </div>

      {error && (
        <p className="border-t border-rose-300/15 bg-rose-300/5 px-5 py-3 text-xs text-rose-200">
          {error}
        </p>
      )}
    </section>
  );
}

function StatusMetric({ icon: Icon, label, value }) {
  return (
    <div className="bg-[#0c1320] p-5">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={15} />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
          {label}
        </span>
      </div>
      <p className="mt-3 text-sm font-bold capitalize text-slate-200">{value}</p>
    </div>
  );
}
