import { useEffect } from "react";
import { useSearchParams } from "react-router";

const PaymentCancelledPage = () => {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");

  useEffect(() => {
    // Notify parent window (BancardCheckout overlay) that payment was cancelled
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "bancard_payment_complete", status: "cancelled", bookingId },
        "*"
      );
    }
  }, [bookingId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", textAlign: "center", padding: "2rem" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FFF3E0", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <h2 style={{ margin: 0, fontSize: 20, color: "#222" }}>Payment Cancelled</h2>
      <p style={{ color: "#666", marginTop: 8, fontSize: 14 }}>The payment was not completed. You can close this window and try again.</p>
    </div>
  );
};

export default PaymentCancelledPage;
