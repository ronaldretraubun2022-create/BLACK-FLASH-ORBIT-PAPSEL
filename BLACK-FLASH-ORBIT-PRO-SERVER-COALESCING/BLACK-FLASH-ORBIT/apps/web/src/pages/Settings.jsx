import { Database, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { BackupCenter } from "../components/BackupCenter";

export function Settings() {
  return (
    <div className="mx-auto max-w-7xl">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(8,145,178,0.28),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-5 shadow-2xl shadow-cyan-950/20 sm:p-7 lg:p-9">
        <span className="flex size-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-300">
          <SettingsIcon size={23} />
        </span>
        <p className="mt-6 text-[10px] font-black tracking-[0.28em] text-cyan-300">
          SYSTEM CONFIGURATION
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Settings
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
          Kontrol konfigurasi workspace, backup personal, dan kesiapan data
          operasional BLACK FLASH ORBIT.
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <InfoCard
          icon={ShieldCheck}
          label="Security"
          title="Authenticated Backup"
          value="Bearer token Supabase wajib untuk export dan import."
        />
        <InfoCard
          icon={Database}
          label="Data Scope"
          title="Personal Workspace"
          value="Backup hanya memproses data milik user login."
        />
      </section>

      <div className="mt-6">
        <BackupCenter />
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, title, value }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
      <Icon className="text-cyan-300" size={20} />
      <p className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
        {label}
      </p>
      <h3 className="mt-2 text-lg font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{value}</p>
    </article>
  );
}
