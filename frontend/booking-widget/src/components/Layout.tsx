import { Link, Outlet } from "react-router";

const NAV_LINKS = [
  { to: "/", label: "Lofts" },
  { to: "/contacto", label: "Contacto" },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <PLNavbar />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <PLFooter />
    </div>
  );
}

function PLNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone bg-cream/90 backdrop-blur-sm">
      <div className="pl-container flex h-20 items-center justify-between">
        <Link to="/" className="flex flex-col leading-none">
          <span className="font-display text-2xl tracking-widest text-charcoal">
            PARK LOFTS
          </span>
          <span className="mt-1 text-[0.625rem] uppercase tracking-[0.3em] text-gold">
            Paraguay
          </span>
        </Link>

        <nav className="flex items-center gap-10">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-xs font-medium uppercase tracking-[0.2em] text-charcoal-500 transition-colors duration-300 hover:text-charcoal"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function PLFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-stone bg-cream">
      <div className="pl-container py-16">
        <div className="grid gap-12 md:grid-cols-3">
          <div>
            <div className="font-display text-xl tracking-widest text-charcoal">
              PARK LOFTS
            </div>
            <div className="mt-1 text-[0.625rem] uppercase tracking-[0.3em] text-gold">
              Paraguay
            </div>
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-charcoal-500">
              Lofts de autor en el corazon de Asuncion. Estancias cortas con servicio atento y diseno pensado al detalle.
            </p>
          </div>

          <div>
            <div className="text-[0.625rem] uppercase tracking-[0.25em] text-charcoal-400">
              Navegacion
            </div>
            <ul className="mt-4 space-y-2 text-sm text-charcoal-500">
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="transition-colors hover:text-charcoal">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-[0.625rem] uppercase tracking-[0.25em] text-charcoal-400">
              Contacto
            </div>
            <ul className="mt-4 space-y-2 text-sm text-charcoal-500">
              <li>reservas@parkloftsparaguay.com</li>
              <li>+595 981 123 456</li>
              <li>Asuncion, Paraguay</li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-stone pt-8 text-xs text-charcoal-400 md:flex-row md:items-center md:justify-between">
          <span>&copy; {year} Park Lofts Paraguay. Todos los derechos reservados.</span>
          <span className="uppercase tracking-[0.2em]">Pagos seguros via Bancard</span>
        </div>
      </div>
    </footer>
  );
}
