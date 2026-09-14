export const runtime = 'edge';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, api: 'webhooks/supabase' });
}

interface WebhookPayload {
  type?: unknown;
  table?: unknown;
  record?: unknown;
  schema?: unknown;
}

export async function POST(req: Request) {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'webhook not configured' }, { status: 500 });
  }

  const provided =
    req.headers.get('x-supabase-webhook-secret') ?? req.headers.get('x-webhook-secret') ?? '';
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let event: WebhookPayload;
  try {
    event = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
  }

  const type = typeof event.type === 'string' ? event.type : 'unknown';
  const table =
    typeof event.table === 'string'
      ? event.table
      : typeof event.schema === 'string'
        ? event.schema
        : 'unknown';
  // Basic event log — no PII beyond what Supabase already sent.
  console.log(`[supabase-webhook] type=${type} table=${table}`);

  return NextResponse.json({ ok: true, received: true });
}
