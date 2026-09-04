'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Form({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('form',className)} {...p}>{children??'form'}</div>}
