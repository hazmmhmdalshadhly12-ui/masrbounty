import { createServerClient } from '@/lib/supabase/server';
import { ReportCreateForm } from '@/components/reports/report-create-form';

export default async function NewReportPage() {
  const supabase = await createServerClient();
  const { data: programs } = await supabase.from('programs').select('id,name').eq('status', 'active').limit(100);
  return (
    <main className="py-2">
      <ReportCreateForm programs={programs ?? []} />
    </main>
  );
}
