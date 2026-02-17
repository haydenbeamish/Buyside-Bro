import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { sendWelcomeEmail } from "../../email";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET;

if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
  console.error("FATAL: AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET must all be set. Exiting.");
  process.exit(1);
}

const getOidcConfig = memoize(
  async () => {
    const issuerUrl = new URL(`https://${AUTH0_DOMAIN}/`);
    return await client.discovery(
      issuerUrl,
      AUTH0_CLIENT_ID!,
      { client_secret: AUTH0_CLIENT_SECRET! }
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.trim().length === 0) {
    console.error("FATAL: SESSION_SECRET environment variable is not set or is empty. Exiting.");
    process.exit(1);
  }

  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  const claims = tokens.claims()!;
  user.claims = {
    sub: claims.sub,
    email: (claims as any).email,
  };
  user.refresh_token = tokens.refresh_token;
  user.expires_at = claims!.exp;
}

async function upsertUser(claims: any): Promise<boolean> {
  const existingUser = await authStorage.getUser(claims["sub"]);
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["given_name"] || claims["first_name"],
    lastName: claims["family_name"] || claims["last_name"],
    profileImageUrl: claims["picture"] || claims["profile_image_url"],
  });
  return !existingUser;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      const user = {};
      updateUserSession(user, tokens);
      const claims = tokens.claims();
      const isNewUser = await upsertUser(claims);
      console.log("[Auth] User verified successfully:", (claims as any)?.email || claims?.sub);

      if (isNewUser && claims && (claims as any)?.email) {
        sendWelcomeEmail(
          claims.sub!,
          (claims as any).email,
          (claims as any).given_name || (claims as any).first_name
        ).catch((e: any) => console.error("[Email] Welcome email error:", e));
      }

      verified(null, user);
    } catch (error) {
      console.error("[Auth] Error in verify function:", error);
      verified(error as Error);
    }
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `auth0:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    const origRedirect = res.redirect.bind(res);
    res.redirect = function (this: any, ...args: any[]) {
      req.session.save(() => {
        origRedirect.apply(this, args as any);
      });
    } as any;
    passport.authenticate(`auth0:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`auth0:${req.hostname}`, (err: any, user: any, info: any) => {
      if (err) {
        console.error("[Auth Callback] Error during authentication:", err);
        return res.redirect("/");
      }
      if (!user) {
        console.error("[Auth Callback] Authentication failed - no user returned. Info:", info);
        return res.redirect("/");
      }
      (req.logIn as Function)(user, { keepSessionInfo: true }, (loginErr: any) => {
        if (loginErr) {
          console.error("[Auth Callback] Error during login:", loginErr);
          return res.redirect("/");
        }
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("[Auth Callback] Error saving session:", saveErr);
          }
          res.setHeader("Content-Type", "text/html");
          res.end(`<html><head><meta http-equiv="refresh" content="0;url=/whats-up"></head><body></body></html>`);
        });
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    const returnTo = `${req.protocol}://${req.hostname}`;
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect(
          `https://${AUTH0_DOMAIN}/v2/logout?client_id=${AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(returnTo)}`
        );
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
