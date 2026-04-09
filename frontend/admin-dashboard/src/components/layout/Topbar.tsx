import { FiMenu } from "react-icons/fi";

interface TopbarProps {
  userEmail?: string;
  onMenuClick: () => void;
  onSignOut: () => void;
}

export default function Topbar({ userEmail, onMenuClick, onSignOut }: TopbarProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-stone bg-cream/90 px-5 py-4 backdrop-blur sm:px-8"
      role="banner"
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center border border-charcoal/20 text-charcoal transition-colors hover:border-charcoal lg:hidden"
          onClick={onMenuClick}
          aria-label="Abrir menu de navegacion"
        >
          <FiMenu className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        <div>
          <p className="m-0 text-[0.5625rem] uppercase tracking-[0.25em] text-gold">
            Panel
          </p>
          <h2 className="m-0 mt-1 font-display text-xl text-charcoal md:text-2xl">
            Operaciones Park Lofts
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {userEmail ? (
          <span className="hidden text-xs text-charcoal-500 md:inline">
            {userEmail}
          </span>
        ) : null}
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center border border-charcoal px-5 text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-charcoal transition-all duration-300 hover:bg-charcoal hover:text-cream"
          onClick={onSignOut}
          aria-label={userEmail ? `Cerrar sesion de ${userEmail}` : "Cerrar sesion"}
        >
          Salir
        </button>
      </div>
    </header>
  );
}
