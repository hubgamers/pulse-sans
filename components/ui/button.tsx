import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/ui";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  const variants: Record<ButtonVariant, string> = {
    primary: "border border-teal-700 bg-teal-700 text-white hover:bg-teal-600 hover:border-teal-600",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400",
    ghost: "border border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-sm",
    icon: "h-9 w-9 p-0",
  };

  return cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-teal-600/25 disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    sizes[size],
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function Button({ variant, size, icon, className, children, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClassName({ variant, size, className })} {...props}>
      {icon}
      {children}
    </button>
  );
}
