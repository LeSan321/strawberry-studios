export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Clerk sign-in modal helper
// This is now handled by Clerk's <SignIn /> component instead of redirect URLs
export const openSignInModal = () => {
  // Clerk provides this via the useClerk hook
  // Components should use: const { openSignIn } = useClerk(); openSignIn();
};
