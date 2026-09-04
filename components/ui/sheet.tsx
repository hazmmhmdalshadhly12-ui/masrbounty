'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Sheet({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('sheet',className)} {...p}>{children??'sheet'}</div>}
