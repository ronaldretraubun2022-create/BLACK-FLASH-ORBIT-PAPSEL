import { FileText, ShieldCheck } from "lucide-react";

function maskEmail(text = "") {
  return String(text).replace(
    /([a-zA-Z0-9._%+-])([a-zA-Z0-9._%+-]*)(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    "$1***$3",
  );
}

function maskSessionIds(text = "") {
  return String(text).replace(/\b([0-9a-f]{8})-[0-9a-f-]{27,}\b/gi, "$1...");
}



function formatProvenanceLabel(value) {
  const normalized = String(value || "unknown")
    .trim()
    .toLowerCase();

  const labels = {
    backend: "Backend",
    stored_metadata: "Stored metadata",
    stored_measurement: "Stored measurement",
    supabase_record: "Supabase record",
    unknown: "Unknown source",
  };

  return (
    labels[normalized] ||
    normalized
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}
function cleanActivityText(text = "") {
  return maskSessionIds(maskEmail(text))
    .replace(/\s+/g, " ")
    .replace("AI chat success:", "AI chat success •")
    .replace("AI chat failed:", "AI chat failed •")
    .trim();
}

export function CommandCenterActivityPanel({
  liveBriefItems = [],
  securityItems = [],
  userRole = "user",
}) {
  return (
    <aside className="grid content-start gap-4">
      <section className="orbit-panel" id="security">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="orbit-kicker">Secure Operations</p>
            <h3 className="mt-2 text-2xl font-black text-white">
              Session guardrail
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
              {userRole}
            </span>
            <ShieldCheck className="text-emerald-300" size={28} />
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {securityItems.map((signal) => {
            const Icon = signal.icon || ShieldCheck;

            return (
              <div className="orbit-signal" key={signal.label}>
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span>{signal.label}</span>
                </div>
                <strong>{signal.value}</strong>
              </div>
            );
          })}
        </div>
      </section>

      <section className="orbit-panel" id="archive">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="orbit-kicker">Live Brief</p>
            <h3 className="mt-2 text-2xl font-black text-white">
              Editorial queue
            </h3>
          </div>
          <FileText className="text-amber-200" size={27} />
        </div>

        <div className="mt-6 grid gap-3">
          {liveBriefItems.map((brief, index) => (
            <article
              className="orbit-brief"
              key={`${brief.desk || "brief"}-${brief.time || "live"}-${index}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase text-amber-200">
                  {brief.desk || "System"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    {formatProvenanceLabel(brief.source)}
                  </span>
                  <span className="text-xs font-bold text-zinc-500">
                    {brief.time || "timestamp unavailable"}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                {cleanActivityText(brief.title || "No activity available.")}
              </p>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}
