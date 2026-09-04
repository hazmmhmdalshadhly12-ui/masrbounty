'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function Accordion({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('accordion',className)} {...p}>{children??'accordion'}</div>}
