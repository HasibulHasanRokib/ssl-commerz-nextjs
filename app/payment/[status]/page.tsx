import Link from "next/link";
import { Suspense } from "react";

const statusConfig = {
  success: {
    title: "Payment success",
    description:
      "Your payment was successful. Thank you for your purchase. You will receive a confirmation email shortly.",
  },
  failed: {
    title: "Payment Failed",
    description:
      "We couldn't process your transaction. Please check your card details or balance.",
  },
  cancelled: {
    title: "Payment Cancelled",
    description:
      "You have cancelled the payment process. No charges were made to your account.",
  },
  default: {
    title: "Unknown Status",
    description: "Something went wrong while retrieving your payment status.",
  },
};

interface Props {
  params: Promise<{ status: string }>;
}
async function PageContent({ params }: Props) {
  const { status } = await params;

  const currentStatus =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.default;
  return (
    <div>
      <h2 className="mb-3 text-3xl font-extrabold tracking-tight">
        {currentStatus.title}
      </h2>

      <p className="text-muted-foreground mb-8 leading-relaxed">
        {currentStatus.description}
      </p>
      <Link href={"/"}>Back home</Link>
    </div>
  );
}
export default async function Page({ params }: Props) {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <div className="flex min-h-screen items-center justify-center">
          <PageContent params={params} />
        </div>
      </Suspense>
    </div>
  );
}
