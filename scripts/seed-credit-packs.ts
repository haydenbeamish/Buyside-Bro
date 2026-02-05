import { getUncachableStripeClient } from '../server/stripeClient';

const CREDIT_PACKS = [
  {
    name: '$10 Credit Pack',
    description: '100 AI credits for stock analysis and chat',
    amount: 1000,
    credits_cents: 1000,
  },
  {
    name: '$25 Credit Pack',
    description: '250 AI credits for stock analysis and chat',
    amount: 2500,
    credits_cents: 2500,
  },
  {
    name: '$50 Credit Pack',
    description: '500 AI credits for stock analysis and chat',
    amount: 5000,
    credits_cents: 5000,
  },
  {
    name: '$100 Credit Pack',
    description: '1000 AI credits for stock analysis and chat',
    amount: 10000,
    credits_cents: 10000,
  },
];

async function seedCreditPacks() {
  const stripe = await getUncachableStripeClient();
  
  console.log('Creating credit pack products...\n');

  for (const pack of CREDIT_PACKS) {
    console.log(`Creating ${pack.name}...`);
    
    const product = await stripe.products.create({
      name: pack.name,
      description: pack.description,
      metadata: {
        type: 'credit_pack',
        credits_cents: pack.credits_cents.toString(),
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: pack.amount,
      currency: 'usd',
    });

    console.log(`  Product ID: ${product.id}`);
    console.log(`  Price ID: ${price.id}`);
    console.log(`  Amount: $${pack.amount / 100}`);
    console.log(`  Credits: ${pack.credits_cents} cents\n`);
  }

  console.log('=== Credit Packs Created Successfully ===');
}

seedCreditPacks().catch(console.error);
