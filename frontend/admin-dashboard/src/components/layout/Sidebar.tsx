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
    <div className="flex h-full flex-col gap-8 px-6 py-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <span className="font-display text-2xl tracking-widest text-charcoal">
            PARK LOFTS
          </span>
          <span className="text-[0.5625rem] uppercase tracking-[0.3em] text-gold">
            Consola de operaciones
          </span>
        </div>

        <div className="h-px bg-stone" aria-hidden="true" />
      </div>

      <nav className="grid gap-1" aria-label="Main navigation">
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
                  "group relative flex min-h-10 items-center gap-3 px-3 py-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.18em] transition-all duration-300",
                  isActive
                    ? "bg-cream-50 text-charcoal"
                    : "text-charcoal-400 hover:text-charcoal",
                ].join(" ")
              }
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-0 top-2 bottom-2 w-[2px] transition-opacity duration-300 ${
                      isActive ? "bg-gold opacity-100" : "bg-gold opacity-0"
                    }`}
                    aria-hidden="true"
                  />
                  <Icon
                    className="h-[15px] w-[15px] shrink-0"
                    aria-hidden="true"
                  />
                  {!collapsed && (
                    <span className="whitespace-nowrap">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <div className="mb-4 h-px bg-stone" />
        <button
          type="button"
          className="inline-flex min-h-10 w-full items-center justify-start gap-3 border border-charcoal px-4 text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-charcoal transition-all duration-300 hover:bg-charcoal hover:text-cream"
          onClick={onSignOut}
        >
          <FiLogOut aria-hidden="true" className="h-[14px] w-[14px]" />
          {!collapsed && <span>Cerrar sesion</span>}
        </button>
      </div>
    </div>
  );
}
