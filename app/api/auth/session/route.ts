export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const sb = await createServerClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const userId = auth.user.id;
    const [{ data: profile }, { data: roles }, { data: researcher }, { data: owned }, { data: memberships }] =
      await Promise.all([
        sb.from('profiles').select('id,username,full_name,avatar_url,bio,locale,theme,is_active,created_at').eq('id', userId).maybeSingle(),
        sb.from('user_roles').select('role').eq('user_id', userId),
        sb.from('researcher_profiles').select('id,display_name,country,is_public').eq('user_id', userId).maybeSingle(),
        sb.from('company_profiles').select('id,name,slug,is_verified').eq('owner_id', userId),
        sb.from('company_members').select('company_id,role').eq('user_id', userId),
      ]);

    const roleNames = ((roles as { role: string }[] | null) ?? []).map((r) => r.role);
    return NextResponse.json({
      ok: true,
      user: { id: auth.user.id, email: auth.user.email ?? null },
      profile: profile ?? null,
      roles: roleNames,
      researcher: researcher ?? null,
      ownedCompanies: owned ?? [],
      memberships: memberships ?? [],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unexpected' }, { status: 500 });
  }
}
