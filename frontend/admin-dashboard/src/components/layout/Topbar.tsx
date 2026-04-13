import { FiGrid } from "react-icons/fi";

interface TopbarProps {
  userEmail?: string;
  onMenuClick: () => void;
  onSignOut: () => void;
}

export default function Topbar({ userEmail, onMenuClick, onSignOut }: TopbarProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E7EB] bg-white/95 px-4 py-3 backdrop-blur sm:px-6"
      role="banner"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#374151] lg:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <FiGrid className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        <div>
          <p className="m-0 text-[11px] uppercase tracking-[0.12em] text-[#6B7280]">Park Lofts</p>
          <h2 className="m-0 text-lg font-semibold text-[#111827] sm:text-[20px]">Rent Admin</h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#F3F4F6]"
          onClick={onSignOut}
          aria-label={userEmail ? `Logout ${userEmail}` : "Logout"}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
