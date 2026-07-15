/**
 * Login.tsx — Studios Sign-In Page
 * ==================================
 * Handles two scenarios:
 *   1. Direct visit to /login — shows sign-in UI, redirects to / after auth
 *   2. Auth redirect from a protected page — /login?redirect=/music-videos?trackId=42%26source=riff
 *      After sign-in, user is sent back to the original URL with all params intact.
 *
 * Uses Clerk's <SignIn /> component (embedded, not modal) so the user never
 * leaves the Studios domain. After sign-in Clerk fires onSignIn and we
 * navigate to the redirect target.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { SignIn } from "@clerk/react";
import { useUserSafe } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

export default function Login() {
  const [, navigate] = useLocation();
  const { isSignedIn, isLoaded } = useUserSafe();

  // Parse the redirect target from query params
  const redirectTarget = (() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("redirect");
    // Only allow relative redirects (no external URLs)
    if (r && r.startsWith("/")) return r;
    return "/";
  })();

  // If already signed in, redirect immediately
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isLoaded, isSignedIn, redirectTarget, navigate]);

  // Show nothing while Clerk is loading (avoids flash)
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  // Already signed in — navigating, show nothing
  if (isSignedIn) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Minimal nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-primary text-2xl">✦</span>
          <span className="font-display text-sm tracking-widest text-foreground/90 uppercase">
            Strawberry Studios
          </span>
        </Link>
      </nav>

      {/* Sign-in card */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-display tracking-wide text-foreground mb-2">
            Sign in to Studios
          </h1>
          <p className="text-sm text-zinc-500">
            Access music video generation, concert creation, and your creative library.
          </p>
        </div>

        {/* Clerk embedded sign-in — uses the Blooming Frontier Clerk app */}
        <SignIn
          routing="hash"
          forceRedirectUrl={redirectTarget}
          signUpForceRedirectUrl={redirectTarget}
          appearance={{
            variables: {
              colorPrimary: "oklch(0.7 0.15 310)",
              colorBackground: "oklch(0.08 0.01 270)",
              colorNeutral: "oklch(0.85 0.01 270)",
              colorForeground: "oklch(0.95 0.01 270)",
              borderRadius: "0.5rem",
              fontFamily: "inherit",
            },
            elements: {
              card: "shadow-none bg-transparent",
              rootBox: "w-full max-w-sm",
              formButtonPrimary:
                "bg-primary hover:bg-primary/90 text-primary-foreground text-sm tracking-wider uppercase",
              footerActionLink: "text-primary hover:text-primary/80",
            },
          }}
        />
      </div>
    </div>
  );
}
