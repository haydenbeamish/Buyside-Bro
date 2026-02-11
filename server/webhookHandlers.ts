import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { db } from './db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const stripe = await getUncachableStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not set — skipping signature verification is not allowed');
      throw new Error('Webhook secret not configured');
    }

    try {
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      // Handle subscription events to set tier
      if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated'
      ) {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;

        if (customerId && subscription.status === 'active') {
          // Look up the price to determine tier
          const item = subscription.items?.data?.[0];
          const priceId = item?.price?.id;
          let tier = 'starter'; // default

          if (priceId) {
            try {
              const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
              const product = price.product as any;
              // Check product metadata for tier
              if (product?.metadata?.tier) {
                tier = product.metadata.tier;
              } else if (price.unit_amount && price.unit_amount >= 5000) {
                // Fallback: $50+ = pro, otherwise starter
                tier = 'pro';
              }
            } catch (e) {
              console.error('Error retrieving price for tier detection:', e);
            }
          }

          // Update user tier
          await db.update(users)
            .set({ subscriptionTier: tier, updatedAt: new Date() } as any)
            .where(eq(users.stripeCustomerId, customerId));
          console.log(`[Webhook] Set tier '${tier}' for customer ${customerId}`);
        }
      }

      // Handle subscription cancellation/deletion
      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        if (customerId) {
          await db.update(users)
            .set({ subscriptionTier: 'free', updatedAt: new Date() } as any)
            .where(eq(users.stripeCustomerId, customerId));
          console.log(`[Webhook] Reset tier to 'free' for customer ${customerId}`);
        }
      }
    } catch (err) {
      console.error('Custom webhook handling error:', err);
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }
}
