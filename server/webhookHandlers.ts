import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { addPurchasedCredits } from './creditService';

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

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;

        if (session.metadata?.type === 'credit_purchase' && session.metadata?.userId) {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          const item = lineItems.data[0];

          if (item?.price?.id) {
            const priceDetails = await stripe.prices.retrieve(item.price.id, {
              expand: ['product']
            });
            const product = priceDetails.product as any;
            const creditsCents = parseInt(product.metadata?.credits_cents || '0');

            if (creditsCents > 0) {
              await addPurchasedCredits(session.metadata.userId, creditsCents);
              console.log(`Added ${creditsCents} credit cents to user ${session.metadata.userId}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('Custom webhook handling error:', err);
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }
}
