'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * GoTrue reports expired/reused email links in the URL hash fragment
 * (`#error=access_denied&error_code=otp_expired&...`), and fragments are
 * never sent to the server. Mounted on the login page, this converts such
 * fragments into a proper `?error=` message (or just cleans the URL when a
 * server-side message is already displayed) so users always see why their
 * recovery link failed.
 */
export function AuthHashError() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('error=')) return;
    const params = new URLSearchParams(hash.slice(1));
    const subCode = (params.get('error_code') ?? '').toLowerCase();
    const generic = (params.get('error') ?? '').toLowerCase();
    const description = (params.get('error_description') ?? '').toLowerCase();
    const message =
      subCode === 'otp_expired' ||
      generic.includes('expired') ||
      description.includes('expired') ||
      description.includes('already used')
        ? 'انتهت صلاحية رابط الاستعادة أو استُخدم مسبقًا — اطلب رابطًا جديدًا'
        : 'رابط غير صالح أو منتهي — اطلب رابطًا جديدًا';
    const current = new URLSearchParams(window.location.search);
    if (!current.get('error') && !current.get('ok')) {
      router.replace('/login?error=' + encodeURIComponent(message));
    } else {
      // A server-side message is already visible; strip the stale fragment.
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [router]);
  return null;
}
