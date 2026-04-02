import { db } from "@/lib/prisma";
import { verifyPayment } from "@/lib/ssl";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const form = await request.formData();

  const tranId = form.get("tran_id") as string;
  const valId = form.get("val_id") as string;
  const paymentMethod = form.get("card_type") as string | null;

  if (!status || !tranId) {
    redirect("/payment/failed");
  }

  const allowedStatuses = ["success", "failed", "cancelled"];
  if (!allowedStatuses.includes(status)) {
    redirect("/payment/failed");
  }

  if (status === "failed") {
    await db.payment.updateMany({
      where: { transactionId: tranId, status: "INITIATED" },
      data: { status: "FAILED" },
    });
    redirect("/payment/failed");
  }

  if (status === "cancelled") {
    await db.payment.updateMany({
      where: { transactionId: tranId, status: "INITIATED" },
      data: { status: "CANCELLED" },
    });
    redirect("/payment/cancelled");
  }

  if (status === "success") {
    if (!valId) {
      console.error("Missing val_id in IPN");
      redirect("/payment/failed");
    }
    const payment = await db.payment.findUnique({
      where: { transactionId: tranId },
    });

    if (!payment) redirect("/payment/failed");

    if (payment!.status === "PAID") {
      redirect("/payment/success");
    }

    const isVerified = await verifyPayment(valId, payment!.amount);

    if (!isVerified) {
      console.error(`Verification failed — tran: ${tranId}, val: ${valId}`);
      await db.payment.update({
        where: { transactionId: tranId },
        data: { status: "FAILED" },
      });
      redirect("/payment/failed");
    }

    let processingError = false;

    try {
      await db.$transaction(async (tx) => {
        const gatewayData: Record<string, string> = {};
        for (const [key, value] of form.entries()) {
          if (typeof value === "string") {
            gatewayData[key] = value;
          }
        }

        await tx.payment.update({
          where: { transactionId: tranId },
          data: {
            status: "PAID",
            paymentMethod: paymentMethod ?? null,
            ipnVerified: true,
            gatewayData,
          },
        });
      });
    } catch (err) {
      console.error("IPN transaction failed:", err);
      processingError = true;
    }

    if (processingError) redirect("/payment/failed");
    redirect("/payment/success");
  }
}
