/**
 * Stripe Webhook Handler
 * Handles payment status updates from Stripe asynchronously.
 *
 * IMPORTANT: This route must receive the RAW body (not parsed JSON).
 * next.config.js must disable body parsing for this route.
 *
 * Events handled:
 *  - payment_intent.succeeded      → confirm POS transaction
 *  - payment_intent.payment_failed → mark transaction failed, notify customer
 *  - customer.subscription.updated → update membership status
 *  - customer.subscription.deleted → cancel membership
 *  - charge.refunded               → confirm refund
 */

import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent, stripe } from '@/lib/stripe'
import { createAdminSupabaseClient }     from '@/lib/supabaseServer'
import { whatsappMessages, sendTemplateMessage } from '@/lib/whatsapp'
import { logger }                        from '@/lib/logger'
import type Stripe from 'stripe'

// bodyParser config is not needed in App Router Route Handlers

export async function POST(request: NextRequest) {
  const rawBody   = await request.arrayBuffer()
  const rawBuffer = Buffer.from(rawBody)
  const signature = request.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event

  try {
    event = constructWebhookEvent(rawBuffer, signature)
  } catch (err) {
    logger.error('Stripe webhook signature verification failed', { err })
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  logger.info('Stripe webhook received', { type: event.type, id: event.id })

  try {
    switch (event.type) {

      // ── Payment succeeded ──────────────────────────────────────
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent
        const txnId  = intent.metadata?.transaction_id

        if (!txnId) { logger.warn('No transaction_id in PaymentIntent metadata', { id: intent.id }); break }

        await (supabase as any)
          .from('pos_transactions')
          .update({ status: 'completed', payment_ref: intent.id })
          .eq('id', txnId)

        // Generate invoice if not already done
        const { data: txn } = await (supabase as any)
          .from('pos_transactions')
          .select('*, customer(*)')
          .eq('id', txnId)
          .single() as any

        if (txn) {
          // Check if invoice exists
          const { data: existingInvoice } = await supabase
            .from('invoices').select('id').eq('transaction_id', txnId).single() as any

          if (!existingInvoice) {
            await (supabase as any).from('invoices').insert({
              invoice_number: '',
              customer_id:    txn.customer_id,
              transaction_id: txnId,
              issue_date:     new Date().toISOString().split('T')[0],
              subtotal:       txn.subtotal,
              tax_total:      txn.tax_amount,
              discount_total: txn.discount_amount,
              grand_total:    txn.total,
              status:         'paid',
            })
          }

          // Send WhatsApp receipt if customer has phone
          const customer = txn.customer as { phone?: string; name?: string } | null
          if (customer?.phone) {
            try {
              await sendTemplateMessage(whatsappMessages.paymentReceipt({
                phone:     customer.phone,
                name:      customer.name ?? 'Customer',
                amount:    `${txn.total}`,
                service:   'Service',
                receiptNo: `TXN-${txnId.slice(0, 8).toUpperCase()}`,
                date:      new Date().toLocaleDateString(),
              }))
            } catch (msgErr) {
              logger.warn('Failed to send payment receipt WhatsApp', { txnId, err: msgErr })
            }
          }
        }

        logger.info('Payment confirmed via webhook', { txnId, amount: intent.amount })
        break
      }

      // ── Payment failed ─────────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const intent    = event.data.object as Stripe.PaymentIntent
        const txnId     = intent.metadata?.transaction_id
        const failureMsg = intent.last_payment_error?.message ?? 'Payment failed'

        if (txnId) {
          await (supabase as any)
            .from('pos_transactions')
            .update({ status: 'pending', notes: `Payment failed: ${failureMsg}` })
            .eq('id', txnId)
        }

        logger.warn('Payment failed', { txnId, reason: failureMsg })
        break
      }

      // ── Refund confirmed ───────────────────────────────────────
      case 'charge.refunded': {
        const charge     = event.data.object as Stripe.Charge
        const paymentRef = charge.payment_intent as string

        if (paymentRef) {
          const isFullRefund = charge.amount_refunded === charge.amount
          await (supabase as any)
            .from('pos_transactions')
            .update({ status: isFullRefund ? 'refunded' : 'partial_refund' })
            .eq('payment_ref', paymentRef)
        }

        logger.info('Refund confirmed', { chargeId: charge.id, amount: charge.amount_refunded })
        break
      }

      // ── Subscription updated ───────────────────────────────────
      case 'customer.subscription.updated': {
        const sub       = event.data.object as Stripe.Subscription
        const supabaseSub = await (supabase as any)
          .from('customer_subscriptions')
          .select('id')
          .eq('payment_method', sub.id)  // using Stripe sub ID as reference
          .single() as any

        if (supabaseSub.data) {
          await (supabase as any).from('customer_subscriptions').update({
            status:       sub.status === 'active' ? 'active' : 'paused',
            next_billing: new Date(sub.current_period_end * 1000).toISOString().split('T')[0],
          }).eq('id', supabaseSub.data.id)
        }

        logger.info('Subscription updated', { subscriptionId: sub.id, status: sub.status })
        break
      }

      // ── Subscription cancelled ────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await (supabase as any).from('customer_subscriptions').update({
          status: 'cancelled',
        }).eq('payment_method', sub.id)

        logger.info('Subscription cancelled', { subscriptionId: sub.id })
        break
      }

      default:
        logger.debug('Unhandled Stripe event', { type: event.type })
    }
  } catch (err) {
    logger.error('Stripe webhook processing error', { type: event.type, err })
    // Return 500 so Stripe retries
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
