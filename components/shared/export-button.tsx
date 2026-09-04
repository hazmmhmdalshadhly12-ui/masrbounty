'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toCSV } from '@/utils/csv';

export function ExportButton({ rows, filename }: { rows: Record<string, unknown>[]; filename: string }) {
  function download() {
    if (!rows.length) return;
    const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button size="sm" variant="outline" onClick={download} disabled={!rows.length}>
      <Download className="h-4 w-4" /> تصدير CSV
    </Button>
  );
}
