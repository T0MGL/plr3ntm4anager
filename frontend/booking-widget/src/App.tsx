import { createBrowserRouter } from "react-router";
import { Toaster } from "react-hot-toast";
import "react-day-picker/dist/style.css";
import { Layout } from "./components/Layout";
import UnitListingPage from "./pages/UnitListingPage";
import UnitDetailPage from "./pages/UnitDetailPage";
import ContactPage from "./pages/ContactPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import PaymentCancelledPage from "./pages/PaymentCancelledPage";

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: (
      <>
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
]);
