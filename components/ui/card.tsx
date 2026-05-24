import type { HTMLAttributes } from "react";
import { cx } from "@/lib/ui";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("rounded-lg border border-slate-200 bg-white p-5 shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("mb-4 space-y-1", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cx("text-lg font-bold text-slate-950", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("text-sm text-slate-500", className)} {...props} />;
}
