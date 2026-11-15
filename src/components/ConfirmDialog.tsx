import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  details?: Array<{ label: string; value: string }>;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  details,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white border border-[#DCE3DC] shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-[#EEF2EE]">
          <div className="flex items-center gap-2.5">
            {tone === 'danger' && (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-700">
                <AlertTriangle className="h-4 w-4" />
              </span>
            )}
            <h3 id="confirm-dialog-title" className="text-base font-bold text-[#141A15]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[#5C665E] hover:bg-[#F1F4F1] hover:text-[#141A15] transition-colors"
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-[#424B44] leading-relaxed">{description}</p>

          {details && details.length > 0 && (
            <dl className="rounded-lg bg-[#F7F8F5] border border-[#E2E8E2] p-3.5 space-y-2 text-xs">
              {details.map((item) => (
                <div key={item.label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-[#5C665E] font-medium shrink-0">{item.label}</dt>
                  <dd className="text-[#141A15] font-mono tabular-nums text-right truncate">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#FAFBF9] border-t border-[#EEF2EE]">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[40px] px-4 py-2 text-sm font-medium text-[#424B44] bg-white border border-[#D4DDD4] rounded-lg hover:bg-[#F1F4F1] transition-colors whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-[40px] px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              tone === 'danger'
                ? 'bg-red-700 hover:bg-red-800 disabled:bg-red-400'
                : 'bg-[#1B4332] hover:bg-[#143325] disabled:bg-[#748C7E]'
            }`}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
