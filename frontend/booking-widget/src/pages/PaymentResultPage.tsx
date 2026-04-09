import { useEffect } from "react";
import { useSearchParams } from "react-router";

const PaymentResultPage = () => {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");

  useEffect(() => {
    // Notify parent window (BancardCheckout overlay) that payment completed
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "bancard_payment_complete", status: "success", bookingId },
        "*"
      );
    }
  }, [bookingId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", textAlign: "center", padding: "2rem" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 style={{ margin: 0, fontSize: 20, color: "#222" }}>Payment Successful</h2>
      <p style={{ color: "#666", marginTop: 8, fontSize: 14 }}>Your payment has been processed. You can close this window.</p>
    </div>
  );
};

export default PaymentResultPage;
