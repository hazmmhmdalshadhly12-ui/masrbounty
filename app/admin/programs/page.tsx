import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { AppWindow, CheckCircle2, XCircle, Pause, Play, Eye } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function staff() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  return { supabase, user: user.user };
}

async function programAction(programId: string, action: 'approve' | 'reject' | 'pause' | 'activate', formData: FormData) {
  'use server';
  const { supabase, user } = await staff();
  const reason = String(formData.get(`reason_${programId}`) ?? '').trim() || null;
  let nextStatus: string | null = null;
  if (action === 'approve') nextStatus = 'active';
  if (action === 'activate') nextStatus = 'active';
  if (action === 'pause') nextStatus = 'paused';
  if (action === 'reject') nextStatus = 'closed';

  if (nextStatus) {
    const { error } = await supabase.from('programs').update({ status: nextStatus }).eq('id', programId);
    if (error) throw new Error(error.message);
  }

  await supabase.from('moderation_actions').insert({
    moderator_id: user.id,
    target_type: 'program',
    target_id: programId,
    action,
    reason,
  });

  // audit + optional notification to company owner
  await logAudit('moderate', 'programs', programId, { action, nextStatus, reason }, user.id);
  try {
    const { data: prog } = await supabase.from('programs').select('company_id,name').eq('id', programId).single();
    if (prog) {
      const { data: cp } = await supabase.from('company_profiles').select('owner_id').eq('id', (prog as { company_id: string }).company_id).single();
      if (cp) {
        const { notify } = await import('@/lib/notify');
        await notify(supabase, (cp as { owner_id: string }).owner_id, {
          type: 'program',
          title: action === 'approve' ? `تم اعتماد برنامجكم ${prog.name}` : `تحديث حالة برنامج ${prog.name}: ${nextStatus}`,
          body: reason ?? undefined,
          link: `/company/programs/${programId}`,
        });
      }
    }
  } catch {
    /* best effort */
  }

  revalidatePath('/admin/programs');
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  pending_review: 'secondary',
  active: 'default',
  paused: 'outline',
  closed: 'destructive',
};

const statusAr: Record<string, string> = {
  draft: 'مسودة',
  pending_review: 'بانتظار المراجعة',
  active: 'نشط',
  paused: 'موقوف',
  closed: 'مغلق',
};

export default async function AdminPrograms({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = 'all', q = '' } = await searchParams;
  const supabase = await createServerClient();

  let query = supabase
    .from('programs')
    .select('id,name,slug,status,visibility,created_at,company_id,company_profiles!inner(name,slug)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (['draft', 'pending_review', 'active', 'paused', 'closed'].includes(status)) {
    query = query.eq('status', status);
  }
  if (q.trim()) {
    query = query.ilike('name', `%${q.trim().replace(/[%_\\]/g, '\\$&')}%`);
  }

  const { data: programs, error } = await query;
  const rows = (programs ?? []) as unknown as {
    id: string;
    name: string;
    slug: string;
    status: string;
    visibility: string;
    created_at: string;
    company_id: string;
    company_profiles: { name: string; slug: string };
  }[];

  const counts = await Promise.all(
    ['pending_review', 'active', 'paused', 'closed', 'draft'].map(async (s) =>
      supabase.from('programs').select('id', { count: 'exact', head: true }).eq('status', s).then((r) => ({ s, n: r.count ?? 0 }))
    )
  );

  return (
    <div className="space-y-6 py-2" dir="rtl">
      <PageHeader icon={AppWindow} title="إدارة البرامج" desc="مراجعة البرامج — اعتماد، رفض، إيقاف مؤقت، مع سجل تدقيق" />

      <Card>
        <CardContent className="flex flex-wrap gap-2 pt-6">
          <a href="/admin/programs?status=all" className={`rounded-full border px-3 py-1.5 text-xs font-bold ${status === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-accent'}`}>
            الكل
          </a>
          {counts.map((c) => (
            <a
              key={c.s}
              href={`/admin/programs?status=${c.s}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${status === c.s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-accent'}`}
            >
              {statusAr[c.s] ?? c.s} ({c.n})
            </a>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>البرامج ({rows.length})</CardTitle>
          <CardDescription>
            اعرض البرنامج قبل اتخاذ إجراء — الاعتماد ينشره للعامة، الإيقاف يعلقه مؤقتًا، الرفض يغلقه.
          </CardDescription>
          <form className="flex gap-2 pt-2">
            <Input name="q" defaultValue={q} placeholder="بحث باسم البرنامج…" className="h-9 max-w-xs" />
            <input type="hidden" name="status" value={status} />
            <Button size="sm" variant="outline" type="submit">
              بحث
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          {!rows.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد برامج بهذه الحالة.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="p-2 text-right">البرنامج</th>
                    <th className="p-2 text-right">الشركة</th>
                    <th className="p-2 text-right">الحالة</th>
                    <th className="p-2 text-right">الرؤية</th>
                    <th className="p-2 text-right">تاريخ الإنشاء</th>
                    <th className="p-2 text-right">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="p-2">
                        <span className="font-bold">{p.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground" dir="ltr">
                          {p.slug}
                        </span>
                      </td>
                      <td className="p-2 text-xs font-medium">{p.company_profiles?.name ?? p.company_id.slice(0, 8)}</td>
                      <td className="p-2">
                        <Badge variant={statusVariant[p.status] ?? 'secondary'}>{statusAr[p.status] ?? p.status}</Badge>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">{p.visibility === 'public' ? 'عام' : 'خاص'}</Badge>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Link href={`/programs/${p.slug}`} target="_blank">
                            <Button size="sm" variant="outline">
                              <Eye className="ml-1 h-3 w-3" /> عرض
                            </Button>
                          </Link>
                          {p.status === 'pending_review' && (
                            <>
                              <form action={programAction.bind(null, p.id, 'approve')} className="flex gap-1">
                                <Input name={`reason_${p.id}`} placeholder="ملاحظة (اختياري)" className="h-8 w-28 text-xs" />
                                <Button size="sm" type="submit" formAction={programAction.bind(null, p.id, 'approve')} className="bg-emerald-600 text-white hover:bg-emerald-700">
                                  <CheckCircle2 className="ml-1 h-3 w-3" /> اعتماد
                                </Button>
                              </form>
                              <form action={programAction.bind(null, p.id, 'reject')} className="flex gap-1">
                                <Input name={`reason_${p.id}`} placeholder="سبب الرفض" className="h-8 w-28 text-xs" />
                                <Button size="sm" variant="destructive" type="submit" formAction={programAction.bind(null, p.id, 'reject')}>
                                  <XCircle className="ml-1 h-3 w-3" /> رفض
                                </Button>
                              </form>
                            </>
                          )}
                          {p.status === 'active' && (
                            <form action={programAction.bind(null, p.id, 'pause')} className="flex gap-1">
                              <Input name={`reason_${p.id}`} placeholder="سبب الإيقاف" className="h-8 w-28 text-xs" />
                              <Button size="sm" variant="outline" type="submit" formAction={programAction.bind(null, p.id, 'pause')}>
                                <Pause className="ml-1 h-3 w-3" /> إيقاف
                              </Button>
                            </form>
                          )}
                          {p.status === 'paused' && (
                            <form action={programAction.bind(null, p.id, 'activate')} className="flex gap-1">
                              <Input name={`reason_${p.id}`} placeholder="ملاحظة" className="h-8 w-28 text-xs" />
                              <Button size="sm" type="submit" formAction={programAction.bind(null, p.id, 'activate')} className="bg-emerald-600 text-white hover:bg-emerald-700">
                                <Play className="ml-1 h-3 w-3" /> تفعيل
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
