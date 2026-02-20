import { useEffect } from "react";
import { X, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-window w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-separator">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-text-tertiary hover:text-text-primary disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-text-secondary">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-separator">
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-sm text-text-secondary px-4 py-2 rounded-lg hover:bg-surface-control transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`text-sm text-white px-4 py-2 rounded-lg transition-all disabled:opacity-50 ${
              danger
                ? "bg-danger hover:brightness-110"
                : "bg-accent hover:brightness-110"
            }`}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
