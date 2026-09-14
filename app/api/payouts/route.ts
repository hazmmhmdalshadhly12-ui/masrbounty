export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

async function researcherIdFor(sb: Awaited<ReturnType<typeof createServerClient>>, userId: string) {
  const { data, error } = await sb.from('researcher_profiles').select('id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  const id = (data as { id: string } | null)?.id;
  if (!id) throw new Error('researcher profile not found');
  return id;
}

export async function GET(req: Request) {
  try {
    const sb = await createServerClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get('limit') ?? 20) || 20, 1), 50);
    let researcherId: string;
    try {
      researcherId = await researcherIdFor(sb, auth.user.id);
    } catch {
      return NextResponse.json({ ok: true, items: [] });
    }

    const { data, error } = await sb
      .from('payout_requests')
      .select('id,amount,status,payment_method_id,reviewed_by,review_note,created_at,updated_at')
      .eq('researcher_id', researcherId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sb = await createServerClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    let body: { amount?: unknown; payment_method_id?: unknown };
    try {
      body = (await req.json()) as { amount?: unknown; payment_method_id?: unknown };
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid JSON body' }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'amount must be a positive number' }, { status: 400 });
    }
    const paymentMethodId =
      typeof body.payment_method_id === 'string' && body.payment_method_id.trim()
        ? body.payment_method_id.trim()
        : null;

    const researcherId = await researcherIdFor(sb, auth.user.id);

    if (paymentMethodId) {
      const { data: pm, error: pmError } = await sb
        .from('payment_methods')
        .select('id')
        .eq('id', paymentMethodId)
        .eq('researcher_id', researcherId)
        .maybeSingle();
      if (pmError) return NextResponse.json({ ok: false, error: pmError.message }, { status: 500 });
      if (!pm) return NextResponse.json({ ok: false, error: 'payment method not found' }, { status: 404 });
    }

    const { data: wallet, error: wError } = await sb
      .from('wallets')
      .select('id,balance')
      .eq('researcher_id', researcherId)
      .maybeSingle();
    if (wError) return NextResponse.json({ ok: false, error: wError.message }, { status: 500 });
    if (!wallet) return NextResponse.json({ ok: false, error: 'wallet not found' }, { status: 404 });

    const balance = Number((wallet as { balance: number | string }).balance);
    if (!Number.isFinite(balance) || balance < amount) {
      return NextResponse.json({ ok: false, error: 'insufficient balance' }, { status: 400 });
    }

    const { data: created, error: cError } = await sb
      .from('payout_requests')
      .insert({ researcher_id: researcherId, amount, payment_method_id: paymentMethodId })
      .select('id,amount,status,payment_method_id,created_at')
      .single();
    if (cError) return NextResponse.json({ ok: false, error: cError.message }, { status: 500 });
    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unexpected';
    const status = msg === 'researcher profile not found' ? 404 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
