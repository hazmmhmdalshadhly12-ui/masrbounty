import { createServerClient } from '@/lib/supabase/server';
import { createReportAction } from '@/features/reports/services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function NewReportPage() {
  const supabase = await createServerClient();
  const { data: programs } = await supabase.from('programs').select('id,name').eq('status', 'active').limit(100);
  return (
    <main className="container py-8 max-w-2xl">
      <Card>
        <CardHeader><CardTitle>تقرير جديد</CardTitle></CardHeader>
        <CardContent>
          <form action={createReportAction} className="space-y-4">
            <div>
              <Label>Program</Label>
              <select name="program_id" required className="w-full h-10 border rounded-md px-3">
                {programs?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><Label>Title (10+ chars)</Label><Input name="title" required minLength={10} /></div>
            <div><Label>Summary</Label><Textarea name="summary" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vuln type</Label><Input name="vulnerability_type" required placeholder="XSS, SQLi, IDOR…" /></div>
              <div><Label>Severity</Label>
                <select name="severity" className="w-full h-10 border rounded-md px-3">
                  <option value="informational">Informational</option><option value="low">Low</option>
                  <option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div><Label>Affected asset</Label><Input name="affected_asset" required placeholder="https://…" dir="ltr" /></div>
            <div><Label>Description</Label><Textarea name="description" required /></div>
            <div><Label>Impact</Label><Textarea name="impact" required /></div>
            <div><Label>Reproduction steps</Label><Textarea name="reproduction_steps" required /></div>
            <div><Label>Remediation (optional)</Label><Textarea name="remediation" /></div>
            <Button type="submit" className="w-full">إنشاء كمسودة</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
