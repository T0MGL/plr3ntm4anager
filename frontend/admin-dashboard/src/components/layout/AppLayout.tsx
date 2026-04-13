import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import type { LayoutNavItem } from "./types";

interface AppLayoutProps {
  items: LayoutNavItem[];
  userEmail?: string;
  onSignOut: () => void;
  children: ReactNode;
}

export default function AppLayout({ items, userEmail, onSignOut, children }: AppLayoutProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.classList.add("sidebar-open");
    } else {
      document.body.classList.remove("sidebar-open");
    }

    return () => document.body.classList.remove("sidebar-open");
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[272px] border-r border-[#E5E7EB] bg-white lg:block"
        aria-label="Sidebar"
      >
        <Sidebar items={items} onSignOut={onSignOut} />
      </aside>

      <main className="min-h-screen lg:ml-[272px]">
        <Topbar
          userEmail={userEmail}
          onMenuClick={() => setMobileOpen(true)}
          onSignOut={onSignOut}
        />

        <section className="min-h-[calc(100vh-66px)] p-4 sm:p-6">{children}</section>
      </main>

      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity lg:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-[60] w-[272px] border-r border-[#E5E7EB] bg-white transition-transform lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Mobile navigation"
      >
        <Sidebar items={items} mobile onNavigate={() => setMobileOpen(false)} onSignOut={onSignOut} />
      </aside>
    </div>
  );
}
