'use client';

import type { AdminDashboardStats, AuditLog } from './types';

export function AdminView({ stats }: { stats: AdminDashboardStats }) {
  const cards: { label: string; value: number }[] = [
    { label: 'Users', value: stats.totalUsers },
    { label: 'Programs', value: stats.totalPrograms },
    { label: 'Reports', value: stats.totalReports },
    { label: 'Pending reports', value: stats.pendingReports },
    { label: 'Pending payouts', value: stats.totalPayoutsPending },
    { label: 'Open disputes', value: stats.openDisputes },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">{c.label}</p>
          <p className="text-2xl font-bold">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export function AuditLogList({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) return <p className="text-sm text-muted-foreground">No audit activity yet.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {logs.map((log) => (
        <li key={log.id} className="flex items-center justify-between gap-4 p-3 text-sm">
          <span>
            <strong>{log.action}</strong> on {log.entity}
          </span>
          <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
