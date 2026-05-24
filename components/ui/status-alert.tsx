import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cx } from "@/lib/ui";

type StatusAlertVariant = "success" | "danger" | "warning" | "info";

export function StatusAlert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: StatusAlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const styles: Record<StatusAlertVariant, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    danger: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-slate-200 bg-slate-50 text-slate-700",
  };
  const icons: Record<StatusAlertVariant, ReactNode> = {
    success: <CheckCircle2 size={16} />,
    danger: <AlertCircle size={16} />,
    warning: <AlertCircle size={16} />,
    info: <Info size={16} />,
  };

  return (
    <div className={cx("rounded-lg border px-4 py-3 text-sm", styles[variant], className)}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{icons[variant]}</span>
        <div className="min-w-0">
          {title && <p className="font-semibold">{title}</p>}
          <div className={cx(title && "mt-1")}>{children}</div>
        </div>
      </div>
    </div>
  );
}
