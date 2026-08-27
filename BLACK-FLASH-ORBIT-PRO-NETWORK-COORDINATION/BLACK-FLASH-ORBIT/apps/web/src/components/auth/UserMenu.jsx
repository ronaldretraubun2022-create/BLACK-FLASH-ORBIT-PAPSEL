import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useProfile } from "../../hooks/useProfile";

function getInitials(email) {
  return email?.slice(0, 2).toUpperCase() || "BF";
}

export function UserMenu() {
  const { signOut, user } = useAuth();
  const { isLoading, profile } = useProfile();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const email = profile?.email || user?.email || "Authenticated User";
  const role = profile?.role || "user";

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      await signOut();
      navigate("/login", { replace: true });
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1.5 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/5"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="flex size-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-[10px] font-black text-cyan-200">
          {getInitials(email)}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-40 truncate text-xs font-bold text-slate-200">
            {isLoading ? "Loading profile..." : email}
          </span>
          <span className="mt-0.5 block w-fit rounded-full border border-cyan-300/20 bg-cyan-300/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-300">
            {isLoading ? "syncing" : role}
          </span>
        </span>
        <ChevronDown
          className={`hidden text-slate-500 transition sm:block ${
            isOpen ? "rotate-180" : ""
          }`}
          size={15}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-white/10 bg-[#09101c] p-2 shadow-2xl shadow-black/50"
          role="menu"
        >
          <div className="border-b border-white/10 px-3 py-3">
            <div className="flex items-center gap-2 text-xs font-black tracking-[0.16em] text-cyan-300">
              <UserRound size={15} />
              USER PROFILE
            </div>
            <p className="mt-2 truncate text-sm font-bold text-slate-200">
              {email}
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              Role: {role}
            </p>
          </div>

          <button
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-400 transition hover:bg-rose-300/10 hover:text-rose-200 disabled:opacity-50"
            disabled={isSigningOut}
            onClick={handleLogout}
            role="menuitem"
            type="button"
          >
            <LogOut size={16} />
            {isSigningOut ? "Keluar..." : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}
