import { StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  RouterProvider,
  createBrowserRouter,
  createMemoryRouter,
} from "react-router";
import { Toaster } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import "./index.css";
import "react-day-picker/dist/style.css";
import "./i18n";
import { isSupportedLocale } from "./i18n";
import { Layout } from "./components/Layout";
import UnitListingPage from "./pages/UnitListingPage";
import UnitDetailPage from "./pages/UnitDetailPage";
import ContactPage from "./pages/ContactPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import PaymentCancelledPage from "./pages/PaymentCancelledPage";

interface BWConfig {
  unitId?: string;
  mountId?: string;
  mode?: "full" | "embed";
}

declare global {
  interface Window {
    BW_CONFIG?: BWConfig;
  }
}

function LocaleHead() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const sync = () => {
      const raw = i18n.language?.split("-")[0] ?? "en";
      const locale = isSupportedLocale(raw) ? raw : "en";
      document.documentElement.lang = locale;
      document.title = t("meta.title");
      const description = document.querySelector(
        'meta[name="description"]',
      ) as HTMLMetaElement | null;
      if (description) description.content = t("meta.description");
    };
    sync();
    i18n.on("languageChanged", sync);
    return () => {
      i18n.off("languageChanged", sync);
    };
  }, [i18n, t]);

  return null;
}

function AppFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <span className="text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-charcoal-400">
        Park Lofts Rent
      </span>
    </div>
  );
}

const toaster = (
  <Toaster
    position="top-center"
    toastOptions={{
      style: {
        background: "#1A1A1A",
        color: "#F6F2EC",
        borderRadius: 0,
        border: "1px solid #C4A96B",
        fontSize: "0.8125rem",
        letterSpacing: "0.02em",
      },
    }}
  />
);

const routes = [
  {
    path: "/",
    element: (
      <>
        <LocaleHead />
        {toaster}
        <Layout />
      </>
    ),
    children: [
      { path: "/", element: <UnitListingPage /> },
      { path: "/contacto", element: <ContactPage /> },
      { path: "/:unitId", element: <UnitDetailPage /> },
      { path: "/payment/result", element: <PaymentResultPage /> },
      { path: "/payment/cancelled", element: <PaymentCancelledPage /> },
    ],
  },
];

const config = window.BW_CONFIG || {};
const rootId = config.mountId || "root";
const rootElement = document.getElementById(rootId);

if (!rootElement) {
  if (config.mode !== "embed") {
    console.warn(`Booking Widget: Target element #${rootId} not found.`);
  }
} else {
  const root = createRoot(rootElement);

  if (config.mode === "embed") {
    const initialPath = config.unitId ? `/${config.unitId}` : "/";
    const memoryRouter = createMemoryRouter(routes, {
      initialEntries: [initialPath],
    });

    root.render(
      <StrictMode>
        <Suspense fallback={<AppFallback />}>
          <RouterProvider router={memoryRouter} />
        </Suspense>
      </StrictMode>,
    );
  } else {
    const browserRouter = createBrowserRouter(routes);

    root.render(
      <StrictMode>
        <Suspense fallback={<AppFallback />}>
          <RouterProvider router={browserRouter} />
        </Suspense>
      </StrictMode>,
    );
  }
}
