'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
}: {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  showStrength?: boolean;
  minLength?: number;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const st = strength(value);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1">
        <Input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          required
          minLength={minLength}
          dir="ltr"
          placeholder={placeholder}
          className="pr-10"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showStrength && value.length > 0 && (
        <div className="mt-2 flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1" dir="ltr">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= st.score ? bars[st.score] : 'bg-muted'}`} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{st.label}</span>
        </div>
      )}
    </div>
  );
}
