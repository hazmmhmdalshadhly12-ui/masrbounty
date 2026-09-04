'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Checkbox({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('checkbox',className)} {...p}>{children??'checkbox'}</div>}
