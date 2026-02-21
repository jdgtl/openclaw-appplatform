import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-modal-overlay"
      style={{ animation: "fadeIn 0.15s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`bg-modal-bg border border-border rounded-[14px] w-full ${maxWidth} mx-4 max-h-[85vh] flex flex-col overflow-hidden shadow-2xl`}
        style={{ animation: "modalIn 0.25s ease" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <span className="text-base font-semibold text-text">{title}</span>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function FormLabel({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <label
      className={`block text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${
        accent ? "text-accent" : "text-text-dim"
      }`}
    >
      {children}
    </label>
  );
}

export function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 bg-input-bg border border-input-border rounded-lg text-sm text-text font-mono outline-none focus:border-accent transition-colors ${props.className ?? ""}`}
    />
  );
}

export function FormTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2.5 bg-input-bg border border-input-border rounded-lg text-sm text-text font-mono outline-none focus:border-accent transition-colors resize-vertical min-h-[80px] ${props.className ?? ""}`}
    />
  );
}

export function FormSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { children, ...rest } = props;
  return (
    <select
      {...rest}
      className={`w-full px-3 py-2.5 bg-input-bg border border-input-border rounded-lg text-sm text-text font-mono outline-none focus:border-accent transition-colors appearance-none bg-no-repeat bg-[length:10px_6px] bg-[position:right_12px_center] ${rest.className ?? ""}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
      }}
    >
      {children}
    </select>
  );
}

export function ModalActions({
  onCancel,
  onSubmit,
  submitLabel,
  disabled,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
      <button
        onClick={onCancel}
        className="px-5 py-2.5 bg-transparent border border-border rounded-lg text-sm text-text-muted hover:bg-surface-hover transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={disabled}
        className="px-6 py-2.5 bg-accent border-none rounded-lg text-sm font-semibold text-white hover:brightness-110 transition-all disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}
