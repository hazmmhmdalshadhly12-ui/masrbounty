'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Progress({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('progress',className)} {...p}>{children??'progress'}</div>}
