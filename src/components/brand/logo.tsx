import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Show the "CrewDeck" wordmark next to the symbol. */
  withWordmark?: boolean;
};

// The CrewDeck mark: three staggered cards, like columns on a board.
// Colours come from design tokens, so the logo adapts to dark mode.
export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" role="img" aria-label="CrewDeck">
        <rect x="3" y="6" width="7" height="20" rx="2" fill="var(--primary)" />
        <rect x="12.5" y="6" width="7" height="14" rx="2" fill="var(--warning)" />
        <rect x="22" y="6" width="7" height="9" rx="2" fill="var(--primary)" opacity="0.55" />
      </svg>
      {withWordmark && (
        <span aria-hidden="true" className="font-display text-xl font-semibold tracking-tight">
          CrewDeck
        </span>
      )}
    </span>
  );
}
