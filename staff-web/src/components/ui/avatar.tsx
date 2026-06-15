import { accentIndex, cn, initials } from "@/lib/utils";

const palettes = [
  "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
];

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-11 text-base"
};

export function Avatar({
  name,
  size = "md",
  className
}: {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const palette = palettes[accentIndex(name, palettes.length)];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10",
        palette,
        sizes[size],
        className
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
