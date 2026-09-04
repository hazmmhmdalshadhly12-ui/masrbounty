'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Alert({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('alert',className)} {...p}>{children??'alert'}</div>}
