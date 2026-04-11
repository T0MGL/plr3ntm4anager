import { Link, Outlet, useLocation } from "react-router";
import { useEffect, useMemo, useState } from "react";
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
  const location = useLocation();
  // Home renders the hero edge-to-edge behind the fixed header; every other
  // route needs a top offset equal to the header height so the content isn't
  // stuck under the navbar.
  const needsOffset = useMemo(() => location.pathname !== "/", [location.pathname]);

  return (
    <div className="min-h-screen bg-cream text-charcoal flex flex-col">
      <PLNavbar />
      <main className={`flex-1 w-full ${needsOffset ? "pt-20 md:pt-24" : ""}`}>
        <Outlet />
      </main>
      <PLFooter />
    </div>
  );
}

function PLNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Only the homepage has a transparent-over-hero navbar. On every other
  // route the navbar is cream-over-cream because there is no dark hero
  // underneath it, and inverting the colors would create a floating
  // unreadable state.
  const overHero = isHome && !scrolled;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        overHero
          ? "bg-transparent"
          : "bg-cream/92 backdrop-blur-md border-b border-stone/60"
      }`}
    >
      <div className="pl-container flex h-20 items-center justify-between md:h-24">
        <Logo
          variant={overHero ? "light" : "dark"}
          size="md"
          withBadge
          linkTo="/"
        />

        <nav className="hidden items-center gap-10 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`pl-link text-[0.6875rem] font-medium uppercase tracking-[0.22em] transition-colors duration-300 ${
                overHero
                  ? "text-cream/85 hover:text-cream"
                  : "text-charcoal-500 hover:text-charcoal"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link
            to="/contacto"
            className={overHero ? "pl-btn-light" : "pl-btn-primary"}
          >
            <span>Reservar</span>
          </Link>
        </div>

        {/* Mobile: a single CTA to the lofts list, nav collapses to primary */}
        <Link
          to="/"
          className={`md:hidden text-[0.6875rem] font-medium uppercase tracking-[0.22em] transition-colors ${
            overHero ? "text-cream" : "text-charcoal"
          }`}
        >
          Menu
        </Link>
      </div>
    </header>
  );
}

function PLFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-0 border-t border-charcoal-700 bg-charcoal text-cream">
      <div className="pl-container pt-20 pb-14">
        <div className="grid gap-14 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo variant="light" size="md" withBadge linkTo="/" />
            <p className="mt-8 max-w-sm text-sm leading-relaxed text-cream/60">
              Estancias cortas en lofts de autor. Operadas directamente por Park Lofts, el
              desarrollador detras de los edificios mas reconocidos de Asuncion.
            </p>

            <div className="mt-8 flex items-center gap-4">
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

          <div className="md:col-span-2">
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

          <div className="md:col-span-2">
            <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-cream/40">
              Park Lofts
            </div>
            <ul className="mt-5 space-y-3 text-sm text-cream/75">
              <li>
                <a
                  href="https://www.parkloftsparaguay.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pl-link transition-colors hover:text-gold"
                >
                  Sitio principal
                </a>
              </li>
              <li>
                <a
                  href="https://www.parkloftsparaguay.com/projekte/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pl-link transition-colors hover:text-gold"
                >
                  Inversion
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
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

        {/* Tagline */}
        <div className="mt-20 border-t border-charcoal-700 pt-12">
          <p className="font-display text-2xl italic leading-tight text-cream/55 md:text-4xl">
            Lofts de autor. Estadia sin intermediarios. Operado por Park Lofts.
          </p>
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col gap-4 border-t border-charcoal-700 pt-8 text-[0.6875rem] uppercase tracking-[0.2em] text-cream/40 md:flex-row md:items-center md:justify-between">
          <span>&copy; {year} Park Lofts Rent. Todos los derechos reservados.</span>
          <span className="flex items-center gap-2">
            <span className="h-px w-5 bg-gold" />
            Pagos seguros via Bancard
          </span>
        </div>
      </div>
    </footer>
  );
}
