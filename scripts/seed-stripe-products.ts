import { getUncachableStripeClient } from '../server/stripeClient';

async function seedProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    
    const existingProducts = await stripe.products.search({ 
      query: "name:'Buy Side Bro Pro'" 
    });
    
    if (existingProducts.data.length > 0) {
      console.log('Buy Side Bro Pro subscription already exists');
      console.log('Product ID:', existingProducts.data[0].id);
      const prices = await stripe.prices.list({ product: existingProducts.data[0].id });
      console.log('Price IDs:', prices.data.map(p => ({ id: p.id, amount: p.unit_amount })));
      return;
    }

    console.log('Creating Buy Side Bro Pro subscription product...');
    
    const product = await stripe.products.create({
      name: 'Buy Side Bro Pro',
      description: 'Full access to Buy Side Bro financial markets dashboard - real-time market data, hedge fund quality stock analysis, portfolio tracking, and more. Includes a 2-week free trial.',
      metadata: {
        type: 'subscription',
        trialDays: '14',
      },
    });
    
    console.log('Product created:', product.id);

    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 1000,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: {
        displayName: '$10/month',
      },
    });
    
    console.log('Monthly price created:', monthlyPrice.id);
    console.log('');
    console.log('=== Stripe Product Setup Complete ===');
    console.log('Product ID:', product.id);
    console.log('Monthly Price ID:', monthlyPrice.id);
    console.log('Price: $10.00/month with 2-week free trial');
    
  } catch (error) {
    console.error('Error creating products:', error);
    process.exit(1);
  }
}

seedProducts();
