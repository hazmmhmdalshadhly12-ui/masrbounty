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

export type TxtStatus = 'found' | 'wrong_value' | 'no_records' | 'nxdomain' | 'resolver_error';

export type TxtDiagnostics = {
  found: boolean;
  host?: string;
  status: TxtStatus;
  /** Number of TXT records seen on the best host (when a resolver answered). */
  txtCount?: number;
  /** True when BOTH resolvers were unreachable/timed out for every host. */
  resolversUnavailable?: boolean;
};

type ResolveResult = { records: string[]; responded: boolean; status: TxtStatus };

async function resolveTxtWithStatus(host: string, timeoutMs = 6000): Promise<ResolveResult> {
  const name = host.trim().toLowerCase().replace(/\.$/, '');
  if (!HOST_RE.test(name) && !/^_[a-z0-9-]+\./i.test(name)) {
    return { records: [], responded: true, status: 'no_records' };
  }
  for (const base of RESOLVERS) {
    try {
      const res = await fetch(`${base}?name=${encodeURIComponent(name)}&type=TXT`, {
        headers: { accept: 'application/dns-json' },
        // no `cache` field here — Cloudflare Workers throws on it
        signal: timeoutSignal(timeoutMs),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as DohResponse;
      if (json.Status === 3) return { records: [], responded: true, status: 'nxdomain' };
      if (json.Status !== 0) return { records: [], responded: true, status: 'resolver_error' };
      return {
        records: (json.Answer ?? []).filter((a) => a.type === 16).map((a) => normalizeTxt(a.data)),
        responded: true,
        status: 'no_records',
      };
    } catch {
      /* resolver unreachable — try next */
    }
  }
  return { records: [], responded: false, status: 'resolver_error' };
}

/** Back-compat plain TXT lookup. */
export async function resolveTxt(host: string, timeoutMs = 6000): Promise<string[]> {
  return (await resolveTxtWithStatus(host, timeoutMs)).records;
}

/** The only DNS values we accept for verification: the record IS the token,
 *  or it contains the documented `masrbounty-verification=<token>` sentence.
 *  Random TXT content that merely embeds the token is rejected. */
function recordMatches(record: string, token: string): boolean {
  const r = record.trim().replace(/^"+|"+$/g, '').trim();
  return r === token || r.includes(`masrbounty-verification=${token}`);
}

const STATUS_PRIORITY: Record<TxtStatus, number> = {
  found: 4,
  wrong_value: 3,
  no_records: 2,
  nxdomain: 1,
  resolver_error: 0,
};

function better(a: TxtStatus, b: TxtStatus): TxtStatus {
  return STATUS_PRIORITY[b] > STATUS_PRIORITY[a] ? b : a;
}

/**
 * Diagnostic TXT check on `_masrbounty.<domain>` then the apex. Always returns
 * a precise status so the UI can tell the user WHY verification failed instead
 * of a bare "فشل التحقق":
 *  - found: token located (host is reported)
 *  - wrong_value: TXT records exist on the host but none matches the sentence
 *  - no_records: host exists but has no TXT records at all
 *  - nxdomain: the queried name (incl. the apex) does not exist
 *  - resolver_error: both DoH resolvers unreachable/timed out
 */
export async function checkVerificationTxt(domain: string, token: string): Promise<TxtDiagnostics> {
  const hosts = [`_masrbounty.${domain}`, domain];
  let anyResponded = false;
  let best: TxtStatus = 'resolver_error';
  let bestCount: number | undefined;
  for (const host of hosts) {
    const r = await resolveTxtWithStatus(host);
    if (r.responded) anyResponded = true;
    if (r.records.some((txt) => recordMatches(txt, token))) {
      return { found: true, host, status: 'found', txtCount: r.records.length };
    }
    const hostStatus: TxtStatus = r.records.length > 0 ? 'wrong_value' : r.status;
    if (STATUS_PRIORITY[hostStatus] > STATUS_PRIORITY[best]) {
      best = hostStatus;
      bestCount = r.records.length || undefined;
    }
  }
  return {
    found: false,
    status: anyResponded ? best : 'resolver_error',
    txtCount: bestCount,
    resolversUnavailable: !anyResponded,
  };
}

/** Back-compat wrapper: true when any TXT record on `_masrbounty.<domain>` or
 *  `<domain>` matches the verification sentence (see recordMatches). */
export async function hasVerificationTxt(
  domain: string,
  token: string
): Promise<{ found: boolean; host?: string }> {
  const diag = await checkVerificationTxt(domain, token);
  return diag.found ? { found: true, host: diag.host } : { found: false };
}
