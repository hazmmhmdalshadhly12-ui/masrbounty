'use server';

import { createServerClient } from '@/lib/supabase/server';
import { searchQuerySchema } from './schemas';
import type { SearchHit } from './types';

export async function listSearch(query: string, scope: 'programs' | 'reports' | 'researchers' | 'all' = 'all') {
  const parsed = searchQuerySchema.safeParse({ query, scope });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid search');
  return searchAction(parsed.data.query, parsed.data.scope);
}

export async function searchAction(query: string, scope = 'all'): Promise<SearchHit[]> {
  const parsed = searchQuerySchema.safeParse({ query, scope });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Search query too short');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const q = `%${parsed.data.query}%`;
  const hits: SearchHit[] = [];
  if (parsed.data.scope === 'programs' || parsed.data.scope === 'all') {
    const { data, error } = await supabase
      .from('programs')
      .select('id,name,slug,description,status,created_at')
      .ilike('name', q)
      .eq('status', 'active')
      .limit(10);
    if (error) throw new Error(error.message);
    for (const p of (data ?? []) as { id: string; name: string; slug: string; description: string; status: string; created_at: string }[]) {
      hits.push({ kind: 'program', ...p });
    }
  }
  if (parsed.data.scope === 'reports' || parsed.data.scope === 'all') {
    const { data, error } = await supabase
      .from('reports')
      .select('id,report_number,title,status,severity,created_at')
      .ilike('title', q)
      .limit(10);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { id: string; report_number: string; title: string; status: string; severity: string; created_at: string }[]) {
      hits.push({ kind: 'report', ...r });
    }
  }
  if (parsed.data.scope === 'researchers' || parsed.data.scope === 'all') {
    const { data, error } = await supabase
      .from('researcher_leaderboard')
      .select('researcher_id,display_name,avatar_url,score')
      .ilike('display_name', q)
      .limit(10);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { researcher_id: string; display_name: string; avatar_url: string | null; score: number }[]) {
      hits.push({ kind: 'researcher', id: r.researcher_id, display_name: r.display_name, avatar_url: r.avatar_url, score: r.score });
    }
  }
  return hits;
}
