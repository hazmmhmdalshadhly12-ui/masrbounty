'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'تأكيد الإجراء',
  description = 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.',
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  danger,
}: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="إغلاق" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-sm rounded-xl border bg-background p-6 text-center shadow-xl">
        <span
          className={cn(
            'mx-auto flex h-11 w-11 items-center justify-center rounded-full',
            danger ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300' : 'bg-muted text-muted-foreground'
          )}
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h2 className="mt-3 font-black">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={danger ? 'destructive' : 'default'}
            onClick={() => {
              void onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
