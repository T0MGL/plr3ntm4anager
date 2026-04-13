import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { Logo } from "./common/Logo";
import { setLocale, type SupportedLocale } from "../i18n";

const NAV_LINKS = [
  { to: "/", labelKey: "nav.lofts" },
  { to: "/contacto", labelKey: "nav.contact" },
] as const;

const SOCIAL_LINKS = [
  { href: "https://instagram.com/parklofts", label: "Instagram" },
  { href: "https://facebook.com/ParkLoftspy", label: "Facebook" },
  { href: "https://x.com/park_lofts", label: "X / Twitter" },
] as const;

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function Layout() {
  return (
    <div className="min-h-screen bg-cream text-charcoal flex flex-col">
      <ScrollToTop />
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
  const { t } = useTranslation();

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
                {t(link.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <Link to="/contacto" className="pl-btn-primary">
            <span>{t("nav.reserve")}</span>
          </Link>
        </div>

        <Link
          to="/contacto"
          className="md:hidden text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-charcoal"
        >
          {t("nav.contact")}
        </Link>
      </div>
    </header>
  );
}

function LocaleSwitcher() {
  const { t, i18n } = useTranslation();
  const active = (i18n.language?.split("-")[0] ?? "en") as SupportedLocale;

  const handleChange = (next: SupportedLocale) => {
    if (next === active) return;
    setLocale(next);
  };

  return (
    <div
      role="group"
      aria-label={t("footer.localeSwitcher.label")}
      className="inline-flex items-center border border-cream/20 p-[2px]"
    >
      <LocalePill
        code="es"
        label={t("footer.localeSwitcher.spanish")}
        active={active === "es"}
        onClick={() => handleChange("es")}
      />
      <LocalePill
        code="en"
        label={t("footer.localeSwitcher.english")}
        active={active === "en"}
        onClick={() => handleChange("en")}
      />
    </div>
  );
}

function LocalePill({
  code,
  label,
  active,
  onClick,
}: {
  code: SupportedLocale;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Change language to ${code.toUpperCase()}`}
      className={`px-3 py-1 text-[0.625rem] font-medium uppercase tracking-[0.22em] transition-all duration-300 ${
        active
          ? "bg-gold text-charcoal"
          : "text-cream/50 hover:text-cream"
      }`}
    >
      {label}
    </button>
  );
}

function PLFooter() {
  const year = new Date().getFullYear();
  const { t } = useTranslation();

  return (
    <footer className="mt-0 border-t border-charcoal-700 bg-charcoal text-cream">
      <div className="pl-container pt-16 pb-12">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo variant="light" size="md" withBadge linkTo="/" />
            <p className="mt-7 max-w-sm text-sm leading-relaxed text-cream/60">
              {t("footer.tagline")}
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
              {t("footer.navigation")}
            </div>
            <ul className="mt-5 space-y-3 text-sm text-cream/75">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="pl-link transition-colors hover:text-gold">
                    {t(l.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-cream/40">
              {t("footer.contact")}
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
              <li className="text-cream/50">{t("footer.addressCity")}</li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-charcoal-700 pt-8 text-[0.6875rem] tracking-[0.02em] text-cream/40 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>
              &copy; {year} Park Lofts. {t("footer.rightsReserved")}
            </span>
            <span aria-hidden="true" className="text-cream/25">
              ·
            </span>
            <a
              href="https://thebrightidea.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-block text-cream/45 transition-colors hover:text-cream/80"
            >
              <span className="relative">
                {t("footer.developedBy")}{" "}
                <span className="font-medium relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-cream/30 via-gold to-cream/30 bg-clip-text text-transparent bg-[length:200%_100%] group-hover:animate-[pl-shimmer_1.5s_ease-in-out_infinite]">
                    Bright Idea
                  </span>
                </span>
              </span>
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 md:justify-end">
            <LocaleSwitcher />
            <span className="flex items-center gap-2">
              <span className="h-px w-5 bg-gold" />
              {t("footer.securePayments")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
