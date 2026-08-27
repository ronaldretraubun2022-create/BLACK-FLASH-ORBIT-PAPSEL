import { Bell, Menu, Search, Zap } from "lucide-react";
import { UserMenu } from "../auth/UserMenu";

export function Topbar({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050506]/85 backdrop-blur-xl">
      <div className="flex min-h-16 flex-wrap items-center gap-3 px-3 py-3 sm:px-5 lg:px-7">
        <button
          aria-label="Open navigation"
          className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-stone-300 transition hover:border-amber-300/30 hover:text-amber-200 lg:hidden"
          onClick={onMenuClick}
          type="button"
        >
          <Menu size={19} />
        </button>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-amber-300">
            ORBIT Intelligence
          </p>
          <h1 className="truncate text-sm font-black text-white sm:text-base">
            Newsroom Command Dashboard
          </h1>
        </div>

        <label className="order-last flex h-11 min-w-0 flex-1 basis-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-stone-500 transition focus-within:border-amber-300/30 sm:order-none sm:basis-auto">
          <Search size={17} />
          <input
            aria-label="Command search"
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-stone-100 outline-none placeholder:text-stone-600"
            placeholder="Search command, project, OSINT, report..."
            type="search"
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden h-11 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 text-xs font-black uppercase text-emerald-200 md:flex">
            <Zap size={15} />
            Live
          </div>
          <button
            aria-label="Notifications"
            className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-stone-400 transition hover:border-amber-300/30 hover:text-amber-200"
            type="button"
          >
            <Bell size={18} />
          </button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
