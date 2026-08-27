import { ClaimStatusList } from "./ClaimStatusList.jsx";
import { EditorialReviewBadge } from "./EditorialReviewBadge.jsx";
import { PublicationBlockers } from "./PublicationBlockers.jsx";
import { SourceConfidenceBadge } from "./SourceConfidenceBadge.jsx";

export function VerificationPanel({ editorial, verification }) {
  if (!verification && !editorial) return null;

  const confidence = editorial?.confidence;
  const factGuard = verification?.factGuard || {};
  const citationCoverage = Math.round(
    Number(verification?.citationGuard?.coverage || 0) * 100,
  );

  return (
    <section className="mb-5 rounded-3xl border border-white/10 bg-[#070d1a]/95 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            Verification Layer
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Automated review highlights risks. It is not human fact-check
            approval.
          </p>
        </div>
        <EditorialReviewBadge status={editorial?.reviewStatus} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Editorial confidence
          </p>
          <p className="mt-2 text-lg font-black text-white">
            {Number(confidence?.score || 0)}%
          </p>
          <p className="text-xs font-bold text-slate-500">
            {confidence?.level || "INSUFFICIENT"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Citation coverage
          </p>
          <p className="mt-2 text-lg font-black text-white">
            {citationCoverage}%
          </p>
          <p className="text-xs font-bold text-slate-500">
            {verification?.citationGuard?.requiredCount || 0} required
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Source quality
          </p>
          <SourceConfidenceBadge
            sourceConfidence={verification?.sourceConfidence}
          />
        </div>
      </div>

      <div className="mb-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-4">
        <span>Supported: {factGuard.supportedCount || 0}</span>
        <span>Partial: {factGuard.partialCount || 0}</span>
        <span>Unsupported: {factGuard.unsupportedCount || 0}</span>
        <span>Conflicting: {factGuard.conflictingCount || 0}</span>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          Publication blockers
        </p>
        <PublicationBlockers
          blockers={verification?.publicationBlockers || []}
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
          Claim status
        </p>
        <ClaimStatusList claims={verification?.claims || []} />
      </div>
    </section>
  );
}
