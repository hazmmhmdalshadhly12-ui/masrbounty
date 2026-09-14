export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const sb = await createServerClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get('limit') ?? 20) || 20, 1), 50);

    const { data: rp, error: rpError } = await sb
      .from('researcher_profiles')
      .select('id')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (rpError) return NextResponse.json({ ok: false, error: rpError.message }, { status: 500 });
    const researcherId = (rp as { id: string } | null)?.id;
    if (!researcherId) return NextResponse.json({ ok: false, error: 'researcher profile not found' }, { status: 404 });

    const { data: wallet, error: wError } = await sb
      .from('wallets')
      .select('id,researcher_id,balance,pending_balance,total_earned,created_at,updated_at')
      .eq('researcher_id', researcherId)
      .maybeSingle();
    if (wError) return NextResponse.json({ ok: false, error: wError.message }, { status: 500 });
    if (!wallet) return NextResponse.json({ ok: false, error: 'wallet not found' }, { status: 404 });

    const walletId = (wallet as { id: string }).id;
    const { data: transactions, error: tError } = await sb
      .from('wallet_transactions')
      .select('id,type,amount,balance_after,reference_id,note,created_at')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (tError) return NextResponse.json({ ok: false, error: tError.message }, { status: 500 });

    return NextResponse.json({ ok: true, wallet, transactions: transactions ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 });
  }
}
