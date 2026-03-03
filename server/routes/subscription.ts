import type { Express, Request, Response } from "express";
import { isAuthenticated, authStorage } from "../replit_integrations/auth";
import { stripeService } from "../stripeService";
import { getStripePublishableKey, getUncachableStripeClient } from "../stripeClient";
import { getBroStatus } from "../creditService";

export function registerSubscriptionRoutes(app: Express) {
  // Stripe subscription routes
  app.get("/api/stripe/publishable-key", async (req: Request, res: Response) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting publishable key:", error);
      res.status(500).json({ error: "Failed to get Stripe configuration" });
    }
  });

  app.get("/api/subscription/products", async (req: Request, res: Response) => {
    try {
      const stripe = await getUncachableStripeClient();
      const prices = await stripe.prices.list({
        active: true,
        type: 'recurring',
        limit: 10,
        expand: ['data.product'],
      });

      const productsMap = new Map();
      for (const price of prices.data) {
        const product = price.product as any;
        if (!product || typeof product === 'string') continue;
        if (!product.active) continue;

        if (!productsMap.has(product.id)) {
          productsMap.set(product.id, {
            id: product.id,
            name: product.name,
            description: product.description,
            active: product.active,
            metadata: product.metadata,
            prices: []
          });
        }
        productsMap.get(product.id).prices.push({
          id: price.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring,
          active: price.active,
        });
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Error listing products:", error);
      res.json({ products: [] });
    }
  });

  app.get("/api/subscription/status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isActive = user.subscriptionStatus === "active";
      const tier = (user as any).subscriptionTier || "free";

      res.json({
        status: user.subscriptionStatus || "none",
        isActive,
        tier,
        isTrialing: false,
        trialEndsAt: null,
        subscriptionEndsAt: user.subscriptionEndsAt,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
      });
    } catch (error) {
      console.error("Error getting subscription status:", error);
      res.status(500).json({ error: "Failed to get subscription status" });
    }
  });

  app.post("/api/subscription/checkout", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      let { priceId } = req.body;
      const stripe = await getUncachableStripeClient();

      if (priceId) {
        try {
          const existing = await stripe.prices.retrieve(priceId);
          if (!existing.active || !existing.recurring) {
            priceId = null;
          }
        } catch {
          priceId = null;
        }
      }

      if (!priceId) {
        const prices = await stripe.prices.list({
          active: true,
          type: 'recurring',
          limit: 10,
        });
        const subscriptionPrice = prices.data.find(p => p.recurring?.interval === 'month');
        if (!subscriptionPrice) {
          return res.status(400).json({ error: "No subscription price configured in Stripe" });
        }
        priceId = subscriptionPrice.id;
      }

      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email || "", userId);
        await stripeService.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.get("host");
      const baseUrl = `${protocol}://${host}`;

      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/subscription?success=true`,
        `${baseUrl}/subscription?canceled=true`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      const message = error?.message || "Failed to create checkout session";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/subscription/portal", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await authStorage.getUser(userId);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No subscription found" });
      }

      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.get("host");
      const returnUrl = `${protocol}://${host}/subscription`;

      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        returnUrl
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  // Bro daily query status
  app.get("/api/bro/status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const user = await authStorage.getUser(userId);
      const status = await getBroStatus(userId, user);
      res.json(status);
    } catch (error) {
      console.error("Error fetching bro status:", error);
      res.status(500).json({ error: "Failed to fetch bro status" });
    }
  });
}
