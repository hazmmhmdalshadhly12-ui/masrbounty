'use client';

import type { SessionUser } from './types';

export function AuthView({ user }: { user: SessionUser | null }) {
  if (!user) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-sm text-muted-foreground">You are not signed in.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border p-4">
      <p className="font-medium">{user.username ?? user.email ?? 'Account'}</p>
      <p className="text-sm text-muted-foreground">
        {user.roles.length > 0 ? user.roles.join(', ') : 'researcher'}
      </p>
    </div>
  );
}

export function AuthStatus({ isLoading, isAuthenticated }: { isLoading: boolean; isAuthenticated: boolean }) {
  if (isLoading) return <p className="text-sm text-muted-foreground">Checking session…</p>;
  return <p className="text-sm text-muted-foreground">{isAuthenticated ? 'Signed in' : 'Signed out'}</p>;
}
