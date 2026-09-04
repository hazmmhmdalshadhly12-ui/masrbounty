'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Avatar({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('avatar',className)} {...p}>{children??'avatar'}</div>}
