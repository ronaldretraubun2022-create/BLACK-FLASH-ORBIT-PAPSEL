import { ArrowUpRight, CircleDot, RadioTower, ShieldCheck } from "lucide-react";

const readinessItems = [
  {
    label: "Interface Shell",
    description:
      "Responsive route workspace mounted inside the persistent ORBIT layout.",
    icon: RadioTower,
  },
  {
    label: "Security Baseline",
    description:
      "Protected route layer and defensive UI state prepared for production.",
    icon: ShieldCheck,
  },
  {
    label: "Module State",
    description: "Feature route is ready for the next implementation slice.",
    icon: CircleDot,
  },
];

export function ModulePlaceholder({ description, eyebrow, icon: Icon, title }) {
  return (
    <div className="mx-auto max-w-7xl">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(8,145,178,0.28),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-5 shadow-2xl shadow-cyan-950/20 sm:p-7 lg:p-9">
        <div className="absolute -right-24 -top-24 size-64 rounded-full bg-cyan-300/10 blur-3xl" />

        <div className="relative">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300 shadow-[0_0_35px_rgba(34,211,238,0.12)]">
            <Icon size={22} />
          </span>

          <p className="mt-6 text-[10px] font-black tracking-[0.28em] text-cyan-300">
            {eyebrow}
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {title}
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
            {description}
          </p>
        </div>
      </section>

      <section className="mt-8">
        <p className="text-[10px] font-bold tracking-[0.24em] text-cyan-300">
          MODULE FOUNDATION
        </p>

        <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">
          Workspace Readiness
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {readinessItems.map(
            ({ label, description: itemDescription, icon: ItemIcon }) => (
              <article
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04]"
                key={label}>
                <ItemIcon className="text-cyan-300" size={19} />

                <h3 className="mt-5 text-base font-black text-white">
                  {label}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {itemDescription}
                </p>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.24em] text-cyan-300">
            ROUTE STATUS
          </p>

          <h2 className="mt-2 text-lg font-black text-white">
            Modular page foundation active
          </h2>
        </div>

        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black tracking-[0.18em] text-cyan-300">
          READY
          <ArrowUpRight size={14} />
        </span>
      </section>
    </div>
  );
}
