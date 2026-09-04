'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Dialog({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('dialog',className)} {...p}>{children??'dialog'}</div>}
