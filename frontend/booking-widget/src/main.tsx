import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  RouterProvider,
  createBrowserRouter,
  createMemoryRouter,
} from "react-router";
import { Toaster } from "react-hot-toast";
import "./index.css";
import "react-day-picker/dist/style.css";
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
        <RouterProvider router={memoryRouter} />
      </StrictMode>,
    );
  } else {
    const browserRouter = createBrowserRouter(routes);

    root.render(
      <StrictMode>
        <RouterProvider router={browserRouter} />
      </StrictMode>,
    );
  }
}
