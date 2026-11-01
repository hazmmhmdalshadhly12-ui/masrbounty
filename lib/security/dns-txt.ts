/**
 * DNS TXT lookup over HTTPS (RFC 8484 JSON API).
 * Replaces `node:dns/promises` so domain verification works on every runtime
 * (Node, Vercel Edge, Cloudflare Workers). Tries Cloudflare then Google.
 */

const RESOLVERS = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve'];
const HOST_RE =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,63}$/i;

function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined;
}

type DohAnswer = { type: number; data: string };
type DohResponse = { Status: number; Answer?: DohAnswer[] };

/** Strip the quoting DoH returns and join split TXT chunks. */
export function normalizeTxt(data: string): string {
  const parts = data.match(/"((?:[^"\\]|\\.)*)"/g);
  if (!parts) return data.trim();
  return parts.map((p) => p.slice(1, -1).replace(/\\"/g, '"')).join('');
}

export async function resolveTxt(host: string, timeoutMs = 6000): Promise<string[]> {
  const name = host.trim().toLowerCase().replace(/\.$/, '');
  if (!HOST_RE.test(name) && !/^_[a-z0-9-]+\./i.test(name)) return [];
  for (const base of RESOLVERS) {
    try {
      const res = await fetch(`${base}?name=${encodeURIComponent(name)}&type=TXT`, {
        headers: { accept: 'application/dns-json' },
        cache: 'no-store',
        signal: timeoutSignal(timeoutMs),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as DohResponse;
      if (json.Status !== 0) return []; // NXDOMAIN / SERVFAIL etc.
      return (json.Answer ?? []).filter((a) => a.type === 16).map((a) => normalizeTxt(a.data));
    } catch {
      /* resolver unreachable — try next */
    }
  }
  return [];
}

/** True when any TXT record on `_masrbounty.<domain>` or `<domain>` contains the token. */
export async function hasVerificationTxt(
  domain: string,
  token: string
): Promise<{ found: boolean; host?: string }> {
  for (const host of [`_masrbounty.${domain}`, domain]) {
    const records = await resolveTxt(host);
    if (records.some((txt) => txt.includes(token))) return { found: true, host };
  }
  return { found: false };
}
