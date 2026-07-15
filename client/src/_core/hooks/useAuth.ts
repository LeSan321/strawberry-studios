import { useContext, useCallback, useMemo } from "react";
import { ClerkInstanceContext } from "@clerk/shared/react";
import { useClerk, useUser } from "@clerk/react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

/** Returns true when the component tree is wrapped by a <ClerkProvider>. */
export function useIsInsideClerkProvider(): boolean {
  // ClerkInstanceContext is null/undefined when there is no ClerkProvider ancestor.
  // Using useContext directly avoids the assertContextExists throw.
  const ctx = useContext(ClerkInstanceContext as React.Context<unknown>);
  return Boolean(ctx);
}

// ---------------------------------------------------------------------------
// Safe wrappers — return no-ops when outside ClerkProvider (sandbox preview)
// ---------------------------------------------------------------------------

const NO_OP_OPEN_SIGN_IN = () => {};
const NO_OP_SIGN_OUT = async () => {};

/**
 * Safe version of useClerk().
 * Returns a no-op `openSignIn` and `signOut` when there is no ClerkProvider.
 */
export function useClerkSafe() {
  const insideClerk = useIsInsideClerkProvider();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const clerk = insideClerk ? useClerk() : null;
  return {
    openSignIn: clerk?.openSignIn ?? NO_OP_OPEN_SIGN_IN,
    signOut: clerk?.signOut ?? NO_OP_SIGN_OUT,
    clerk,
  };
}

/**
 * Safe version of useUser().
 * Returns `{ user: null, isLoaded: true, isSignedIn: false }` when there is no ClerkProvider.
 */
export function useUserSafe() {
  const insideClerk = useIsInsideClerkProvider();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = insideClerk ? useUser() : null;
  return {
    user: result?.user ?? null,
    isLoaded: result?.isLoaded ?? true,
    isSignedIn: result?.isSignedIn ?? false,
  };
}

// ---------------------------------------------------------------------------
// Stub returned on non-Clerk domains (Manus sandbox preview)
// ---------------------------------------------------------------------------

const UNAUTHENTICATED_STUB = {
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  refresh: () => Promise.resolve(),
  logout: async () => {},
};

function useClerkAuth(_options?: UseAuthOptions) {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();

  const user = useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: parseInt(clerkUser.id, 10) || 0,
      openId: clerkUser.id,
      name:
        clerkUser.firstName ||
        clerkUser.emailAddresses[0]?.emailAddress ||
        clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || null,
      loginMethod: "clerk",
      role: "user" as const,
      createdAt: clerkUser.createdAt || new Date(),
      updatedAt: clerkUser.updatedAt || new Date(),
      lastSignedIn: new Date(),
    };
  }, [clerkUser]);

  const logout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("[Auth] Sign out failed:", error);
      throw error;
    }
  }, [signOut]);

  return {
    user,
    loading: !isLoaded,
    error: null,
    isAuthenticated: Boolean(clerkUser) && isLoaded,
    refresh: () => Promise.resolve(),
    logout,
  };
}

/**
 * Unified auth hook.
 *
 * On production (strawberryriff.studio) the app is wrapped by <ClerkProvider>
 * and this hook returns live Clerk auth state.
 *
 * On Manus sandbox preview domains (no ClerkProvider) the hook returns an
 * unauthenticated stub so the app renders cleanly without throwing.
 */
export function useAuth(options?: UseAuthOptions) {
  const insideClerk = useIsInsideClerkProvider();

  // Conditionally call the Clerk hook — safe because `insideClerk` is stable
  // for the lifetime of the page (depends only on the provider tree).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  if (!insideClerk) return UNAUTHENTICATED_STUB;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useClerkAuth(options);
}
