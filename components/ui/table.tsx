'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Table({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('table',className)} {...p}>{children??'table'}</div>}
