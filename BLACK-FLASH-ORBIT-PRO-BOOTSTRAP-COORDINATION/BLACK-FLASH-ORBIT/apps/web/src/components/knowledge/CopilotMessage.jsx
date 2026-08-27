import { Bot, Gauge, Link2, UserRound } from "lucide-react";

export function CopilotMessage({ message }) {
  const isAssistant = message.role === "assistant";
  const Icon = isAssistant ? Bot : UserRound;
  const isStreaming = Boolean(message.isStreaming);

  return (
    <article
      className={`rounded-lg border p-3 ${
        isAssistant
          ? "border-[#d9ad57]/25 bg-[#d9ad57]/10"
          : "border-white/10 bg-white/[0.04]"
      }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-lg border ${
              isAssistant
                ? "border-[#d9ad57]/30 bg-[#d9ad57]/15 text-[#f1c36f]"
                : "border-white/10 bg-black/25 text-zinc-300"
            }`}>
            <Icon size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              {isAssistant ? "AI Copilot" : "Operator"}
            </p>
            <p className="text-[10px] font-bold text-zinc-600">
              {message.timestamp}
            </p>
          </div>
        </div>

        {isAssistant && message.confidence ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black text-zinc-300">
            <Gauge size={12} />
            {message.confidence}%
          </span>
        ) : null}
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-200">
        {message.content}
        {isStreaming ? <span className="ml-1 inline-block animate-pulse">|</span> : null}
      </p>

      {isAssistant ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/20 px-2 py-1">
            <Link2 size={12} />
            {message.citationCount || 0} citation(s)
          </span>
          <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1">
            {isStreaming ? "Typing" : message.mode || "rag-api"}
          </span>
        </div>
      ) : null}
    </article>
  );
}
