'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Toast({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('toast',className)} {...p}>{children??'toast'}</div>}
