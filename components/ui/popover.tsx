'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Popover({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('popover',className)} {...p}>{children??'popover'}</div>}
