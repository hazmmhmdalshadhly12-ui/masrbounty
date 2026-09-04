'use client'
import * as React from 'react';
import { cn } from '@/lib/utils';
export function DropdownMenu({className,children,...p}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('dropdown-menu',className)} {...p}>{children??'dropdown-menu'}</div>}
