import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Globe2,
  Landmark,
  Link2,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const sourceCollections = [
  {
    credibility: "High",
    description:
      "Rilis resmi, pengumuman lembaga, dokumen publik, dan kanal organisasi yang dapat dipertanggungjawabkan.",
    name: "Official Records",
    risk: "Low",
    sources: ["Government portals", "Institutional press room", "Public registry"],
    type: "Primary",
  },
  {
    credibility: "Medium",
    description:
      "Liputan media, arsip pemberitaan, dan laporan publik untuk konteks awal sebelum verifikasi silang.",
    name: "News Archive",
    risk: "Medium",
    sources: ["National media", "Local newsroom", "Newswire archive"],
    type: "Context",
  },
  {
    credibility: "Medium",
    description:
      "Jejak komunikasi publik, pernyataan terbuka, dan sinyal sosial yang harus selalu dikonfirmasi ulang.",
    name: "Public Signal",
    risk: "Medium",
    sources: ["Public posts", "Community statements", "Open event pages"],
    type: "Signal",
  },
  {
    credibility: "High",
    description:
      "Dokumen laporan tahunan, catatan organisasi, dan materi referensi terbuka untuk due diligence editorial.",
    name: "Document Trail",
    risk: "Low",
    sources: ["PDF reports", "Public filings", "Open publications"],
    type: "Evidence",
  },
];

const timelineItems = [
  {
    detail: "Tentukan subjek, lokasi, periode waktu, dan pertanyaan editorial yang harus dijawab.",
    status: "Scope",
    title: "Case Scope Defined",
  },
  {
    detail: "Kumpulkan sumber primer dan tandai sumber sekunder sebagai konteks, bukan bukti final.",
    status: "Collect",
    title: "Source Collection",
  },
  {
    detail: "Bandingkan minimal dua sumber independen sebelum masuk ke draft berita atau laporan.",
    status: "Verify",
    title: "Cross-check Evidence",
  },
  {
    detail: "Catat batas etik, privasi, dan legal sebelum publikasi atau eskalasi ke editor.",
    status: "Review",
    title: "Editorial Risk Review",
  },
];

const caseNotes = [
  {
    label: "Priority",
    text: "Utamakan informasi publik yang relevan untuk kepentingan jurnalistik.",
  },
  {
    label: "Boundary",
    text: "Hindari data privat, bypass login, scraping agresif, atau eksploitasi teknis.",
  },
  {
    label: "Verification",
    text: "Semua klaim harus melewati konfirmasi silang dan catatan sumber.",
  },
];

const quickEntities = [
  "Pejabat publik",
  "Perusahaan daerah",
  "Lokasi kejadian",
  "Program pemerintah",
  "Kontraktor proyek",
  "Organisasi masyarakat",
];

function getRiskClass(value) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "low") {
    return "border-emerald-300/30 bg-emerald-400/15 text-emerald-100";
  }

  if (normalized === "medium") {
    return "border-amber-300/30 bg-amber-400/15 text-amber-100";
  }

  return "border-red-300/30 bg-red-500/15 text-red-100";
}

function getCredibilityClass(value) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "high") {
    return "border-emerald-300/30 bg-emerald-400/15 text-emerald-100";
  }

  if (normalized === "medium") {
    return "border-amber-300/30 bg-amber-400/15 text-amber-100";
  }

  return "border-stone-300/20 bg-white/10 text-stone-200";
}

export function OSINTWorkspace() {
  const [entityQuery, setEntityQuery] = useState("");
  const [entityType, setEntityType] = useState("Public figure");
  const [caseNote, setCaseNote] = useState(
    "Kumpulkan sumber terbuka, beri label kredibilitas, lalu eskalasi hanya setelah verifikasi silang.",
  );

  const suggestedSources = useMemo(() => {
    const query = entityQuery.trim().toLowerCase();

    if (!query) return sourceCollections;

    return sourceCollections.filter((collection) =>
      [collection.name, collection.description, collection.type, ...collection.sources]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [entityQuery]);

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="orbit-hero-card">
          <div className="min-w-0">
            <p className="orbit-eyebrow">PUBLIC INTELLIGENCE</p>
            <h2 className="mt-3 text-4xl font-black leading-none text-white sm:text-5xl lg:text-6xl">
              OSINT Workspace
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-400 sm:text-base">
              Ruang kerja riset terbuka untuk jurnalis: pencarian entitas,
              koleksi sumber, timeline investigasi, catatan kasus, dan penilaian
              risiko secara defensif.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="orbit-primary-button">
                <ShieldCheck size={17} />
                Defensive Only
              </span>
              <span className="orbit-secondary-button">
                No scraping or exploitation
              </span>
            </div>
          </div>

          <div className="orbit-live-core">
            <span className="orbit-pulse online" />
            <strong>SAFE</strong>
            <span>Frontend mock workspace - no backend OSINT endpoint required</span>
          </div>
        </article>

        <article className="orbit-status-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="orbit-eyebrow">ETHICAL NOTICE</p>
              <h3 className="mt-2 text-xl font-black text-white">
                Legal Defensive Boundary
              </h3>
            </div>
            <Scale className="text-amber-300" size={26} />
          </div>
          <p className="mt-4 text-sm leading-6 text-stone-400">
            Gunakan hanya sumber terbuka yang sah, relevan, dan dapat
            diverifikasi. Modul ini tidak menyediakan bypass login, scraping
            agresif, exploit, data privat, atau instruksi intrusif.
          </p>
          <div className="mt-5 grid gap-2">
            <NoticeLine icon={CheckCircle2} text="Respect privacy and consent." />
            <NoticeLine icon={BookOpenCheck} text="Record source provenance." />
            <NoticeLine icon={AlertTriangle} text="Escalate sensitive findings to editor/legal review." />
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <article className="orbit-widget">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="orbit-eyebrow">ENTITY SEARCH</p>
              <h3 className="mt-2 text-xl font-black text-white">
                Research Target
              </h3>
            </div>
            <Search className="text-amber-300" size={22} />
          </div>

          <div className="grid gap-3">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-stone-500">
                Entity keyword
              </span>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-stone-400 focus-within:border-amber-300/30">
                <Search size={17} />
                <input
                  className="h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold text-stone-100 outline-none placeholder:text-stone-600"
                  onChange={(event) => setEntityQuery(event.target.value)}
                  placeholder="Nama entitas, proyek, lokasi, atau isu..."
                  type="search"
                  value={entityQuery}
                />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-stone-500">
                Entity type
              </span>
              <select
                className="h-12 rounded-lg border border-white/10 bg-black/20 px-3 text-sm font-black text-stone-100 outline-none focus:border-amber-300/30"
                onChange={(event) => setEntityType(event.target.value)}
                value={entityType}
              >
                <option>Public figure</option>
                <option>Organization</option>
                <option>Location</option>
                <option>Public program</option>
                <option>Company</option>
                <option>Event</option>
              </select>
            </label>

            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
              <p className="text-xs font-black uppercase text-amber-100">
                Query Brief
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                {entityQuery.trim()
                  ? `Riset awal untuk "${entityQuery.trim()}" sebagai ${entityType}.`
                  : `Masukkan entitas untuk memulai riset sebagai ${entityType}.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {quickEntities.map((entity) => (
                <button
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-stone-300 transition hover:border-amber-300/30 hover:text-amber-100"
                  key={entity}
                  onClick={() => setEntityQuery(entity)}
                  type="button"
                >
                  {entity}
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="orbit-widget">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="orbit-eyebrow">SOURCE COLLECTION</p>
              <h3 className="mt-2 text-xl font-black text-white">
                Safe Source Cards
              </h3>
            </div>
            <Globe2 className="text-amber-300" size={22} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {suggestedSources.map((collection) => (
              <SourceCard collection={collection} key={collection.name} />
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <article className="orbit-widget">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="orbit-eyebrow">INVESTIGATION TIMELINE</p>
              <h3 className="mt-2 text-xl font-black text-white">
                Verification Flow
              </h3>
            </div>
            <Clock3 className="text-amber-300" size={22} />
          </div>

          <div className="grid gap-3">
            {timelineItems.map((item, index) => (
              <article
                className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 md:grid-cols-[44px_minmax(0,1fr)_120px] md:items-start"
                key={item.title}
              >
                <span className="grid size-10 place-items-center rounded-lg border border-amber-300/20 bg-amber-300/10 text-sm font-black text-amber-100">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h4 className="text-sm font-black text-white">{item.title}</h4>
                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    {item.detail}
                  </p>
                </div>
                <span className="w-fit rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-black uppercase text-stone-300 md:justify-self-end">
                  {item.status}
                </span>
              </article>
            ))}
          </div>
        </article>

        <article className="orbit-widget">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="orbit-eyebrow">CASE NOTES</p>
              <h3 className="mt-2 text-xl font-black text-white">
                Editorial Notes
              </h3>
            </div>
            <FileText className="text-amber-300" size={22} />
          </div>

          <textarea
            className="min-h-36 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-6 text-stone-100 outline-none placeholder:text-stone-600 focus:border-amber-300/30"
            onChange={(event) => setCaseNote(event.target.value)}
            value={caseNote}
          />

          <div className="mt-4 grid gap-3">
            {caseNotes.map((note) => (
              <article
                className="rounded-lg border border-white/10 bg-black/20 p-3"
                key={note.label}
              >
                <p className="text-xs font-black uppercase text-amber-200">
                  {note.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {note.text}
                </p>
              </article>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function NoticeLine({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-stone-300">
      <Icon className="shrink-0 text-amber-300" size={16} />
      <span>{text}</span>
    </div>
  );
}

function SourceCard({ collection }) {
  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-amber-200">
            {collection.type}
          </p>
          <h4 className="mt-2 text-base font-black text-white">
            {collection.name}
          </h4>
        </div>
        <Landmark className="shrink-0 text-stone-500" size={20} />
      </div>

      <p className="mt-3 text-sm leading-6 text-stone-400">
        {collection.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <TagBadge className={getRiskClass(collection.risk)} icon={AlertTriangle}>
          Risk: {collection.risk}
        </TagBadge>
        <TagBadge className={getCredibilityClass(collection.credibility)} icon={Sparkles}>
          Credibility: {collection.credibility}
        </TagBadge>
      </div>

      <div className="mt-4 grid gap-2">
        {collection.sources.map((source) => (
          <div
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-stone-400"
            key={source}
          >
            <Link2 className="shrink-0 text-amber-300" size={14} />
            {source}
          </div>
        ))}
      </div>
    </article>
  );
}

function TagBadge({ children, className, icon: Icon }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-black uppercase ${className}`}
    >
      <Icon size={13} />
      {children}
    </span>
  );
}
