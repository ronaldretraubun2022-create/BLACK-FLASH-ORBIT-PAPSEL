import { Sparkles } from "lucide-react";

export function QuickPromptBar({ isLoading, onSelectPrompt, prompts = [] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="orbit-kicker">Quick Prompts</p>
        <Sparkles className="text-[#d9ad57]" size={16} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {prompts.map((prompt) => (
          <button
            aria-label={`Run prompt: ${prompt.label}`}
            className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-zinc-300 transition hover:border-[#d9ad57]/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            key={prompt.id}
            onClick={() => onSelectPrompt(prompt.prompt)}
            type="button">
            {prompt.label}
          </button>
        ))}
      </div>
    </section>
  );
}
