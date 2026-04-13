import { NavLink } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";
import type { LayoutNavItem } from "./types";

interface SidebarProps {
  items: LayoutNavItem[];
  collapsed?: boolean;
  mobile?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onSignOut: () => void;
}

export default function Sidebar({
  items,
  collapsed = false,
  onNavigate,
  onSignOut,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col gap-3 px-4 py-5">
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <div
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-xs font-bold tracking-[0.08em] text-white"
            aria-hidden="true"
          >
            AB
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <p className="m-0 text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">
                Airbnb Inspired
              </p>
              <h1 className="m-0 text-[15px] font-semibold text-[#111827]">
                Hosting Admin
              </h1>
            </div>
          )}
        </div>

        <div className="-mx-4 h-px bg-[#E5E7EB]" aria-hidden="true" />
      </div>

      <nav className="grid gap-1.5 px-1" aria-label="Main navigation">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.path === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  "relative flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#EFF6FF] text-[#1D4ED8]"
                    : "text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]",
                ].join(" ")
              }
              title={collapsed ? item.label : undefined}
            >
              <span
                className="absolute -left-[7px] top-2 bottom-2 w-[3px] rounded-full bg-[#2563EB] opacity-0 transition-opacity [.active_&]:opacity-100"
                aria-hidden="true"
              />
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {!collapsed && (
                <span className="whitespace-nowrap">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto px-1 pt-1">
        <button
          type="button"
          className="inline-flex min-h-11 w-full items-center justify-start gap-2.5 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F3F4F6]"
          onClick={onSignOut}
        >
          <FiLogOut aria-hidden="true" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );
}
