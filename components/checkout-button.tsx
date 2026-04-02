"use client";

import { useState } from "react";
import { createPaymentAction } from "@/actions/payment.action";

export function CheckoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    const result = await createPaymentAction();

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    window.location.href = result.url!;
  };

  return (
    <div className="min-h-screen flex justify-center items-center flex-col">
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="p-2 border rounded-2xl"
      >
        {loading ? "Loading..." : "Payment Now"}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
