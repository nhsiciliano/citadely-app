"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Appointment } from "@/lib/citadely-db";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-line bg-white px-5 pb-6 pt-20 sm:px-8 sm:py-5 lg:flex-row lg:items-end lg:justify-between lg:px-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-ink">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-ink-soft">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  width = "wide",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: "wide" | "medium";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className={`fixed inset-y-0 right-0 m-0 ml-auto h-dvh max-h-none w-full max-w-none border-0 bg-white p-0 text-ink shadow-[-18px_0_48px_rgba(8,31,63,.16)] backdrop:bg-[rgba(4,20,42,.12)] open:flex open:flex-col ${width === "wide" ? "drawer-wide sm:max-w-[480px]" : "drawer-medium sm:max-w-[420px]"}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-7">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.025em]" id={titleId}>{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-ink-soft" id={descriptionId}>{description}</p> : null}
        </div>
        <button aria-label="Cerrar panel" className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line text-ink-soft hover:border-line-strong hover:text-ink" onClick={onClose} type="button">
          <X aria-hidden="true" size={19} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">{children}</div>
    </dialog>
  );
}

const STATUS_LABELS: Record<Appointment["status"], string> = {
  pending_payment: "Seña pendiente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Completado",
  no_show: "No asistió",
};

export function StatusBadge({ status }: { status: Appointment["status"] }) {
  return <span className={`status-badge status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong bg-surface-subtle px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">{text}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
