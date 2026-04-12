import { Link, Outlet, useLocation } from "react-router";
import { Logo } from "./common/Logo";

const NAV_LINKS = [
  { to: "/", label: "Lofts" },
  { to: "/contacto", label: "Contacto" },
];

const SOCIAL_LINKS = [
  { href: "https://instagram.com/parklofts", label: "Instagram" },
  { href: "https://facebook.com/ParkLoftspy", label: "Facebook" },
  { href: "https://x.com/park_lofts", label: "X / Twitter" },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-cream text-charcoal flex flex-col">
      <PLNavbar />
      <main className="flex-1 w-full pt-20 md:pt-24">
        <Outlet />
      </main>
      <PLFooter />
    </div>
  );
}

function PLNavbar() {
  const location = useLocation();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-stone/60 bg-cream/95 backdrop-blur-md">
      <div className="pl-container flex h-20 items-center justify-between md:h-24">
        <Logo variant="dark" size="md" withBadge linkTo="/" />

        <nav className="hidden items-center gap-10 md:flex">
          {NAV_LINKS.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`pl-link text-[0.6875rem] font-medium uppercase tracking-[0.22em] transition-colors duration-300 ${
                  active ? "text-charcoal" : "text-charcoal-500 hover:text-charcoal"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <Link to="/contacto" className="pl-btn-primary">
            <span>Reservar</span>
          </Link>
        </div>

        <Link
          to="/contacto"
          className="md:hidden text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-charcoal"
        >
          Contacto
        </Link>
      </div>
    </header>
  );
}

function PLFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-0 border-t border-charcoal-700 bg-charcoal text-cream">
      <div className="pl-container pt-16 pb-12">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo variant="light" size="md" withBadge linkTo="/" />
            <p className="mt-7 max-w-sm text-sm leading-relaxed text-cream/60">
              Estancias cortas en lofts de autor. Operadas directamente por Park Lofts, el
              desarrollador detras de los edificios mas reconocidos de Asuncion.
            </p>
            <div className="mt-7 flex items-center gap-4">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center border border-cream/25 text-cream/70 transition-all duration-400 hover:border-gold hover:text-gold"
                  aria-label={s.label}
                >
                  <span className="text-[0.625rem] font-medium uppercase tracking-[0.15em]">
                    {s.label[0]}
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-cream/40">
              Navegacion
            </div>
            <ul className="mt-5 space-y-3 text-sm text-cream/75">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="pl-link transition-colors hover:text-gold">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-cream/40">
              Contacto
            </div>
            <ul className="mt-5 space-y-3 text-sm text-cream/75">
              <li>
                <a
                  href="mailto:reservas@parkloftsparaguay.com"
                  className="pl-link transition-colors hover:text-gold"
                >
                  reservas@parkloftsparaguay.com
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/595981587588"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pl-link transition-colors hover:text-gold"
                >
                  +595 981 587 588
                </a>
              </li>
              <li className="text-cream/50">Asuncion, Paraguay</li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-charcoal-700 pt-8 text-[0.6875rem] uppercase tracking-[0.2em] text-cream/40 md:flex-row md:items-center md:justify-between">
          <span>&copy; {year}. Todos los derechos reservados.</span>
          <span className="flex items-center gap-2">
            <span className="h-px w-5 bg-gold" />
            Pagos seguros via Bancard
          </span>
        </div>
      </div>
    </footer>
  );
}
