/**
 * Human-friendly Arabic messages for server-action transport failures.
 * Next.js "Server Action ... was not found on the server" happens when the
 * open page was rendered by a different build than the one currently deployed
 * (e.g. the user kept the tab open across a redeploy). The fix is a page
 * refresh — with the backend draft autosave, nothing is lost.
 */
export function friendlyActionError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (/server action.*not found|failed to find server action|missing server action|action.*digest/i.test(msg)) {
    return (
      'هذه الصفحة من نسخة قديمة بعد تحديث الموقع — اضغط F5 (أو Ctrl+Shift+R) لتحديث الصفحة ثم أعد المحاولة. ' +
      'بياناتك محفوظة في المسودة على الخادم ولن تضيع.'
    );
  }
  if (/fetch failed|failed to fetch|networkerror|network error|load failed/i.test(msg)) {
    return 'تعذر الاتصال بالخادم — تحقق من اتصال الإنترنت ثم أعد المحاولة.';
  }
  return msg || 'خطأ غير متوقع — أعد المحاولة';
}
