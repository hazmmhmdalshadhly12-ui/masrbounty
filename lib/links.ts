/** Only same-app paths may be rendered as navigation links (open-redirect/XSS guard). */
export function isInternalLink(href: string | null | undefined): href is string {
  if (!href) return false;
  return href.startsWith('/') && !href.startsWith('//') && !href.includes('://') && !href.includes('\\');
}
