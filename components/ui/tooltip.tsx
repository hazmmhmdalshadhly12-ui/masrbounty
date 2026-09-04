'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Tooltip({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('tooltip',className)} {...p}>{children??'tooltip'}</div>}
