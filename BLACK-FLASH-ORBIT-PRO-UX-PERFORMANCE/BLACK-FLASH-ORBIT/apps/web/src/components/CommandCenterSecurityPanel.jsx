import { CheckCircle2, Lock, ShieldCheck, Zap } from "lucide-react";

export function CommandCenterSecurityPanel({
  securityItems = [],
  healthStatus = "READY",
}) {
  return (
    <section className="orbit-card p-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-cyan-300" />
        <div>
          <p className="orbit-kicker">Security Center</p>
          <h3 className="text-lg font-black text-white">Workspace Security</h3>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
          Security Health
        </p>

        <p className="mt-2 text-2xl font-black text-white">{healthStatus}</p>
      </div>

      <div className="mt-5 space-y-3">
        {securityItems.map((item) => {
          const Icon = item.icon || ShieldCheck;

          return (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-cyan-300" />
                <span className="text-sm text-zinc-300">{item.label}</span>
              </div>

              <span className="font-mono text-xs text-emerald-300">
                {item.value}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 p-3">
          <Lock className="h-4 w-4 text-amber-300" />
          <span className="text-sm text-zinc-300">
            Protected Routes Enabled
          </span>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 p-3">
          <Zap className="h-4 w-4 text-cyan-300" />
          <span className="text-sm text-zinc-300">Rate Limiting Active</span>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/10 p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <span className="text-sm text-zinc-300">Audit Engine Ready</span>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
          Next Action
        </p>

        <p className="mt-2 text-sm font-semibold text-white">
          Run Workspace Audit
        </p>
      </div>
    </section>
  );
}
