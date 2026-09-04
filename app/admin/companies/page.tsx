import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

async function reviewVerification(verifId: string, companyId: string, approve: boolean, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const note = String(formData.get(`note_${verifId}`) ?? '');
  await supabase
    .from('company_verifications')
    .update({ status: approve ? 'approved' : 'rejected', reviewed_by: user.user.id, review_note: note || null })
    .eq('id', verifId);
  if (approve) {
    await supabase.from('company_profiles').update({ is_verified: true }).eq('id', companyId);
  }
  await logAudit('verify', 'company_verifications', verifId, { approve, company_id: companyId }, user.user.id);
  revalidatePath('/admin/companies');
}

export default async function AdminCompanies() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('company_profiles').select('id,name,slug,is_verified').limit(100);
  const { data: verifs } = await supabase
    .from('company_verifications')
    .select('id,company_id,status,document_url,created_at,company_profiles(name)')
    .eq('status', 'pending')
    .order('created_at');
  return (
    <div className="py-2">
      <h1 className="mb-6 text-xl font-black tracking-tight">الشركات ({data?.length ?? 0})</h1>
      <Card className="mb-6">
        <CardHeader><CardTitle>طلبات التوثيق المعلقة ({verifs?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {!verifs?.length ? (
            <p className="text-sm text-muted-foreground">لا توجد طلبات معلقة.</p>
          ) : (
            ((verifs ?? []) as unknown as { id: string; company_id: string; document_url: string | null; company_profiles: { name: string } | null }[]).map((v) => (
              <form key={v.id} className="mb-3 flex flex-wrap items-center gap-2 border-b pb-3">
                <span className="text-sm font-bold">{v.company_profiles?.name}</span>
                {v.document_url && (
                  <a href={v.document_url} target="_blank" rel="noreferrer" className="text-xs underline" dir="ltr">
                    المستند
                  </a>
                )}
                <Input name={`note_${v.id}`} placeholder="ملاحظة المراجعة" className="h-9 max-w-xs" />
                <Button size="sm" type="submit" formAction={reviewVerification.bind(null, v.id, v.company_id, true)}>
                  اعتماد
                </Button>
                <Button size="sm" variant="outline" type="submit" formAction={reviewVerification.bind(null, v.id, v.company_id, false)}>
                  رفض
                </Button>
              </form>
            ))
          )}
        </CardContent>
      </Card>
      {data?.map((c) => (
        <Card key={c.id} className="mb-2">
          <CardContent className="flex justify-between p-3">
            <span className="text-sm">{c.name} <span className="text-muted-foreground" dir="ltr">({c.slug})</span></span>
            {c.is_verified ? <Badge>موثقة</Badge> : <Badge variant="secondary">غير موثقة</Badge>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
