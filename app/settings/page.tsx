import { redirect } from 'next/navigation';

// Canonical settings live under the dashboard shell; keep one implementation.
export default function SettingsAlias() {
  redirect('/dashboard/settings');
}
