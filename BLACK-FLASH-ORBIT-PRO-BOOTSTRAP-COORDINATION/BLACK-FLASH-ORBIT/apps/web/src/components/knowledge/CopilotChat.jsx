import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { CopilotMessage } from "./CopilotMessage.jsx";

export function CopilotChat({ isLoading, messages = [], onSubmitQuestion }) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef(null);
  const canSubmit = draft.trim().length > 0 && !isLoading;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isLoading, messages]);

  function handleSubmit(event) {
    event.preventDefault();
    const nextQuestion = draft.trim();
    if (!nextQuestion || isLoading) return;

    setDraft("");
    onSubmitQuestion(nextQuestion);
  }

  return (
    <section className="grid min-h-0 gap-3">
      <div className="max-h-[28rem] min-h-[14rem] overflow-y-auto rounded-lg border border-white/10 bg-black/25 p-3">
        {messages.length ? (
          <div className="grid gap-3">
            {messages.map((message) => (
              <CopilotMessage key={message.id} message={message} />
            ))}
            {isLoading ? <LoadingMessage /> : null}
            <span aria-hidden="true" ref={bottomRef} />
          </div>
        ) : (
          <div className="grid min-h-[12rem] place-items-center rounded-lg border border-dashed border-white/10 bg-white/[0.025] p-4 text-center">
            <div>
              <Sparkles className="mx-auto text-[#d9ad57]" size={24} />
              <p className="mt-3 text-sm font-black text-white">
                No AI response yet
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Ask about a document or run a command action to retrieve
                indexed RAG context.
              </p>
            </div>
          </div>
        )}
      </div>

      <form className="grid gap-2" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="knowledge-copilot-question">
          Ask AI Knowledge Copilot
        </label>
        <textarea
          aria-label="Ask AI Knowledge Copilot"
          className="min-h-24 resize-none rounded-lg border border-white/10 bg-black/35 px-3 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 focus:border-[#d9ad57]/45"
          id="knowledge-copilot-question"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              handleSubmit(event);
            }
          }}
          placeholder="Ask about sources, risks, summary, or editorial action items..."
          value={draft}
        />
        <button
          aria-label="Submit Copilot question"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d9ad57]/35 bg-[#d9ad57]/15 px-4 text-sm font-black text-[#f1c36f] transition hover:bg-[#d9ad57]/20 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canSubmit}
          type="submit">
          {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          Ask Copilot
        </button>
      </form>
    </section>
  );
}

function LoadingMessage() {
  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-400">
      <Loader2 className="animate-spin text-[#d9ad57]" size={14} />
      Retrieving RAG context...
    </div>
  );
}
