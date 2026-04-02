import { env } from "./env";

const SSL_BASE_URL = env.SSL_IS_LIVE
  ? "https://securepay.sslcommerz.com"
  : "https://sandbox.sslcommerz.com";

export type SSLPaymentData = {
  total_amount: number;
  currency: "BDT" | "USD";
  tran_id: string;
  success_url: string;
  fail_url: string;
  cancel_url: string;
  product_name: string;
  product_category: string;
  product_profile: "general" | "digital-goods" | "non-physical-goods";
  cus_name: string;
  cus_email: string;
  cus_phone: string;
  cus_add1: string;
  cus_city?: string;
  cus_postcode?: string;
  cus_country?: string;
};

export async function initiatePayment(data: SSLPaymentData) {
  const payload = new URLSearchParams({
    store_id: env.SSL_STORE_ID,
    store_passwd: env.SSL_STORE_PASSWORD,
    ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
  });

  const response = await fetch(`${SSL_BASE_URL}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });

  if (!response.ok) {
    throw new Error(`SSLCommerz HTTP error: ${response.status}`);
  }

  const result = await response.json();

  if (result.status !== "SUCCESS" || !result.GatewayPageURL) {
    console.error("SSLCommerz init failed:", result);
    throw new Error(result.failedreason ?? "Gateway URL not received");
  }
  return result.GatewayPageURL;
}

export async function verifyPayment(valId: string, expectedAmount: number) {
  try {
    const params = new URLSearchParams({
      store_id: env.SSL_STORE_ID,
      store_passwd: env.SSL_STORE_PASSWORD,
      val_id: valId,
      format: "json",
    });

    const response = await fetch(
      `${SSL_BASE_URL}/validator/api/validationserverAPI.php?${params.toString()}`,
      { method: "GET" },
    );

    if (!response.ok) {
      console.error("SSLCommerz verify HTTP error:", response.status);
      return false;
    }

    const result = await response.json();
    console.log("SSLCommerz verify response:", result);

    const statusOk = result.status === "VALID";
    const amountOk =
      Math.abs(Number(result.currency_amount) - expectedAmount) < 1;

    return statusOk && amountOk;
  } catch (err) {
    console.error("Payment verification failed:", err);
    return false;
  }
}
