import {
  Activity,
  Bot,
  BrainCircuit,
  FileText,
  Globe2,
  LayoutDashboard,
  RadioTower,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Workflow,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const navigation = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "AI Workspace", to: "/ai-workspace", icon: Bot },
  { label: "Knowledge", to: "/knowledge", icon: BrainCircuit },
  { label: "Monitoring", to: "/monitoring", icon: Activity },
  { label: "Security", to: "/security", icon: ShieldCheck },
  { label: "OSINT", to: "/osint", icon: Globe2 },
  { label: "Automation", to: "/automation", icon: Workflow },
  { label: "Reports", to: "/reports", icon: FileText },
  { label: "Models", to: "/models", icon: SlidersHorizontal },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function Sidebar({ isOpen, onClose }) {
  return (
    <>
      <button
        aria-label="Close navigation"
        className={`fixed inset-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        type="button"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#050506]/95 px-5 py-5 shadow-2xl shadow-black/60 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <NavLink className="flex items-center gap-3" onClick={onClose} to="/">
            <span className="grid size-11 place-items-center rounded-lg border border-amber-300/30 bg-amber-300/10 text-amber-200">
              <RadioTower size={20} />
            </span>
            <span>
              <span className="block text-xs font-black uppercase text-stone-400">
                BLACK FLASH
              </span>
              <span className="block text-2xl font-black leading-none text-white">
                ORBIT
              </span>
            </span>
          </NavLink>

          <button
            aria-label="Close sidebar"
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-stone-400 transition hover:border-amber-300/30 hover:text-amber-200 lg:hidden"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-8 text-xs font-black uppercase text-amber-300">
          Command Center
        </div>

        <nav aria-label="Main navigation" className="mt-3 grid gap-1.5">
          {navigation.map(({ label, to, icon: Icon }) => (
            <NavLink
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-bold transition ${
                  isActive
                    ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                    : "border-transparent text-stone-500 hover:border-white/10 hover:bg-white/5 hover:text-white"
                }`
              }
              end={to === "/"}
              key={to}
              onClick={onClose}
              to={to}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-red-300/15 bg-red-500/10 p-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-200">
            <span className="size-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.8)]" />
            Secure Channel
          </div>
          <p className="mt-2 text-xs leading-5 text-stone-500">
            Supabase auth, chat persistence, and Express API routes stay active.
          </p>
        </div>
      </aside>
    </>
  );
}
