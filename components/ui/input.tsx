import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "@/lib/ui";

export function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("space-y-2", className)} {...props} />;
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cx("block text-xs font-semibold uppercase tracking-widest text-slate-500", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900",
        "placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900",
        "focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900",
        "placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function FieldError({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("text-xs font-medium text-red-600", className)} {...props} />;
}
