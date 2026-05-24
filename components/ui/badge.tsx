import type { HTMLAttributes } from "react";
import { cx } from "@/lib/ui";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

export function Badge({
  variant = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, string> = {
    default: "border-slate-300 bg-slate-50 text-slate-700",
    success: "border-emerald-300 bg-emerald-50 text-emerald-700",
    warning: "border-amber-300 bg-amber-50 text-amber-700",
    danger: "border-red-300 bg-red-50 text-red-700",
    info: "border-teal-300 bg-teal-50 text-teal-700",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase leading-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
