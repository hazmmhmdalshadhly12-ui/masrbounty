'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Separator({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('separator',className)} {...p}>{children??'separator'}</div>}
