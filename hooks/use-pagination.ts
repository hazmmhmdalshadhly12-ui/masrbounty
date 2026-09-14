'use client';

import { useCallback, useMemo, useState } from 'react';

// ترقيم صفحات خالص من جهة العميل — بلا جلب بيانات
export interface PaginationOptions {
  initialPage?: number;
  pageSize?: number;
  totalItems?: number;
}

export function usePagination(options?: PaginationOptions) {
  const [page, setPageState] = useState(Math.max(1, options?.initialPage ?? 1));
  const [pageSize, setPageSizeState] = useState(options?.pageSize ?? 10);
  const [totalItems, setTotalItems] = useState(options?.totalItems ?? 0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize))),
    [totalItems, pageSize],
  );

  const setPage = useCallback(
    (next: number) => {
      setPageState(Math.min(Math.max(1, next), totalPages));
    },
    [totalPages],
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(Math.max(1, size));
    setPageState(1);
  }, []);

  const nextPage = useCallback(() => {
    setPageState((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPageState((p) => Math.max(1, p - 1));
  }, []);

  const reset = useCallback(() => {
    setPageState(1);
  }, []);

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    offset,
    limit: pageSize,
    setPage,
    setPageSize,
    setTotalItems,
    nextPage,
    prevPage,
    reset,
  };
}
