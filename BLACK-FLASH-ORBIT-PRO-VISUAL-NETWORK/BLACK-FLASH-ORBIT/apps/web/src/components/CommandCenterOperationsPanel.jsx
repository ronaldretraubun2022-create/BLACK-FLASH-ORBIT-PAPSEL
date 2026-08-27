import { Bot, ChevronRight, Newspaper } from "lucide-react";

export function CommandCenterOperationsPanel({
  displayedModuleItems,
  projectFlow,
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <article className="orbit-panel" id="ai-newsroom">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="orbit-kicker">Newsroom Pipeline</p>
            <h3 className="mt-2 text-2xl font-black text-white">
              Editorial production flow
            </h3>
          </div>
          <Newspaper className="text-amber-200" size={26} />
        </div>

        <div className="mt-6 grid gap-3">
          {projectFlow.map((step) => {
            const Icon = step.icon;

            return (
              <div className="orbit-flow-row" key={step.title}>
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-amber-200">
                  <Icon size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-black text-white">{step.title}</h4>
                    <span className="text-xs font-black text-amber-200">
                      {step.progress}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    {step.body}
                  </p>
                  {(step.provenance || step.recordedAt) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {step.provenance && (
                        <span className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.06] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-200/80">
                          {step.provenance}
                        </span>
                      )}
                      {step.recordedAt && (
                        <span className="text-[11px] font-semibold tabular-nums text-zinc-500">
                          {step.recordedAt}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <article className="orbit-panel" id="media-intel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="orbit-kicker">AI Modules</p>
            <h3 className="mt-2 text-2xl font-black text-white">
              Production engines
            </h3>
          </div>
          <Bot className="text-amber-200" size={26} />
        </div>

        <div className="mt-6 grid gap-3">
          {displayedModuleItems.map((module) => {
            const Icon = module.icon;

            return (
              <div className="orbit-module-row" key={module.name}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-[#7d1f2f]/40 text-rose-100">
                    <Icon size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">
                      {module.name}
                    </p>
                    <p className="text-xs font-semibold text-zinc-500">
                      {module.state}
                    </p>
                  </div>
                </div>
                <ChevronRight className="text-zinc-600" size={18} />
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}
