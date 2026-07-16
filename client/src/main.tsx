import { ClerkProvider } from "@clerk/react";
import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // With Clerk, we don't redirect — the app will show the sign-in modal
  // This is handled by the useAuth hook in pages
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const isStudiosDomain = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "strawberryriff.studio" || host.endsWith(".strawberryriff.studio");
};

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        let token: string | null = null;

        if (isStudiosDomain()) {
          token = await (window as any).__clerk?.session?.getToken?.() ?? null;
        }

        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers: {
            ...(init?.headers ?? {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      },
    }),
  ],
});

function AppProviders() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

async function bootstrap() {
  // Fetch the Clerk publishable key from the server at runtime.
  // This avoids the Vite build-time injection problem on Railway where
  // VITE_* vars are runtime-only and not available during Docker build.
  let clerkPubKey: string | null = null;

  if (isStudiosDomain()) {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const cfg = await res.json();
        clerkPubKey = cfg.clerkPublishableKey || null;
      }
    } catch (e) {
      console.warn("[Config] Failed to fetch /api/config, Clerk will not be initialized:", e);
    }
  }

  const root = document.getElementById("root")!;

  if (clerkPubKey) {
    createRoot(root).render(
      <ClerkProvider publishableKey={clerkPubKey}>
        <AppProviders />
      </ClerkProvider>
    );
  } else {
    createRoot(root).render(<AppProviders />);
  }
}

bootstrap();
