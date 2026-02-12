import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { shutdownApns } from "./push/apnsService";

/**
 * Validates required and optional environment variables at startup.
 * Throws an error for missing required vars; logs warnings for optional ones.
 */
function validateEnvVars(): void {
  const required: { name: string; reason: string }[] = [
    { name: "DATABASE_URL", reason: "database connection will fail" },
  ];

  const optional: { name: string; reason: string }[] = [
    { name: "LASERBEAMNODE_API_KEY", reason: "external market data will not work" },
    { name: "OPENROUTER_API_KEY", reason: "AI chat features will not work" },
    { name: "INTERNAL_API_KEY", reason: "internal API authentication will not work" },
    { name: "ADMIN_EMAILS", reason: "admin access will fall back to default" },
  ];

  // Check required env vars — fail fast if any are missing
  const missing: string[] = [];
  for (const { name, reason } of required) {
    if (!process.env[name]) {
      console.error(`[Config] ERROR: ${name} is not set — ${reason}`);
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. Server cannot start.`
    );
  }

  // Check optional env vars — warn but continue
  for (const { name, reason } of optional) {
    if (!process.env[name]) {
      console.warn(`[Config] WARNING: ${name} not set - ${reason}`);
    }
  }

  console.log("[Config] Environment variable validation complete");
}

validateEnvVars();

const app = express();
const httpServer = createServer(app);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://s3.tradingview.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: [
        "'self'",
        "https://api.laserbeamcapital.com",
        "https://financialmodelingprep.com",
        "wss://*.tradingview.com",
        "https://*.tradingview.com",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
      ],
      workerSrc: ["'self'", "blob:"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "https://*.tradingview.com"],
      formAction: ["'self'", "https://replit.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
}));

// Rate limiting for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/", apiLimiter);

// Stricter rate limiting for login endpoint
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});
app.use("/api/login", authLimiter);
app.use("/api/callback", authLimiter);

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/subscription/checkout", paymentLimiter);
app.use("/api/credits/purchase", paymentLimiter);

// Health check endpoint
app.get("/health", async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: "error", timestamp: new Date().toISOString() });
  }
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("DATABASE_URL not found, skipping Stripe initialization");
    return;
  }

  try {
    console.log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    console.log("Stripe schema ready");

    const stripeSync = await getStripeSync();

    console.log("Setting up managed webhook...");
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    try {
      const result = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      if (result?.webhook?.url) {
        console.log(`Webhook configured: ${result.webhook.url}`);
      } else {
        console.log("Webhook setup completed (no URL returned - may already exist)");
      }
    } catch (webhookError) {
      console.error("Webhook setup failed:", webhookError);
    }

    console.log("Syncing Stripe data...");
    stripeSync.syncBackfill()
      .then(() => console.log("Stripe data synced"))
      .catch((err: any) => console.error("Error syncing Stripe data:", err));
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
}

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature" });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error("Stripe webhook: req.body is not a Buffer");
        return res.status(500).json({ error: "Webhook processing error" });
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error.message);
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  await seedDatabase();
  
  // Initialize Stripe
  await initStripe();
  
  // Set up authentication (must be before other routes)
  await setupAuth(app);
  registerAuthRoutes(app);
  
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  // Graceful shutdown
  const shutdown = () => {
    log("Shutting down gracefully...");
    try { shutdownApns(); } catch (_) { /* APNs may not be initialized */ }
    httpServer.close(() => {
      log("Server closed");
      process.exit(0);
    });
    setTimeout(() => {
      log("Forcing shutdown after timeout");
      process.exit(1);
    }, 10000);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})();
