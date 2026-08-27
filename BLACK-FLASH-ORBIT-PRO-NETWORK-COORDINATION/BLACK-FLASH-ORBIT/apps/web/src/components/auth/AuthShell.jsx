import { RadioTower, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export function AuthShell({
  alternateLabel,
  alternateText,
  alternateTo,
  children,
  description,
  title,
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060a12] px-4 py-10 text-slate-100">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-cyan-300/15 bg-[#09101c] shadow-2xl shadow-cyan-950/30 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(8,145,178,0.34),_transparent_48%),linear-gradient(145deg,_rgba(14,116,144,0.18),_rgba(3,7,18,0.88))] p-9 lg:block">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
            <RadioTower size={22} />
          </span>
          <p className="mt-24 text-[10px] font-black tracking-[0.28em] text-cyan-300">
            SECURE NEWSROOM ACCESS
          </p>
          <h1 className="mt-4 max-w-md text-4xl font-black tracking-tight text-white">
            BLACK FLASH ORBIT
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-400">
            Platform operasional AI untuk newsroom, multimedia, dan monitoring
            sistem produksi.
          </p>
          <div className="mt-28 flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-cyan-300">
            <ShieldCheck size={16} />
            AUTHENTICATED CHANNEL
          </div>
        </section>

        <section className="p-6 sm:p-9">
          <p className="text-[10px] font-black tracking-[0.28em] text-cyan-300">
            ORBIT AUTHENTICATION
          </p>
          <h2 className="mt-4 text-3xl font-black text-white">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>

          <div className="mt-8">{children}</div>

          <p className="mt-7 text-sm text-slate-500">
            {alternateText}{" "}
            <Link
              className="font-bold text-cyan-300 transition hover:text-cyan-200"
              to={alternateTo}
            >
              {alternateLabel}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
