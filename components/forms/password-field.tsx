'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function strength(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  const labels = ['ضعيفة جدًا', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية', 'ممتازة'];
  return { score: Math.min(s, 5), label: labels[Math.min(s, 5)] as string };
}

const bars = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600', 'bg-emerald-700'];

export function PasswordField({
  id = 'password',
  name = 'password',
  label = 'كلمة السر',
  value,
  onChange,
  showStrength = false,
  minLength = 8,
  placeholder = '••••••••',
  error,
}: {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  showStrength?: boolean;
  minLength?: number;
  placeholder?: string;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  const st = strength(value);
  return (
    <div>
      <Label htmlFor={id} className="font-bold">
        {label}
      </Label>
      <div className="relative mt-1.5">
        <Input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          required
          minLength={minLength}
          dir="ltr"
          placeholder={placeholder}
          className={cn('pe-10', error && 'border-destructive focus-visible:ring-destructive')}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      {showStrength && value.length > 0 && (
        <div className="mt-2 flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1" dir="ltr">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= st.score ? bars[st.score] : 'bg-muted dark:bg-slate-700')}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-muted-foreground">{st.label}</span>
        </div>
      )}
    </div>
  );
}
