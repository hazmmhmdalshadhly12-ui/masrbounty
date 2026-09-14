'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface TablePaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  canPreviousPage?: boolean;
  canNextPage?: boolean;
}

function TablePagination({
  page,
  pageCount,
  onPageChange,
  canPreviousPage,
  canNextPage,
  className,
  ...props
}: TablePaginationProps) {
  const prevDisabled = canPreviousPage ?? page <= 1;
  const nextDisabled = canNextPage ?? page >= pageCount;
  const go = (next: number) => {
    const clamped = Math.min(Math.max(1, next), Math.max(1, pageCount));
    onPageChange(clamped);
  };
  return (
    <div className={cn('flex items-center justify-between gap-2 px-2 py-3', className)} {...props}>
      <p className="text-sm text-muted-foreground">
        Page <span className="font-medium tabular-nums text-foreground">{page}</span> of{' '}
        <span className="font-medium tabular-nums text-foreground">{Math.max(1, pageCount)}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={prevDisabled} onClick={() => go(1)} aria-label="First page">
          <ChevronsRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={prevDisabled} onClick={() => go(page - 1)} aria-label="Previous page">
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={nextDisabled} onClick={() => go(page + 1)} aria-label="Next page">
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={nextDisabled} onClick={() => go(pageCount)} aria-label="Last page">
          <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}

export { TablePagination };
