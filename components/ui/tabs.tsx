import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/ui";

export function Tabs({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1", className)}>
      {children}
    </div>
  );
}

const tabClassName = (active?: boolean, className?: string) =>
  cx(
    "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors",
    active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
    className,
  );

export function TabButton({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button type="button" className={tabClassName(active, className)} {...props} />;
}

export function TabLink({
  active,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean }) {
  return <a className={tabClassName(active, className)} {...props} />;
}
