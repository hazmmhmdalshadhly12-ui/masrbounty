'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Tabs({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('tabs',className)} {...p}>{children??'tabs'}</div>}
