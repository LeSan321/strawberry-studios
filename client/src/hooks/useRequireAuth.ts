/**
 * useRequireAuth.ts
 * =================
 * Redirects unauthenticated users to /login?redirect=<current_path>
 * so that after sign-in they are returned to the page they were trying to reach.
 *
 * Deep-link params (e.g. ?trackId=42&source=riff) are preserved in the redirect.
 *
 * Usage:
 *   const { isReady } = useRequireAuth();
 *   if (!isReady) return null; // Clerk still loading or redirecting
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";

export function useRequireAuth() {
  const { isSignedIn, isLoaded } = useUser();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoaded) return; // Wait for Clerk to finish loading
    if (isSignedIn) return; // Already authenticated — nothing to do

    // Build the redirect URL preserving the full current path + query string
    const currentPath = window.location.pathname + window.location.search;
    const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
    navigate(loginUrl, { replace: true });
  }, [isLoaded, isSignedIn, navigate]);

  return {
    // true when Clerk is loaded AND user is authenticated — safe to render
    isReady: isLoaded && Boolean(isSignedIn),
    isLoading: !isLoaded,
  };
}
