'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  min?: number;
  max?: number;
  step?: number;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, min = 0, max = 100, step = 1, value, defaultValue, ...props }, ref) => {
    const numericValue = Array.isArray(value)
      ? Number(value[0] ?? min)
      : (value as number | undefined) ?? (defaultValue as number | undefined) ?? min;
    const percent = max === min ? 0 : ((numericValue - min) / (max - min)) * 100;
    return (
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value as number | undefined}
        defaultValue={defaultValue as number | undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        style={{
          background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${percent}%, hsl(var(--secondary)) ${percent}%, hsl(var(--secondary)) 100%)`,
        }}
        {...props}
      />
    );
  },
);
Slider.displayName = 'Slider';

export { Slider };
