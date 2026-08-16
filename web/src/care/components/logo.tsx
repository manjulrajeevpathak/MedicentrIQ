import { cn } from "@care/lib/utils";

/** HealthFlow logomark — copied from staff-web (services stay independent). */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[11px] shadow-sm", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" role="img" aria-label="HealthFlow">
        <defs>
          <linearGradient id="hcos-logo-grad" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4d83f3" />
            <stop offset="1" stopColor="#1c46ad" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#hcos-logo-grad)" />
        <path d="M13 12.5V27.5M27 12.5V27.5" stroke="white" strokeWidth="2.9" strokeLinecap="round" />
        <path
          d="M13 20H16.4L18.4 16.4L21 24.2L22.8 20H27"
          stroke="white"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
