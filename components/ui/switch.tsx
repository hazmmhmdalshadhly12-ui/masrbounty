'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Switch({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('switch',className)} {...p}>{children??'switch'}</div>}
