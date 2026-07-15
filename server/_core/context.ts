import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateRequest } from "./clerk-auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** Raw Clerk Bearer token extracted from the Authorization header. Used to forward auth to Riff bridge calls. */
  clerkToken: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    console.error("[Context] Authentication error:", error);
    user = null;
  }

  // Extract raw Bearer token so procedures can forward it to Riff bridge calls.
  const authHeader = opts.req.headers.authorization ?? "";
  const clerkToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  return {
    req: opts.req,
    res: opts.res,
    user,
    clerkToken,
  };
}
