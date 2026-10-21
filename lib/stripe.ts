/**
 * Stripe Payment Processing — Production Implementation
 * SDK: stripe@14.x
 *
 * Required ENV:
 *   STRIPE_SECRET_KEY
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 *   STRIPE_WEBHOOK_SECRET
 */

import Stripe from 'stripe'
import { logger } from './logger'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required')
}

// Singleton Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript:  true,
  maxNetworkRetries: 3,
  telemetry:   false,
})

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreatePaymentIntentParams {
  amount:         number           // in minor currency units (pence/cents)
  currency:       string           // ISO 4217: 'gbp', 'usd', 'pkr'
  customerId?:    string           // Stripe customer ID
  metadata?:      Record<string, string>
  description?:   string
  captureMethod?: 'automatic' | 'manual'
  receiptEmail?:  string
}

export interface RefundParams {
  paymentIntentId: string
  amount?:         number    // partial refund if specified
  reason?:         Stripe.RefundCreateParams.Reason
  metadata?:       Record<string, string>
}

export interface StripeCustomerParams {
  email:    string
  name:     string
  phone?:   string
  metadata?: Record<string, string>
}

// ── Payment Intents ──────────────────────────────────────────────────────────

/**
 * Create a PaymentIntent.
 * Returns clientSecret for frontend Stripe.js to complete payment.
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const amountInMinorUnits = Math.round(params.amount * 100)

  if (amountInMinorUnits < 50) {
    throw new Error(`Amount too small: minimum is 0.50 ${params.currency.toUpperCase()}`)
  }

  const intent = await stripe.paymentIntents.create({
    amount:          amountInMinorUnits,
    currency:        params.currency.toLowerCase(),
    customer:        params.customerId,
    description:     params.description,
    receipt_email:   params.receiptEmail,
    capture_method:  params.captureMethod ?? 'automatic',
    metadata:        params.metadata ?? {},
    automatic_payment_methods: { enabled: true },
  })

  logger.info('Stripe PaymentIntent created', {
    id:       intent.id,
    amount:   intent.amount,
    currency: intent.currency,
    status:   intent.status,
  })

  return {
    clientSecret:    intent.client_secret!,
    paymentIntentId: intent.id,
  }
}

/**
 * Retrieve a PaymentIntent — verify payment status.
 */
export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId)
}

/**
 * Confirm payment was captured (for post-payment verification).
 */
export async function verifyPaymentSucceeded(
  paymentIntentId: string
): Promise<boolean> {
  const intent = await getPaymentIntent(paymentIntentId)
  return intent.status === 'succeeded'
}

// ── Refunds ──────────────────────────────────────────────────────────────────

/**
 * Issue a full or partial refund.
 * Partial refund: specify amount in major currency units.
 */
export async function createRefund(params: RefundParams): Promise<Stripe.Refund> {
  const intent = await getPaymentIntent(params.paymentIntentId)

  if (intent.status !== 'succeeded') {
    throw new Error(`Cannot refund payment in status: ${intent.status}`)
  }

  const refundAmount = params.amount
    ? Math.round(params.amount * 100)
    : undefined

  const refund = await stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount:         refundAmount,
    reason:         params.reason ?? 'requested_by_customer',
    metadata:       params.metadata ?? {},
  })

  logger.info('Stripe refund created', {
    id:              refund.id,
    paymentIntentId: params.paymentIntentId,
    amount:          refund.amount,
    status:          refund.status,
  })

  return refund
}

// ── Customers ────────────────────────────────────────────────────────────────

export async function createStripeCustomer(
  params: StripeCustomerParams
): Promise<Stripe.Customer> {
  const customer = await stripe.customers.create({
    email:    params.email,
    name:     params.name,
    phone:    params.phone,
    metadata: params.metadata ?? {},
  })

  logger.info('Stripe customer created', { id: customer.id, email: customer.email })
  return customer
}

export async function updateStripeCustomer(
  customerId: string,
  params:     Partial<StripeCustomerParams>
): Promise<Stripe.Customer> {
  return stripe.customers.update(customerId, {
    email:    params.email,
    name:     params.name,
    phone:    params.phone,
    metadata: params.metadata,
  })
}

// ── Subscriptions (Memberships) ───────────────────────────────────────────────

export async function createSubscription(params: {
  customerId: string
  priceId:    string
  trialDays?: number
  metadata?:  Record<string, string>
}): Promise<Stripe.Subscription> {
  const sub = await stripe.subscriptions.create({
    customer:          params.customerId,
    items:             [{ price: params.priceId }],
    trial_period_days: params.trialDays,
    payment_behavior:  'default_incomplete',
    payment_settings:  { save_default_payment_method: 'on_subscription' },
    expand:            ['latest_invoice.payment_intent'],
    metadata:          params.metadata ?? {},
  })

  logger.info('Stripe subscription created', { id: sub.id, customerId: params.customerId })
  return sub
}

export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const sub = await stripe.subscriptions.cancel(subscriptionId)
  logger.info('Stripe subscription cancelled', { id: subscriptionId })
  return sub
}

// ── Webhook Validation ────────────────────────────────────────────────────────

/**
 * Validate Stripe webhook signature and construct event.
 * MUST be called with raw request body (Buffer), not parsed JSON.
 */
export function constructWebhookEvent(
  rawBody:   Buffer | string,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert amount from minor units (pence/cents) to major units.
 */
export function fromMinorUnits(amount: number, currency: string): number {
  const zeroDecimalCurrencies = ['jpy', 'krw', 'pkr', 'clp', 'gnf', 'mga', 'pyg', 'rwf', 'vnd', 'xaf', 'xof']
  if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
    return amount
  }
  return amount / 100
}

export function toMinorUnits(amount: number, currency: string): number {
  const zeroDecimalCurrencies = ['jpy', 'krw', 'pkr', 'clp', 'gnf', 'mga', 'pyg', 'rwf', 'vnd', 'xaf', 'xof']
  if (zeroDecimalCurrencies.includes(currency.toLowerCase())) {
    return Math.round(amount)
  }
  return Math.round(amount * 100)
}

export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET
  )
}
