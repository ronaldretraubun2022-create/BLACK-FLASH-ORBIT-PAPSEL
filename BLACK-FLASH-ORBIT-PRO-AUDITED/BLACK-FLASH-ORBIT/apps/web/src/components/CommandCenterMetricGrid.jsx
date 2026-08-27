export function CommandCenterMetricGrid({ dashboardStats }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {dashboardStats.map((stat) => {
        const Icon = stat.icon;

        return (
          <article className="orbit-card" key={stat.label}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-zinc-500">
                  {stat.label}
                </p>
                <p className="mt-3 text-3xl font-black text-white">
                  {stat.value}
                </p>
              </div>
              <div className="grid size-11 place-items-center rounded-lg bg-amber-300/10 text-amber-200">
                <Icon size={21} />
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-400">{stat.detail}</p>
          </article>
        );
      })}
    </section>
  );
}
