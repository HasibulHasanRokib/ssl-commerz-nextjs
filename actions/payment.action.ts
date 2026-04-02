"use server";

import { db } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { env } from "@/lib/env";
import { initiatePayment } from "@/lib/ssl";

export async function createPaymentAction() {
  try {
    const transactionId = `TXN-${randomUUID()}`;
    const BASE_URL = env.BASE_URL;

    let gatewayUrl: string;

    try {
      gatewayUrl = await initiatePayment({
        total_amount: 100,
        currency: "BDT",
        tran_id: transactionId,
        success_url: `${BASE_URL}/api/payment/ipn?status=success`,
        fail_url: `${BASE_URL}/api/payment/ipn?status=failed`,
        cancel_url: `${BASE_URL}/api/payment/ipn?status=cancelled`,
        product_name: "Product",
        product_category: "category",
        product_profile: "non-physical-goods",
        cus_name: "Hasibul Hasan Rokib",
        cus_email: "rokib4000@gmail.com",
        cus_phone: "01839027207",
        cus_add1: "Gazipur",
        cus_city: "Dhaka",
        cus_country: "Bangladesh",
      });
    } catch (err) {
      console.error(err);
      return { error: "Something went wrong." };
    }

    await db.$transaction([
      db.payment.create({
        data: {
          userId: "1",
          transactionId,
          amount: 100,
          status: "INITIATED",
        },
      }),
    ]);

    return { url: gatewayUrl };
  } catch (err) {
    console.error("Payment action error:", err);
    return {
      error: "An unexpected error occurred.",
    };
  }
}
