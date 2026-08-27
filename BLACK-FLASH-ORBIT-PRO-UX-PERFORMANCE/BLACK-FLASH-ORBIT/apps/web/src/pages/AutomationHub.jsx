import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  GitBranch,
  Play,
  RefreshCcw,
  Rocket,
  Workflow,
} from "lucide-react";
import { api } from "../services/api";

const fallbackEngines = {};

export function AutomationHub() {
  const [automation, setAutomation] = useState(fallbackEngines);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState("-");
  const [error, setError] = useState("");

  async function loadAutomation() {
    setIsLoading(true);
    setError("");

    try {
      const data = await api.getAutomation();
      setAutomation(data || {});
      setLastSync(new Date().toLocaleTimeString("id-ID"));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAutomation();
  }, []);

  const engines = Object.entries(automation);

  return (
    <div className="mx-auto max-w-7xl">
      <section className="rounded-3xl border border-cyan-300/15 bg-white/[0.035] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.28em] text-cyan-300">
              WORKFLOW OPS
            </p>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">
              Automation Hub
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
              Koordinasi audit, backup, validasi build, module registry, dan
              pipeline deploy BLACK FLASH ORBIT.
            </p>
          </div>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/15 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-300/20"
            onClick={loadAutomation}
            type="button">
            <RefreshCcw size={16} />
            Refresh Automation
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold text-slate-400">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-200">
            Last Sync: {lastSync}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1">
            Engines: {engines.length}
          </span>
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm font-bold text-rose-200">
          {error}
        </div>
      )}

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5 text-sm font-bold text-cyan-200">
            Loading automation engines...
          </div>
        ) : (
          engines.map(([key, engine]) => (
            <article
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              key={key}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
                  {getIcon(key)}
                </div>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black text-cyan-200">
                  {engine.status}
                </span>
              </div>

              <h3 className="mt-5 text-lg font-black text-white">
                {engine.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {engine.description}
              </p>

              <button
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-slate-200 opacity-70"
                disabled
                type="button">
                <Play size={14} />
                Manual Run Coming Soon
              </button>
            </article>
          ))
        )}
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
        <p className="text-[10px] font-black tracking-[0.24em] text-cyan-300">
          EXECUTION QUEUE
        </p>
        <h3 className="mt-2 text-xl font-black text-white">
          Pipeline Readiness
        </h3>

        <div className="mt-5 grid gap-3">
          {[
            "Audit workspace structure",
            "Validate build output",
            "Review security backlog",
            "Prepare deployment checklist",
          ].map((item, index) => (
            <div
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/15 p-4"
              key={item}>
              <span className="text-sm font-bold text-slate-300">{item}</span>
              <span className="text-xs font-black text-cyan-300">
                STEP {index + 1}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function getErrorMessage(error) {
  if (typeof error === "string") return error;
  if (typeof error?.message === "string") return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Gagal memuat automation.";
  }
}

function getIcon(key) {
  if (key.includes("audit")) return <Activity size={20} />;
  if (key.includes("fix")) return <Bot size={20} />;
  if (key.includes("scanner")) return <Workflow size={20} />;
  if (key.includes("installer")) return <GitBranch size={20} />;
  if (key.includes("deploy")) return <Rocket size={20} />;
  return <Workflow size={20} />;
}
