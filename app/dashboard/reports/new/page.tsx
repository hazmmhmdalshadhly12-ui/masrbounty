import { createServerClient } from '@/lib/supabase/server';
import { ReportCreateForm } from '@/components/reports/report-create-form';

export default async function NewReportPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  const { data: rp } = user.user
    ? await supabase.from('researcher_profiles').select('id').eq('user_id', user.user.id).single()
    : { data: null };
  const { data: invited } = rp
    ? await supabase.from('program_researchers').select('program_id').eq('researcher_id', (rp as { id: string }).id)
    : { data: [] };
  const invitedIds = (invited ?? []).map((i: { program_id: string }) => i.program_id);
  // Public active programs + exactly the private ones this researcher is
  // invited to (queried by id — no limit-window dropping of invited programs).
  const publicActive = supabase
    .from('programs')
    .select('id,name,visibility')
    .eq('status', 'active')
    .eq('visibility', 'public')
    .order('name')
    .limit(500);
  const invitedActive =
    invitedIds.length > 0
      ? supabase.from('programs').select('id,name,visibility').eq('status', 'active').in('id', invitedIds)
      : Promise.resolve({ data: [] } as unknown as { data: { id: string; name: string; visibility: string }[] | null });
  const [{ data: publicPrograms }, { data: invitedPrograms }] = await Promise.all([publicActive, invitedActive]);
  const seen = new Set<string>();
  const allowed: { id: string; name: string; visibility: string }[] = [];
  for (const p of [...(publicPrograms ?? []), ...(invitedPrograms ?? [])] as { id: string; name: string; visibility: string }[]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    allowed.push(p);
  }
  return (
    <div className="py-2">
      <ReportCreateForm programs={allowed} />
    </div>
  );
}
