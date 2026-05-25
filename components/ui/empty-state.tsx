import type { ReactNode } from "react";
import { cx } from "@/lib/ui";

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center", className)}>
      {icon && <div className="mb-3 flex justify-center text-slate-400">{icon}</div>}
      <p className="font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
