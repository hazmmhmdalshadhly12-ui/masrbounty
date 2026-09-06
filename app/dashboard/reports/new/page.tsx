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
  // Public programs + private ones this researcher is invited to — nothing else
  let query = supabase.from('programs').select('id,name,visibility').eq('status', 'active').limit(100);
  const { data: programs } = await query;
  const allowed = (programs ?? []).filter(
    (p: { id: string; visibility: string }) => p.visibility === 'public' || invitedIds.includes(p.id)
  );
  return (
    <main className="py-2">
      <ReportCreateForm programs={allowed} />
    </main>
  );
}
