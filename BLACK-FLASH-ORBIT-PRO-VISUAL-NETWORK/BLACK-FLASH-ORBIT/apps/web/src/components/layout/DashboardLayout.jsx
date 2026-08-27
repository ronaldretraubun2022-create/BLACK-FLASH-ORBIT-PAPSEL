import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#050506] text-stone-100">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="lg:pl-72">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="px-3 py-4 sm:px-5 lg:px-7 lg:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
