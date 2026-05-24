"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/ui";

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  className,
}: {
  open: boolean;
  title?: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 py-16 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cx("w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-2xl", className)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-lg font-bold text-slate-950">{title}</h2>}
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
