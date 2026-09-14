'use client';

import type { Report, ReportComment } from './types';

export function ReportsView({ reports }: { reports: Report[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="font-medium">No reports yet</p>
        <p className="text-sm text-muted-foreground">Submitted reports will appear here.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-lg border">
      {reports.map((r) => (
        <li key={r.id} className="p-3">
          <p className="font-medium">
            {r.report_number} · {r.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {r.status} · {r.severity}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ReportCommentList({ comments }: { comments: ReportComment[] }) {
  if (comments.length === 0) return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  return (
    <ul className="space-y-2">
      {comments.map((c) => (
        <li key={c.id} className="rounded-lg border p-2 text-sm">
          <p>{c.body}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {c.is_internal ? 'Internal · ' : ''}
            {new Date(c.created_at).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
