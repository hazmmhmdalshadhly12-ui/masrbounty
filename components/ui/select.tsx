'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Select({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('select',className)} {...p}>{children??'select'}</div>}
