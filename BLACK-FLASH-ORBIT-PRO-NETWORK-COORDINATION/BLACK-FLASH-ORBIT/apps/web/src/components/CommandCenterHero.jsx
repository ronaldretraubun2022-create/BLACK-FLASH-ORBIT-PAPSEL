import { Activity, BarChart3, CircleDot } from "lucide-react";

export function CommandCenterHero({
  healthStatus,
  isTelemetryLoading,
  isUsingFallback,
  releaseState,
  telemetryError,
  telemetryLabels,
  telemetryStatusText,
  uptimeLabel,
  onStartEditorialPulse,
  onViewSystemReport,
}) {
  return (
    <section className="orbit-hero" id="command">
      <div className="relative z-10 max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {releaseState.map((item) => (
            <span className="orbit-release-pill" key={item.label}>
              {item.label}: <strong className={item.tone}>{item.value}</strong>
            </span>
          ))}
          <span className="orbit-release-pill">
            Backend Runtime:{" "}
            <strong
              className={
                telemetryError
                  ? "text-rose-300"
                  : isTelemetryLoading
                    ? "text-amber-300"
                    : isUsingFallback
                      ? "text-amber-300"
                      : "text-emerald-300"
              }
            >
              {telemetryError
                ? "fallback"
                : isTelemetryLoading
                  ? "syncing"
                  : isUsingFallback
                    ? "fallback"
                    : "connected"}
            </strong>
          </span>
        </div>

        <p className="orbit-kicker">AI Media Production Suite</p>
        <h3 className="mt-3 max-w-2xl text-4xl font-black leading-[1.02] text-white md:text-6xl">
          BLACK FLASH ORBIT Command Center
        </h3>
        <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-300 md:text-base">
          Dashboard operasional untuk redaksi AI, transkrip audio, arsip berita,
          kontrol admin, dan produksi multimedia modern.
        </p>
        <p className="mt-3 text-xs font-bold uppercase text-zinc-500">
          {telemetryStatusText}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {telemetryLabels.map((item) => (
            <span className="orbit-release-pill" key={item.label}>
              {item.label}: <strong className="text-zinc-200">{item.value}</strong>
            </span>
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            className="orbit-primary-button"
            onClick={onStartEditorialPulse}
            type="button"
          >
            <Activity size={18} />
            Start Editorial Pulse
          </button>
          <button
            className="orbit-secondary-button"
            onClick={onViewSystemReport}
            type="button"
          >
            <BarChart3 size={18} />
            View System Report
          </button>
        </div>
      </div>

      <div className="orbit-radar" aria-label="Live newsroom radar">
        <span className="orbit-radar-ring" />
        <span className="orbit-radar-ring delay-1" />
        <span className="orbit-radar-ring delay-2" />
        <div className="relative z-10 text-center">
          <CircleDot className="mx-auto text-emerald-300" size={44} />
          <p className="mt-4 text-xs font-black uppercase text-amber-200">
            {healthStatus}
          </p>
          <p className="mt-1 text-3xl font-black text-white">{uptimeLabel}</p>
        </div>
      </div>
    </section>
  );
}
