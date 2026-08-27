import { BlockersCard } from "./BlockersCard.jsx";
import { EditorialStatusCard } from "./EditorialStatusCard.jsx";
import { EditorActionsCard } from "./EditorActionsCard.jsx";
import { SourceGapsCard } from "./SourceGapsCard.jsx";
import { UnsupportedClaimsCard } from "./UnsupportedClaimsCard.jsx";

export function IntelligenceSummaryPanel({ summary }) {
  if (!summary) return null;

  return (
    <section className="mb-5 rounded-3xl border border-[#f1c36f]/20 bg-[#f1c36f]/[0.045] p-4">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#f1c36f]">
          Intelligence Summary
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Source-aware editorial decision layer. It does not replace human
          approval.
        </p>
      </div>

      <div className="grid gap-3">
        <EditorialStatusCard summary={summary} />

        {summary.keyFindings?.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Key Findings
            </p>
            <div className="grid gap-2">
              {summary.keyFindings.slice(0, 6).map((finding) => (
                <p
                  key={finding}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-5 text-slate-300"
                >
                  {finding}
                </p>
              ))}
            </div>
          </section>
        )}

        <BlockersCard blockers={summary.blockers || []} />
        <UnsupportedClaimsCard claims={summary.unsupportedClaims || []} />
        <SourceGapsCard gaps={summary.sourceGaps || []} />
        <EditorActionsCard actions={summary.editorActions || []} />
      </div>
    </section>
  );
}
