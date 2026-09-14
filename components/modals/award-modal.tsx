'use client';

import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AwardModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: (amount: number) => void | Promise<void>;
  suggestedMax?: number;
  title?: string;
  action?: (formData: FormData) => void | Promise<void>;
}

export function AwardModal({
  open,
  onClose,
  onConfirm,
  suggestedMax,
  title = 'منح مكافأة',
  action,
}: AwardModalProps) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!(n > 0) || saving) return;
    if (!onConfirm && !action) return;
    setSaving(true);
    try {
      if (onConfirm) await onConfirm(n);
      else if (action) {
        const fd = new FormData();
        fd.set('amount', String(n));
        await action(fd);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="إغلاق" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-sm rounded-xl border bg-background p-6 shadow-xl">
        <p className="flex items-center gap-2 font-black">
          <Trophy className="h-5 w-5 text-amber-500" />
          {title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {suggestedMax ? (
            <>
              الحد الأقصى المقترح{' '}
              <b className="tabular-nums" dir="ltr">
                {suggestedMax.toLocaleString()} EGP
              </b>
            </>
          ) : (
            'أدخل مبلغ المكافأة بالجنيه المصري.'
          )}
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="award-amount" className="text-xs font-bold text-muted-foreground">
              المبلغ (EGP)
            </label>
            <Input
              id="award-amount"
              name="amount"
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000"
              dir="ltr"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="bg-slate-900 text-white hover:bg-slate-700">
              {saving ? 'جارٍ الحفظ…' : 'تأكيد المنح'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
