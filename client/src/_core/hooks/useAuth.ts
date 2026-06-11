import { useClerk, useUser } from "@clerk/react";
import { useCallback, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false } = options ?? {};
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();

  // Map Clerk user to our user format
  const user = useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: parseInt(clerkUser.id, 10) || 0, // Fallback if parsing fails
      openId: clerkUser.id,
      name: clerkUser.firstName || clerkUser.emailAddresses[0]?.emailAddress || clerkUser.id,
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

  const state = useMemo(() => {
    return {
      user,
      loading: !isLoaded,
      error: null,
      isAuthenticated: Boolean(clerkUser) && isLoaded,
    };
  }, [user, isLoaded, clerkUser]);

  // Note: redirectOnUnauthenticated is deprecated with Clerk modal
  // The app should use <SignedOut> component or check isAuthenticated instead

  return {
    ...state,
    refresh: () => Promise.resolve(), // Clerk handles this automatically
    logout,
  };
}
