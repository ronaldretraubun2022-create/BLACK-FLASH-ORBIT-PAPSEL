import {
  CheckCircle2,
  FileText,
  Layers3,
  Search,
  ShieldCheck,
} from "lucide-react";

const actionIconMap = {
  "compare-sources": Layers3,
  "explain-selected-source": Search,
  "find-security-risks": ShieldCheck,
  "generate-action-items": CheckCircle2,
  "summarize-document": FileText,
};

export function KnowledgeActionMenu({
  actions = [],
  isLoading,
  onRunAction,
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="mb-3">
        <p className="orbit-kicker">Command Actions</p>
        <h3 className="mt-1 text-sm font-black text-white">
          AI Knowledge Copilot
        </h3>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {actions.map((action) => {
          const Icon = actionIconMap[action.id] || FileText;

          return (
            <button
              aria-label={`Run action: ${action.label}`}
              className="flex min-h-12 items-start gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-left transition hover:border-[#d9ad57]/35 hover:bg-[#d9ad57]/8 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              key={action.id}
              onClick={() => onRunAction(action)}
              type="button">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#d9ad57]/25 bg-[#d9ad57]/10 text-[#f1c36f]">
                <Icon size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-white">
                  {action.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  {action.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
