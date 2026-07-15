import { useClerkSafe } from "@/_core/hooks/useAuth";

interface SignInButtonProps {
  className?: string;
}

export function SignInButton({ className }: SignInButtonProps) {
  const { openSignIn } = useClerkSafe();

  return (
    <button
      onClick={() => openSignIn()}
      className={className || "px-5 py-2 text-sm tracking-widest uppercase font-medium border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"}
    >
      <span className="relative z-10">Enter</span>
    </button>
  );
}
