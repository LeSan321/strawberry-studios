import { clerkMiddleware, getAuth, verifyToken } from "@clerk/express";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// Clerk's @clerk/express reads CLERK_PUBLISHABLE_KEY (no VITE_ prefix) from env.
// Studios stores it as VITE_CLERK_PUBLISHABLE_KEY (for Vite frontend access).
// We must alias it so the Clerk SDK can find it at the standard env var name.
// NOTE: ENV is a static object frozen at import time. Always read directly from
// process.env for Clerk keys to ensure Railway-injected values are picked up.
const clerkPublishableKey = () =>
  process.env.CLERK_PUBLISHABLE_KEY ||
  process.env.VITE_CLERK_PUBLISHABLE_KEY ||
  ENV.clerkPublishableKey;
const clerkSecretKey = () =>
  process.env.CLERK_SECRET_KEY ||
  ENV.clerkSecretKey;

/**
 * Clerk authentication middleware for Express.
 * Validates Bearer tokens from Clerk and populates req.auth.
 * If Clerk keys are not configured, returns a no-op middleware.
 */
export function getClerkMiddleware() {
  const secretKey = clerkSecretKey();
  const publishableKey = clerkPublishableKey();

  // If Clerk keys are not configured, return a no-op middleware
  if (!secretKey || !publishableKey) {
    console.warn("[Clerk] Publishable or secret key missing. Clerk auth disabled.");
    console.warn("[Clerk] CLERK_SECRET_KEY set:", !!process.env.CLERK_SECRET_KEY);
    console.warn("[Clerk] CLERK_PUBLISHABLE_KEY set:", !!process.env.CLERK_PUBLISHABLE_KEY);
    console.warn("[Clerk] VITE_CLERK_PUBLISHABLE_KEY set:", !!process.env.VITE_CLERK_PUBLISHABLE_KEY);
    return (_req: any, _res: any, next: any) => next();
  }

  console.log("[Clerk] Initializing middleware with publishable key:", publishableKey.substring(0, 20) + "...");

  return clerkMiddleware({
    secretKey,
    publishableKey,
  });
}

/**
 * Extract and verify the Clerk session token from the request.
 * Returns the authenticated user or null if not authenticated.
 */
export async function authenticateRequest(req: Request): Promise<User | null> {
  try {
    // Get Clerk auth context (set by clerkMiddleware)
    const auth = getAuth(req);
    
    if (!auth.userId) {
      return null;
    }

    const clerkUserId = auth.userId;
    console.log(`[Clerk] Authenticating user: ${clerkUserId}`);

    // Fetch or create user in database
    // Note: Clerk auth object doesn't include user details, so we use userId as name fallback
    const user = await db.upsertUser({
      openId: clerkUserId, // Clerk userId is the openId
      name: clerkUserId, // Use userId as fallback name
      email: null, // Email not available in auth context
      loginMethod: "clerk",
      lastSignedIn: new Date(),
    });

    if (!user) {
      console.error("[Clerk] Failed to create/fetch user");
      return null;
    }

    console.log(`[Clerk] User authenticated: ${user.id}`);
    return user;
  } catch (error) {
    console.error("[Clerk] Authentication failed:", error);
    return null;
  }
}

/**
 * Verify a Bearer token from Clerk.
 * Used for cross-service calls (e.g., Riff calling Studios bridge).
 */
export async function verifyBearerToken(authHeader: string): Promise<string | null> {
  try {
    if (!authHeader.startsWith("Bearer ")) {
      console.warn("[Clerk] verifyBearerToken: Authorization header does not start with 'Bearer '");
      return null;
    }

    const sessionToken = authHeader.slice(7); // Remove "Bearer " prefix
    console.log(`[Clerk] verifyBearerToken: verifying token (first 20 chars): ${sessionToken.substring(0, 20)}...`);
    
    const secretKey = clerkSecretKey();
    if (!secretKey) {
      console.error("[Clerk] verifyBearerToken: CLERK_SECRET_KEY is not set");
      console.error("[Clerk] process.env.CLERK_SECRET_KEY:", !!process.env.CLERK_SECRET_KEY);
      console.error("[Clerk] ENV.clerkSecretKey:", !!ENV.clerkSecretKey);
      return null;
    }
    // Verify the token with Clerk.
    // publishableKey is required so Clerk can derive the correct JWK endpoint.
    // Without it, Clerk infers the JWK URL from the token issuer claim and can
    // crash with SyntaxError: Unexpected end of data after a cold-start / cache clear.
    const publishableKey = clerkPublishableKey();
    const decoded = await verifyToken(sessionToken, {
      secretKey,
      ...(publishableKey ? { publishableKey } : {}),
    });
    
    if (!decoded || !decoded.sub) {
      console.warn("[Clerk] Token verification failed: no sub claim");
      return null;
    }

    console.log(`[Clerk] Bearer token verified for user: ${decoded.sub}`);
    return decoded.sub;
  } catch (error) {
    console.error("[Clerk] Bearer token verification failed:", error);
    // Log the specific error reason to help diagnose
    if (error instanceof Error) {
      console.error("[Clerk] Error message:", error.message);
      console.error("[Clerk] Error name:", error.name);
    }
    return null;
  }
}
