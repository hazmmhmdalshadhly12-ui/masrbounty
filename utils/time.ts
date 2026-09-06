/** Short relative timestamps (ar): "منذ 5 دقائق". Falls back to date. */
export function timeAgo(iso: string, locale = 'ar-EG'): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 10) return locale.startsWith('ar') ? 'الآن' : 'now';
  const units: [number, string, string][] = [
    [31536000, 'سنة', 'سنوات'],
    [2592000, 'شهر', 'أشهر'],
    [604800, 'أسبوع', 'أسابيع'],
    [86400, 'يوم', 'أيام'],
    [3600, 'ساعة', 'ساعات'],
    [60, 'دقيقة', 'دقائق'],
  ];
  for (const [div, one, many] of units) {
    if (s >= div) {
      const n = Math.floor(s / div);
      const word = n === 1 ? one : n === 2 ? (div === 86400 ? 'يومين' : div === 3600 ? 'ساعتين' : div === 60 ? 'دقيقتين' : many) : many;
      return locale.startsWith('ar') ? `منذ ${n} ${word}` : `${n} ${word} ago`;
    }
  }
  return `منذ ${s} ثانية`;
}

export function formatDate(iso: string, locale = 'ar-EG'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}
