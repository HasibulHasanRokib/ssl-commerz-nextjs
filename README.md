
# SSLCommerz Payment Gateway — Next.js Integration Guide

> Production-ready SSLCommerz integration for Next.js (App Router) with TypeScript, Prisma, and Server Actions.

---

## সূচিপত্র

- [Overview](#overview)
- [Payment Flow](#payment-flow)
- [প্রয়োজনীয় জিনিস](#প্রয়োজনীয়-জিনিস)
- [ইনস্টলেশন](#ইনস্টলেশন)
- [ফোল্ডার স্ট্রাকচার](#ফোল্ডার-স্ট্রাকচার)
- [Environment Variables](#environment-variables)
- [Prisma Schema](#prisma-schema)
- [TypeScript Types](#typescript-types)
- [SSLCommerz Config](#sslcommerz-config)
- [Environment Validation](#environment-validation)
- [Server Action](#server-action)
- [IPN Handler](#ipn-handler)
- [Frontend](#frontend)
- [Payment Status Pages](#payment-status-pages)
- [Production Checklist](#production-checklist)
- [Common Errors](#common-errors)
- [API Reference](#api-reference)

---

## Overview

**SSLCommerz** বাংলাদেশের প্রথম এবং সবচেয়ে বড় পেমেন্ট গেটওয়ে। এই গাইডে দেখানো হয়েছে কিভাবে Next.js App Router-এ SSLCommerz সম্পূর্ণ production-ready ভাবে ইন্টিগ্রেট করতে হয়।

**সমর্থিত পেমেন্ট পদ্ধতি:** Visa, MasterCard, AMEX, bKash, Nagad, Rocket, ইন্টারনেট ব্যাংকিং ইত্যাদি।

> ⚠️ `sslcommerz-lts` npm প্যাকেজ ব্যবহার করা হয়নি কারণ এটি Next.js-এর built-in `fetch`-এর সাথে conflict করে (`TypeError: fetch is not a function`)। পরিবর্তে সরাসরি SSLCommerz API-তে native `fetch` দিয়ে কল করা হয়েছে।

---

## Payment Flow

```
ব্যবহারকারী "পেমেন্ট করুন" বাটন চাপে
            ↓
createPaymentAction() [Server Action]
            ↓
সার্ভারে মূল্য calculate (ক্লায়েন্টের amount বিশ্বাস করা হয় না)
            ↓
SSLCommerz API-তে POST → GatewayPageURL পাওয়া যায়
            ↓
DB-তে Payment + Order সেভ (status: INITIATED)
            ↓
ব্যবহারকারী SSLCommerz পেজে রিডাইরেক্ট হয়
            ↓
ব্যবহারকারী পেমেন্ট করে
            ↓
SSLCommerz → POST /api/payment/ipn?status=success
            ↓
IPN Handler:
  ├── tran_id ও val_id ভ্যালিডেট করে
  ├── DB-তে Payment খোঁজে
  ├── ইতিমধ্যে PAID? → /payment/success (idempotent)
  ├── val_id দিয়ে SSLCommerz API-তে verify করে ✅
  └── সব DB আপডেট একটি Transaction-এ করে
            ↓
/payment/success অথবা /payment/failed
```

---

## প্রয়োজনীয় জিনিস

- Node.js 18+
- Next.js 14+ (App Router)
- TypeScript
- Prisma ORM
- SSLCommerz Sandbox বা Live অ্যাকাউন্ট

**অ্যাকাউন্ট তৈরি করুন:**
- Sandbox (টেস্টিং): https://developer.sslcommerz.com/registration/
- Live (Production): https://sslcommerz.com (sales টিমের সাথে যোগাযোগ করুন)

---

## ইনস্টলেশন

```bash
# অতিরিক্ত কোনো প্যাকেজ দরকার নেই
# Next.js-এর built-in fetch ব্যবহার করা হয়
```

---

## ফোল্ডার স্ট্রাকচার

```
app/
├── api/
│   └── payment/
│       └── ipn/
│           └── route.ts          ← SSLCommerz IPN কলব্যাক হ্যান্ডলার
├── payment/
│   └── [status]/
│       └── page.tsx              ← Success / Failed / Cancelled পেজ
actions/
│   └── payment.action.ts         ← পেমেন্ট শুরু করার Server Action
lib/
│   ├── ssl.ts                    ← SSLCommerz API wrapper
│   └── env.ts                    ← Environment variable validation
types/
│   └── sslcommerz.d.ts           ← TypeScript type declarations
components/
│   └── checkout-button.tsx       ← পেমেন্ট বাটন component
```

---

## Environment Variables

**.env.local**

```bash
# App
BASE_URL=http://localhost:3000

# SSLCommerz — Sandbox
SSL_STORE_ID=your_sandbox_store_id
SSL_STORE_PASSWORD=your_sandbox_password
SSL_IS_LIVE=false

# SSLCommerz — Production এ গেলে এগুলো পরিবর্তন করুন
# SSL_STORE_ID=your_live_store_id
# SSL_STORE_PASSWORD=your_live_password
# SSL_IS_LIVE=true
# BASE_URL=https://yourdomain.com
```

---

## Prisma Schema

```prisma
// prisma/schema.prisma

model Payment {
  id            String        @id @default(cuid())
  userId        String
  transactionId String        @unique
  amount        Float
  currency      String        @default("BDT")
  status        PaymentStatus @default(PENDING)
  paymentMethod String?
  gatewayData   Json?         // SSLCommerz-এর পুরো রেসপন্স সেভ রাখুন
  ipnVerified   Boolean       @default(false)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  user  User   @relation(fields: [userId], references: [id])
  order Order?
}

enum PaymentStatus {
  PENDING     // তৈরি হয়েছে
  INITIATED   // Gateway URL পাওয়া গেছে
  PAID        // সফলভাবে পেমেন্ট হয়েছে
  FAILED      // পেমেন্ট ব্যর্থ হয়েছে
  CANCELLED   // বাতিল করা হয়েছে
  REFUNDED    // রিফান্ড হয়েছে
}

model Order {
  id        String      @id @default(cuid())
  userId    String
  paymentId String      @unique
  status    OrderStatus @default(PENDING)
  metadata  Json?       // প্রোডাক্টের বিস্তারিত তথ্য
  createdAt DateTime    @default(now())

  user    User    @relation(fields: [userId], references: [id])
  payment Payment @relation(fields: [paymentId], references: [id])
}

enum OrderStatus {
  PENDING
  ACTIVE
  EXPIRED
  CANCELLED
}
```

---

## TypeScript Types

> `sslcommerz-lts` প্যাকেজ ব্যবহার না করায় নিজেই type declaration তৈরি করতে হবে।

**`types/sslcommerz.d.ts`**

```typescript
export type SSLPaymentData = {
  total_amount: number
  currency: 'BDT' | 'USD'
  tran_id: string
  success_url: string
  fail_url: string
  cancel_url: string
  product_name: string
  product_category: string
  product_profile: 'general' | 'digital-goods' | 'non-physical-goods'
  cus_name: string
  cus_email: string
  cus_phone: string
  cus_add1: string
  cus_city?: string
  cus_postcode?: string
  cus_country?: string
  cus_state?: string
  ship_name?: string
  ship_add1?: string
  ship_city?: string
  ship_postcode?: string
  ship_country?: string
}

export type SSLInitResponse = {
  status: string
  GatewayPageURL: string
  sessionkey: string
  failedreason?: string
}

export type SSLVerifyResponse = {
  status: string           // "VALID" হলে সফল
  tran_id: string
  val_id: string
  amount: string
  store_amount: string
  currency: string
  bank_tran_id: string
  card_type: string
  card_no: string
  currency_type: string
  currency_amount: string
  currency_rate: string
  risk_title: string
  risk_level: string
  APIConnect: string
  validated_on: string
}
```

---

## SSLCommerz Config

**`lib/ssl.ts`**

```typescript
import { env } from '@/lib/env'
import type { SSLPaymentData, SSLInitResponse, SSLVerifyResponse } from '@/types/sslcommerz'

// Sandbox ও Live এর আলাদা URL
const SSL_BASE_URL = env.SSL_IS_LIVE
  ? 'https://securepay.sslcommerz.com'
  : 'https://sandbox.sslcommerz.com'

// ─── পেমেন্ট শুরু করুন ───────────────────────────────────────────
export async function initiatePayment(data: SSLPaymentData): Promise<string> {
  const payload = new URLSearchParams({
    store_id: env.SSL_STORE_ID,
    store_passwd: env.SSL_STORE_PASSWORD,
    ...Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
  })

  const response = await fetch(`${SSL_BASE_URL}/gwprocess/v4/api.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
  })

  if (!response.ok) {
    throw new Error(`SSLCommerz HTTP error: ${response.status}`)
  }

  const result: SSLInitResponse = await response.json()

  if (result.status !== 'SUCCESS' || !result.GatewayPageURL) {
    console.error('SSLCommerz init failed:', result)
    throw new Error(result.failedreason ?? 'Gateway URL পাওয়া যায়নি')
  }

  return result.GatewayPageURL
}

// ─── পেমেন্ট যাচাই করুন (IPN-এ val_id দিয়ে) ───────────────────
export async function verifyPayment(
  valId: string,
  expectedAmount: number
): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      val_id: valId,
      store_id: env.SSL_STORE_ID,
      store_passwd: env.SSL_STORE_PASSWORD,
      format: 'json',
    })

    const response = await fetch(
      `${SSL_BASE_URL}/validator/api/validationserverAPI.php?${params.toString()}`,
      { method: 'GET' }
    )

    if (!response.ok) {
      console.error('SSLCommerz verify HTTP error:', response.status)
      return false
    }

    const result: SSLVerifyResponse = await response.json()

    const statusOk = result.status === 'VALID'
    // ১ টাকার কম পার্থক্য গ্রহণযোগ্য (floating point ইস্যু)
    const amountOk = Math.abs(Number(result.amount) - expectedAmount) < 1

    return statusOk && amountOk
  } catch (err) {
    console.error('Payment verification error:', err)
    return false
  }
}
```

---

## Environment Validation

**`lib/env.ts`**

```typescript
// অ্যাপ স্টার্টে সব environment variable চেক করে
// Runtime-এ হঠাৎ crash বন্ধ করে

const requiredEnvVars = [
  'BASE_URL',
  'SSL_STORE_ID',
  'SSL_STORE_PASSWORD',
  'SSL_IS_LIVE',
] as const

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`❌ Missing environment variable: ${key}`)
  }
}

export const env = {
  BASE_URL: process.env.BASE_URL!,
  SSL_STORE_ID: process.env.SSL_STORE_ID!,
  SSL_STORE_PASSWORD: process.env.SSL_STORE_PASSWORD!,
  SSL_IS_LIVE: process.env.SSL_IS_LIVE === 'true',
}
```

---

## Server Action

**`actions/payment.action.ts`**

```typescript
'use server'

import { z } from 'zod'
import { db } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { env } from '@/lib/env'
import { initiatePayment } from '@/lib/ssl'
import { getRequiredSession } from '@/lib/session'

// ✅ Client থেকে amount নেওয়া হচ্ছে না — সার্ভারে calculate হবে
const PaymentSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  couponCode: z.string().optional(),
})

// সার্ভারে DB থেকে মূল্য calculate করুন
async function calculateAmount(
  productId: string,
  quantity: number,
  couponCode?: string
) {
  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) throw new Error('Product not found')

  let amount = product.price * quantity

  if (couponCode) {
    const coupon = await db.coupon.findFirst({
      where: { code: couponCode, active: true },
    })
    if (coupon) {
      if (coupon.discountType === 'PERCENTAGE') {
        amount -= (amount * coupon.discountValue) / 100
      } else {
        amount -= coupon.discountValue
      }
    }
  }

  return { amount: Math.max(Math.round(amount), 0), product }
}

export async function createPaymentAction(
  input: z.infer<typeof PaymentSchema>
) {
  try {
    // ✅ Session থেকে user নিন
    const session = await getRequiredSession()

    const parsed = PaymentSchema.safeParse(input)
    if (!parsed.success) return { error: 'Invalid input' }

    const { productId, quantity, couponCode } = parsed.data

    // ✅ সার্ভারে মূল্য calculate
    const { amount, product } = await calculateAmount(
      productId,
      quantity,
      couponCode
    )

    const transactionId = `TXN-${randomUUID()}`
    const BASE_URL = env.BASE_URL

    // ✅ প্রথমে Gateway URL নিন
    let gatewayUrl: string
    try {
      gatewayUrl = await initiatePayment({
        total_amount: amount,
        currency: 'BDT',
        tran_id: transactionId,
        success_url: `${BASE_URL}/api/payment/ipn?status=success`,
        fail_url: `${BASE_URL}/api/payment/ipn?status=failed`,
        cancel_url: `${BASE_URL}/api/payment/ipn?status=cancelled`,
        product_name: product.name,
        product_category: product.category,
        product_profile: 'non-physical-goods',
        cus_name: session.user.name ?? 'Customer',
        cus_email: session.user.email!,
        cus_phone: session.user.phone ?? '01700000000',
        cus_add1: session.user.address ?? 'Dhaka, Bangladesh',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
      })
    } catch {
      return { error: 'পেমেন্ট গেটওয়ে সংযোগ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।' }
    }

    // ✅ Gateway URL পাওয়ার পরেই DB-তে সেভ করুন
    // (আগে সেভ করলে Gateway fail হলে orphan record থেকে যায়)
    await db.$transaction([
      db.payment.create({
        data: {
          userId: session.user.id,
          transactionId,
          amount,          // ✅ SSLCommerz-এ যা গেছে হুবহু সেটাই
          status: 'INITIATED',
        },
      }),
      db.order.create({
        data: {
          userId: session.user.id,
          payment: { connect: { transactionId } },
          metadata: { productId, quantity, couponCode },
        },
      }),
    ])

    return { url: gatewayUrl }
  } catch (err) {
    console.error('Payment action error:', err)
    return { error: 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।' }
  }
}
```

---

## IPN Handler

> SSLCommerz পেমেন্টের পরে এই endpoint-এ POST করে।

**`app/api/payment/ipn/route.ts`**

```typescript
import { db } from '@/lib/prisma'
import { verifyPayment } from '@/lib/ssl'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status')
  const form = await request.formData()

  const tranId = form.get('tran_id') as string
  const valId = form.get('val_id') as string       // ✅ যাচাইয়ের জন্য দরকার
  const paymentMethod = form.get('card_type') as string | null

  // ── বেসিক ভ্যালিডেশন ──────────────────────────────────────────
  if (!status || !tranId) redirect('/payment/failed')

  const allowedStatuses = ['success', 'failed', 'cancelled']
  if (!allowedStatuses.includes(status)) redirect('/payment/failed')

  // ── ব্যর্থ পেমেন্ট ─────────────────────────────────────────────
  if (status === 'failed') {
    await db.payment.updateMany({
      where: { transactionId: tranId, status: 'INITIATED' },
      data: { status: 'FAILED' },
    })
    redirect('/payment/failed')
  }

  // ── বাতিল পেমেন্ট ──────────────────────────────────────────────
  if (status === 'cancelled') {
    await db.payment.updateMany({
      where: { transactionId: tranId, status: 'INITIATED' },
      data: { status: 'CANCELLED' },
    })
    redirect('/payment/cancelled')
  }

  // ── সফল পেমেন্ট ────────────────────────────────────────────────
  if (status === 'success') {

    // val_id আছে কিনা চেক
    if (!valId) {
      console.error('Missing val_id in IPN for tran:', tranId)
      redirect('/payment/failed')
    }

    // ✅ ১. DB থেকে payment খুঁজুন
    const payment = await db.payment.findUnique({
      where: { transactionId: tranId },
    })
    if (!payment) redirect('/payment/failed')

    // ✅ ২. Idempotency — আগে প্রসেস হয়েছে কিনা চেক
    //    SSLCommerz IPN একাধিকবার পাঠাতে পারে
    if (payment!.status === 'PAID') redirect('/payment/success')

    // ✅ ৩. SSLCommerz API দিয়ে যাচাই (সবচেয়ে গুরুত্বপূর্ণ)
    //    val_id + validationserverAPI → status: "VALID" হলেই গ্রহণ
    const isVerified = await verifyPayment(valId, payment!.amount)

    if (!isVerified) {
      console.error(`Verification failed — tran: ${tranId}, val: ${valId}`)
      await db.payment.update({
        where: { transactionId: tranId },
        data: { status: 'FAILED' },
      })
      redirect('/payment/failed')
    }

    // ✅ ৪. সব DB আপডেট একটি Transaction-এ
    let processingError = false
    try {
      await db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { transactionId: tranId },
          data: {
            status: 'PAID',
            paymentMethod: paymentMethod ?? null,
            ipnVerified: true,
            gatewayData: Object.fromEntries(form.entries()), // সব gateway data সেভ রাখুন
          },
        })

        await tx.order.update({
          where: { paymentId: payment!.id },
          data: { status: 'ACTIVE' },
        })
      })
    } catch (err) {
      console.error('IPN DB transaction failed:', err)
      processingError = true
    }

    // ✅ ৫. redirect সবসময় try/catch এর বাইরে
    //    Next.js App Router-এ redirect() try/catch-এর ভেতরে কাজ করে না
    if (processingError) redirect('/payment/failed')
    redirect('/payment/success')
  }
}
```

---

## Frontend

**`components/checkout-button.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { createPaymentAction } from '@/actions/payment.action'

type Props = {
  productId: string
  quantity?: number
  couponCode?: string
}

export function CheckoutButton({ productId, quantity = 1, couponCode }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)

    const result = await createPaymentAction({ productId, quantity, couponCode })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // SSLCommerz গেটওয়েতে রিডাইরেক্ট
    window.location.href = result.url!
  }

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="rounded bg-blue-600 px-6 py-3 text-white disabled:opacity-50"
      >
        {loading ? 'অপেক্ষা করুন...' : 'পেমেন্ট করুন'}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
```

---

## Payment Status Pages

**`app/payment/[status]/page.tsx`**

```typescript
import Link from 'next/link'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

const statusConfig = {
  success: {
    icon: <CheckCircle className="h-20 w-20 text-green-500" />,
    title: 'পেমেন্ট সফল হয়েছে!',
    description: 'আপনার পেমেন্ট সম্পন্ন হয়েছে।',
    color: 'text-green-500',
  },
  failed: {
    icon: <XCircle className="h-20 w-20 text-red-500" />,
    title: 'পেমেন্ট ব্যর্থ হয়েছে',
    description: 'আপনার কার্ড বা ব্যালেন্স চেক করে আবার চেষ্টা করুন।',
    color: 'text-red-500',
  },
  cancelled: {
    icon: <AlertCircle className="h-20 w-20 text-amber-500" />,
    title: 'পেমেন্ট বাতিল হয়েছে',
    description: 'আপনি পেমেন্ট বাতিল করেছেন। কোনো চার্জ হয়নি।',
    color: 'text-amber-500',
  },
}

interface Props {
  params: Promise<{ status: string }>
}

export default async function PaymentStatusPage({ params }: Props) {
  const { status } = await params
  const config =
    statusConfig[status as keyof typeof statusConfig] ?? statusConfig.failed

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center p-10 text-center">
        {config.icon}
        <h2 className={`mt-6 text-3xl font-bold ${config.color}`}>
          {config.title}
        </h2>
        <p className="mt-3 text-gray-500">{config.description}</p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/dashboard"
            className="rounded bg-blue-600 px-6 py-3 text-white"
          >
            ড্যাশবোর্ডে যান
          </Link>
          {status !== 'success' && (
            <Link
              href="/checkout"
              className="rounded border px-6 py-3"
            >
              আবার চেষ্টা করুন
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

## Production Checklist

Production-এ যাওয়ার আগে এই সব নিশ্চিত করুন:

### Environment
- [ ] `SSL_IS_LIVE=true` সেট করা হয়েছে
- [ ] Live `SSL_STORE_ID` সেট করা হয়েছে (Sandbox টা না)
- [ ] Live `SSL_STORE_PASSWORD` সেট করা হয়েছে
- [ ] `BASE_URL` production domain দেওয়া হয়েছে (`https://yourdomain.com`)

### SSLCommerz Dashboard
- [ ] IPN URL রেজিস্টার করা হয়েছে: `https://yourdomain.com/api/payment/ipn`
  > SSLCommerz Dashboard → My Stores → IPN Settings
- [ ] Allowed IP address সেট করা হয়েছে (যদি দরকার হয়)

### Code
- [ ] `verifyPayment()` IPN handler-এ আছে
- [ ] Idempotency চেক আছে (`payment.status === 'PAID'` হলে skip করে)
- [ ] সব DB আপডেট একটি `$transaction`-এ আছে
- [ ] `redirect()` কোথাও `try/catch`-এর ভেতরে নেই
- [ ] Amount সার্ভারে DB থেকে calculate হচ্ছে (client থেকে আসছে না)
- [ ] Real user session থেকে `userId` নেওয়া হচ্ছে

### Infrastructure
- [ ] HTTPS চালু আছে (HTTP-তে SSLCommerz কাজ করে না)
- [ ] Server error log monitoring চালু আছে

---

## Common Errors

| Error | কারণ | সমাধান |
|---|---|---|
| `TypeError: fetch is not a function` | `sslcommerz-lts` npm package conflict | Package বাদ দিন, native `fetch` ব্যবহার করুন |
| `Verification failed` | `amount` mismatch বা ভুল `val_id` | DB-র amount ও SSLCommerz-এ পাঠানো amount একই রাখুন |
| `Payment not found` | ভুল `tran_id` বা DB-তে নেই | IPN-এর আগে DB-তে record তৈরি নিশ্চিত করুন |
| `redirect()` কাজ করছে না | `try/catch`-এর ভেতরে `redirect()` | `catch` block-এর বাইরে `redirect()` রাখুন |
| Gateway URL পাওয়া যাচ্ছে না | ভুল credentials বা sandbox/live mismatch | `.env` এর `SSL_IS_LIVE` চেক করুন |
| IPN আসছে না | IPN URL রেজিস্টার করা নেই | SSLCommerz Dashboard-এ IPN URL দিন |

---

## API Reference

### SSLCommerz Endpoints

| পরিবেশ | Payment Initiate | Payment Verify |
|---|---|---|
| **Sandbox** | `https://sandbox.sslcommerz.com/gwprocess/v4/api.php` | `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php` |
| **Live** | `https://securepay.sslcommerz.com/gwprocess/v4/api.php` | `https://securepay.sslcommerz.com/validator/api/validationserverAPI.php` |

### Verify API — দুইটা পদ্ধতির পার্থক্য

| | `validationserverAPI` | `merchantTransIDvalidationAPI` |
|---|---|---|
| **কখন ব্যবহার** | IPN-এ যাচাই | যেকোনো সময় status query |
| **Input** | `val_id` | `tran_id` |
| **Method** | GET | GET |
| **IPN-এ ব্যবহার** | ✅ সঠিক পদ্ধতি | ❌ ভুল পদ্ধতি |

### IPN-এ SSLCommerz যেসব field পাঠায়

| Field | মান | বিবরণ |
|---|---|---|
| `tran_id` | `TXN-xxx` | আপনার তৈরি transaction ID |
| `val_id` | `260402xxx` | SSLCommerz-এর validation ID |
| `amount` | `100.00` | পরিশোধিত পরিমাণ |
| `card_type` | `BKASH-BKash` | পেমেন্ট পদ্ধতি |
| `status` | `VALID` | পেমেন্টের status |
| `bank_tran_id` | `26040xxx` | ব্যাংকের transaction ID |
| `risk_level` | `0` | 0 = নিরাপদ, 1 = ঝুঁকিপূর্ণ |

---

## অফিসিয়াল রিসোর্স

- 📖 [SSLCommerz Developer Documentation](https://developer.sslcommerz.com/doc/v4/)
- 🧪 [Sandbox Registration](https://developer.sslcommerz.com/registration/)
- 💳 [Live Account](https://sslcommerz.com)
- 🐙 [Official GitHub](https://github.com/sslcommerz)

---

> তৈরি করেছেন: Hasibul Hasan Rokib | লাইসেন্স: MIT
