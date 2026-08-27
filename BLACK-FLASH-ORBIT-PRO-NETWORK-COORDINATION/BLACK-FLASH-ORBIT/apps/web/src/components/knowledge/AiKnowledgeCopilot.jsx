import { BrainCircuit, X } from "lucide-react";
import { ConfidenceMeter } from "./ConfidenceMeter.jsx";
import { CopilotChat } from "./CopilotChat.jsx";
import { KnowledgeActionMenu } from "./KnowledgeActionMenu.jsx";
import { QuickPromptBar } from "./QuickPromptBar.jsx";
import { RagContextPanel } from "./RagContextPanel.jsx";
import { SourceCitationCard } from "./SourceCitationCard.jsx";

export function AiKnowledgeCopilot({
  activeDocument,
  citations = [],
  commandActions = [],
  confidence = 0,
  isLoading,
  messages = [],
  onClose,
  onRunCommandAction,
  onSubmitQuestion,
  quickPrompts = [],
  selectedContext = [],
  variant = "panel",
}) {
  const isDrawer = variant === "drawer";
  const panelClass = isDrawer
    ? "fixed inset-0 z-50 overflow-y-auto bg-[#050506] p-4 text-zinc-100"
    : "sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg border border-[#d9ad57]/20 bg-white/[0.035] p-4 shadow-2xl shadow-black/30";

  return (
    <section
      aria-label="AI Knowledge Copilot"
      aria-modal={isDrawer ? "true" : undefined}
      className={panelClass}
      id={isDrawer ? undefined : "copilot"}
      role={isDrawer ? "dialog" : "region"}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-[#d9ad57]/30 bg-[#d9ad57]/10 text-[#f1c36f]">
            <BrainCircuit size={21} />
          </span>
          <div className="min-w-0">
            <p className="orbit-kicker">AI Knowledge Copilot v3.0</p>
            <h2 className="mt-1 text-xl font-black text-white">
              Ask documents with source-aware context
            </h2>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Authenticated RAG API with retrieved context and citations.
            </p>
          </div>
        </div>

        {isDrawer ? (
          <button
            aria-label="Close AI Knowledge Copilot"
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-[#d9ad57]/35 hover:text-white"
            onClick={onClose}
            type="button">
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/25 p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
          Active Source
        </p>
        <p className="mt-2 truncate text-sm font-black text-white">
          {activeDocument?.title || "No document selected"}
        </p>
        <p className="mt-1 text-xs font-bold text-zinc-500">
          {activeDocument?.source || "Select a document to focus AI actions."}
        </p>
      </div>

      <div className="mt-4 grid gap-4">
        <KnowledgeActionMenu
          actions={commandActions}
          isLoading={isLoading}
          onRunAction={onRunCommandAction}
        />

        <QuickPromptBar
          isLoading={isLoading}
          onSelectPrompt={onSubmitQuestion}
          prompts={quickPrompts}
        />

        <CopilotChat
          isLoading={isLoading}
          messages={messages}
          onSubmitQuestion={onSubmitQuestion}
        />

        <ConfidenceMeter confidence={confidence} />

        <RagContextPanel context={selectedContext} />

        <section className="rounded-lg border border-white/10 bg-black/25 p-4">
          <div>
            <p className="orbit-kicker">Source Citation Cards</p>
            <h3 className="mt-1 text-lg font-black text-white">
              {citations.length ? `${citations.length} citation(s)` : "No citations"}
            </h3>
          </div>

          <div className="mt-4 grid gap-3">
            {citations.length ? (
              citations.map((citation) => (
                <SourceCitationCard citation={citation} key={citation.id} />
              ))
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4 text-sm font-bold text-zinc-500">
                No citations. Ask a question with matching local context.
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
