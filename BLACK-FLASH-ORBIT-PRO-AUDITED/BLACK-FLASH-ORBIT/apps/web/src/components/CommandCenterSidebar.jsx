import { useEffect, useState } from "react";
import {
  Archive,
  BrainCircuit,
  Bot,
  CloudLightning,
  Command,
  Globe2,
  GitBranch,
  LayoutDashboard,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const adminRoles = new Set(["admin", "owner", "super_admin"]);

const navigationItems = [
  ["Command", LayoutDashboard, "all", "#command"],
  ["AI Newsroom", Bot, "all", "/ai-newsroom"],
  ["Knowledge", BrainCircuit, "all", "/knowledge-base"],
  ["Intelligence", CloudLightning, "all", "/intelligence"],
  ["Agent Bridge", GitBranch, "admin", "/agent-bridge"],
  ["Web Builder", Globe2, "all", "/web-builder"],
  ["Media Intel", CloudLightning, "all", "#media-intel"],
  ["Security", ShieldCheck, "admin", "#security"],
  ["Archive", Archive, "all", "#archive"],
];

function isAdminRole(role) {
  return adminRoles.has(String(role || "").toLowerCase());
}

export function CommandCenterSidebar({ releaseState = [], userRole = "user" }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const visibleNavigationItems = navigationItems.filter(
    ([, , access]) => access === "all" || isAdminRole(userRole),
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      <button
        aria-controls="orbit-sidebar"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        className={`fixed bottom-4 left-4 z-40 grid size-11 place-items-center rounded-lg border border-white/10 bg-[#050506]/90 text-white shadow-2xl shadow-black/40 backdrop-blur-xl transition hover:border-amber-300/30 hover:text-amber-200 lg:hidden ${
          isOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        onClick={() => setIsOpen(true)}
        type="button">
        <Menu size={18} />
      </button>

      {isOpen && (
        <button
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          type="button"
        />
      )}

      <aside
        id="orbit-sidebar"
        aria-label="Primary navigation"
        className={`orbit-sidebar ${isOpen ? "is-open" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg border border-amber-300/30 bg-amber-300 text-black shadow-[0_0_40px_rgba(217,173,87,0.22)]">
            <Command size={22} />
          </div>

          <div className="min-w-0">
            <p className="orbit-kicker">BLACK FLASH</p>
            <h1 className="text-lg font-black leading-tight text-white">
              ORBIT
            </h1>
          </div>

          <button
            aria-label="Close sidebar"
            className="ml-auto grid size-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-stone-300 transition hover:border-amber-300/30 hover:text-amber-200 lg:hidden"
            onClick={closeSidebar}
            type="button">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-cyan-300/10 bg-cyan-300/5 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
            Access Role
          </p>
          <p className="mt-1 text-sm font-black uppercase text-white">
            {userRole}
          </p>
        </div>

        <nav className="mt-6 grid gap-2">
          {visibleNavigationItems.map(([label, Icon, , target], index) => {
            const isActive = target.startsWith("/")
              ? location.pathname === target
              : location.pathname === "/" && index === 0;
            const className = `orbit-nav-link ${isActive ? "is-active" : ""}`;
            const content = (
              <>
                <Icon size={18} />
                <span>{label}</span>
              </>
            );

            if (target.startsWith("/")) {
              return (
                <Link className={className} key={label} onClick={closeSidebar} to={target}>
                  {content}
                </Link>
              );
            }

            return (
              <a className={className} href={target} key={label} onClick={closeSidebar}>
                {content}
              </a>
            );
          })}
        </nav>

        <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="orbit-kicker">Release Channel</p>

          <div className="mt-3 grid gap-3">
            {releaseState.map((item) => (
              <div
                className="flex items-center justify-between gap-3"
                key={item.label}>
                <span className="text-xs font-semibold text-zinc-500">
                  {item.label}
                </span>
                <span className={`text-xs font-black ${item.tone}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
