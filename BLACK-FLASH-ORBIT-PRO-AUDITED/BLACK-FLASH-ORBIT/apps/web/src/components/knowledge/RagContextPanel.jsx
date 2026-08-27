import { Layers3 } from "lucide-react";

export function RagContextPanel({ context = [] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="orbit-kicker">Retrieved Context</p>
          <h3 className="mt-1 text-lg font-black text-white">
            {context.length ? `${context.length} match(es)` : "No context retrieved"}
          </h3>
        </div>
        <Layers3 className="text-[#d9ad57]" size={20} />
      </div>

      <div className="mt-4 grid gap-3">
        {context.length ? (
          context.map((item) => (
            <article
              className="rounded-lg border border-white/10 bg-white/[0.035] p-3"
              key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs font-bold text-zinc-500">
                    {item.source}
                  </p>
                </div>
                <span className="rounded-md border border-[#d9ad57]/25 bg-[#d9ad57]/10 px-2 py-1 text-[10px] font-black text-[#f1c36f]">
                  {item.score}%
                </span>
              </div>

              <div className="mt-3 grid gap-2">
                {item.chunks.map((chunk, index) => (
                  <p
                    className="rounded-md border border-white/10 bg-black/25 p-2 text-xs leading-5 text-zinc-300"
                    key={`${item.id}-${index}`}>
                    {chunk}
                  </p>
                ))}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm font-bold text-zinc-500">
            No context retrieved. Ask a question or run an AI action.
          </div>
        )}
      </div>
    </section>
  );
}
