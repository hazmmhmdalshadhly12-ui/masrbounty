/** Minimal RFC-4180 CSV serializer. Pure. */

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const h = Object.keys(rows[0] as Record<string, unknown>);
  return [h.join(','), ...rows.map((r) => h.map((k) => escapeCell(r[k])).join(','))].join('\n');
}
