This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

```

---

## পুরো ফ্লো একনজরে
```

ব্যবহারকারী "পেমেন্ট করুন" চাপে
↓
createPaymentAction() (Server Action)
↓
সার্ভারে মূল্য হিসাব (ক্লায়েন্টের amount বাদ)
↓
SSLCommerz.init() → GatewayPageURL পাওয়া
↓
ডেটাবেজে Payment + Order সেভ (status: INITIATED)
↓
ব্যবহারকারী SSLCommerz পেজে যায়
↓
পেমেন্ট করে
↓
SSLCommerz → POST /api/payment/ipn?status=success
↓
IPN Handler:
├── tran_id ও status ভ্যালিডেট
├── ডেটাবেজে Payment খোঁজা
├── ইতিমধ্যে PAID? → /payment/success (idempotent)
├── SSLCommerz API দিয়ে যাচাই ✅
└── সব আপডেট একটি DB Transaction-এ
↓
/payment/success বা /payment/failed

```

---

## প্রোডাকশনে যাওয়ার আগে চেকলিস্ট
```

✅ SSL_IS_LIVE=true সেট করা
✅ Live Store ID ও Password সেট করা
✅ BASE_URL প্রোডাকশন ডোমেইন দেওয়া
✅ IPN URL SSLCommerz ড্যাশবোর্ডে রেজিস্টার করা
→ https://yourdomain.com/api/payment/ipn
✅ HTTPS বাধ্যতামূলক (HTTP-তে SSLCommerz কাজ করে না)
✅ verifyPayment() অবশ্যই আছে
✅ Idempotency চেক আছে
✅ সব DB আপডেট একটি Transaction-এ
✅ redirect() কখনো catch-এর ভেতরে নেই
✅ Amount সার্ভারে হিসাব হচ্ছে
