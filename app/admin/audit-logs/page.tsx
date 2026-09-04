import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';

export default async function AuditLogs() {
  const supabase = createServerClient();
  const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">سجلات التدقيق</h1>
      {!data?.length ? <p className="text-muted-foreground">No logs (admin only via RLS).</p> :
        data.map((l) => <Card key={l.id} className="mb-2"><CardContent className="p-3 text-sm">{l.action} — {l.entity} — {String(l.created_at)}</CardContent></Card>)}
    </main>
  );
}
