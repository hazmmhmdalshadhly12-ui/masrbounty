'use client';

import { useCallback, useEffect, useState } from 'react';

// تخزين محلي متزامن مع localStorage — يعمل بأمان مع SSR
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // تجاهل قيم التخزين التالفة
    }
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // التخزين ممتلئ أو محظور — نُبقي حالة الذاكرة فقط
        }
        return resolved;
      });
    },
    [key],
  );

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // لا شيء
    }
    setValue(initialValue);
  }, [key, initialValue]);

  return [value, set, remove] as const;
}
