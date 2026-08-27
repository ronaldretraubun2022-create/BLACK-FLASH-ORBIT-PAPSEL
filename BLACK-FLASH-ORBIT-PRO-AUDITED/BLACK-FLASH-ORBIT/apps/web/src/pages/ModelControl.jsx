import { Bot, CheckCircle2 } from "lucide-react";

const models = [
  {
    id: "openrouter/auto",
    name: "OpenRouter Auto",
    role: "Default",
    status: "ACTIVE",
  },
  {
    id: "developer-agent",
    name: "Developer Agent",
    role: "Coding",
    status: "READY",
  },
  {
    id: "security-agent",
    name: "Security Agent",
    role: "Audit",
    status: "READY",
  },
  {
    id: "osint-agent",
    name: "OSINT Agent",
    role: "Research",
    status: "READY",
  },
  {
    id: "writer-agent",
    name: "Writer Agent",
    role: "Newsroom",
    status: "READY",
  },
];

export function ModelControl() {
  return (
    <div className="mx-auto max-w-7xl">
      <section className="rounded-3xl border border-cyan-300/15 bg-white/[0.035] p-6 sm:p-8">
        <p className="text-[10px] font-black tracking-[0.28em] text-cyan-300">
          AI CONTROL
        </p>

        <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">
          Model Control
        </h2>

        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
          Kelola model AI, agent profile, dan konfigurasi workspace ORBIT.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {models.map((model) => (
          <article
            key={model.id}
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <Bot className="text-cyan-300" size={20} />

            <h3 className="mt-4 text-lg font-black text-white">{model.name}</h3>

            <p className="mt-2 text-sm text-slate-400">Role: {model.role}</p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black text-cyan-200">
              <CheckCircle2 size={12} />
              {model.status}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
