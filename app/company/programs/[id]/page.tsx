import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { notify } from '@/lib/notify';
import { requireCompanyRole } from '@/features/company/services';
import { checkPublishReadiness, publishProgramAction, pauseProgramAction, resumeProgramAction, closeProgramAction } from '@/features/programs/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AssetManager } from '@/components/programs/asset-manager';

async function addAsset(id: string, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  await requireCompanyRole(id);
  await supabase.from('program_assets').insert({ program_id: id, type: String(formData.get('type')), value: String(formData.get('value')) });
  revalidatePath(`/company/programs/${id}`);
}

async function addRule(id: string, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  await requireCompanyRole(id);
  await supabase.from('program_rules').insert({ program_id: id, title: String(formData.get('title')), content: String(formData.get('content')) });
  revalidatePath(`/company/programs/${id}`);
}

async function saveBounty(id: string, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const severity = String(formData.get('severity'));
  const min = Number(formData.get('min_amount'));
  const max = Number(formData.get('max_amount'));
  if (!severity || !(min >= 0) || !(max >= min)) throw new Error('Invalid bounty range');
  await requireCompanyRole(id);
  await supabase
    .from('bounty_policies')
    .upsert({ program_id: id, severity, min_amount: min, max_amount: max }, { onConflict: 'program_id,severity' });
  revalidatePath(`/company/programs/${id}`);
}

async function deleteRule(ruleId: string, programId: string) {
  'use server';
  const supabase = await createServerClient();
  await requireCompanyRole(programId);
  await supabase.from('program_rules').delete().eq('id', ruleId);
  revalidatePath(`/company/programs/${programId}`);
}

async function deleteAsset(assetId: string, programId: string) {
  'use server';
  const supabase = await createServerClient();
  await requireCompanyRole(programId);
  await supabase.from('program_assets').delete().eq('id', assetId);
  revalidatePath(`/company/programs/${programId}`);
}

async function publishUpdate(programId: string, formData: FormData) {
  'use server';
  const { notify } = await import('@/lib/notify');
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const title = String(formData.get('title') ?? '').trim().slice(0, 120);
  const body = String(formData.get('body') ?? '').trim();
  if (!title || !body) throw new Error('Title and body required');
  await requireCompanyRole(programId);
  const { data: program } = await supabase.from('programs').select('name').eq('id', programId).single();
  await supabase.from('program_updates').insert({ program_id: programId, title, body, created_by: user.user.id });
  const { data: savers } = await supabase
    .from('saved_programs')
    .select('researcher_profiles!inner(user_id)')
    .eq('program_id', programId);
  for (const s of (savers ?? []) as unknown as { researcher_profiles: { user_id: string } }[]) {
    await notify(supabase, s.researcher_profiles.user_id, {
      type: 'program',
      title: `تحديث جديد في ${program?.name ?? 'برنامج'}: ${title}`,
      body: body.slice(0, 140),
      link: `/programs`,
    });
  }
  revalidatePath(`/company/programs/${programId}`);
}

async function inviteResearcher(programId: string, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const username = String(formData.get('username') ?? '').trim().replace(/^@/, '');
  if (!username) throw new Error('Username required');
  await requireCompanyRole(programId);
  const { data: profile } = await supabase.from('profiles').select('id').eq('username', username).single();
  if (!profile) throw new Error('User not found');
  const { data: rp } = await supabase.from('researcher_profiles').select('id').eq('user_id', profile.id).single();
  if (!rp) throw new Error('Not a researcher');
  await supabase.from('program_researchers').upsert({ program_id: programId, researcher_id: rp.id }, { onConflict: 'program_id,researcher_id' });
  const { data: program } = await supabase.from('programs').select('name').eq('id', programId).single();
  await notify(supabase, profile.id, {
    type: 'program',
    title: `دعوة لبرنامج خاص: ${program?.name ?? ''}`,
    body: 'دعتك الشركة لبرنامج خاص لا يراه غير المدعوين — اقبله من برامجك',
    link: '/dashboard/programs',
  });
  revalidatePath(`/company/programs/${programId}`);
}

async function visibilityAction(programId: string, formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  const v = String(formData.get('visibility'));
  if (!['public', 'private', 'invite_only'].includes(v)) throw new Error('Invalid visibility');
  await requireCompanyRole(programId);
  const { error } = await supabase.from('programs').update({ visibility: v }).eq('id', programId);
  if (error) throw new Error(error.message);
  revalidatePath(`/company/programs/${programId}`);
  revalidatePath('/programs');
  revalidatePath('/');
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: 'مسودة — draft', variant: 'secondary' },
    pending_review: { label: 'قيد المراجعة — pending_review', variant: 'outline' },
    active: { label: 'نشط — active', variant: 'default' },
    paused: { label: 'مُعلّق — paused', variant: 'outline' },
    closed: { label: 'مُغلق — closed', variant: 'destructive' },
  };
  const m = map[status] ?? { label: status, variant: 'secondary' as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  if (visibility === 'private') return <Badge variant="destructive">خاص — للمدعوين فقط (private)</Badge>;
  if (visibility === 'invite_only') return <Badge variant="destructive">دعوة فقط — invite_only</Badge>;
  return <Badge variant="secondary">عام — يراه الجميع (public)</Badge>;
}

export default async function ManageProgram({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { id: programId } = await params;
  const { data: program } = await supabase.from('programs').select('*').eq('id', programId).single();
  if (!program) return <main className="container py-12">Not found.</main>;
  const [{ data: assets }, { data: rules }, { data: bounty }, { data: invited }, { data: updates }] = await Promise.all([
    supabase.from('program_assets').select('*').eq('program_id', programId),
    supabase.from('program_rules').select('*').eq('program_id', programId),
    supabase.from('bounty_policies').select('*').eq('program_id', programId),
    supabase.from('program_researchers').select('researcher_id,researcher_profiles(display_name)').eq('program_id', programId),
    supabase.from('program_updates').select('id,title,body,created_at').eq('program_id', programId).order('created_at', { ascending: false }).limit(10),
  ]);

  // Publish readiness — Arabic missing list for UI badges & tooltip
  let readiness: { ready: boolean; missing: string[] } = { ready: false, missing: [] };
  try {
    readiness = await checkPublishReadiness(supabase, programId);
  } catch {
    readiness = { ready: false, missing: ['تعذر التحقق من الجاهزية'] };
  }
  const canPublish = readiness.ready;
  const missingText = readiness.missing.join(' • ');
  const status = program.status as string;
  const visibility = (program.visibility as string) ?? 'public';

  const showPublish = status === 'draft' || status === 'pending_review';
  const showResume = status === 'paused';
  const showPause = status === 'active';
  const showClose = status !== 'closed';

  return (
    <main className="container py-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{program.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">الحالة:</span>
          <StatusBadge status={status} />
          <span className="text-xs text-muted-foreground">الظهور:</span>
          <VisibilityBadge visibility={visibility} />
          {program.published_at && <span className="text-xs text-muted-foreground">نُشر: {new Date(program.published_at).toLocaleDateString('ar-EG')}</span>}
          {program.paused_at && <span className="text-xs text-muted-foreground">مُعلّق: {new Date(program.paused_at).toLocaleDateString('ar-EG')}</span>}
          {program.closed_at && <span className="text-xs text-muted-foreground">مُغلق: {new Date(program.closed_at).toLocaleDateString('ar-EG')}</span>}
        </div>

        {/* Publish readiness panel */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">جاهزية النشر — Readiness Gates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canPublish ? (
              <div className="flex items-center gap-2">
                <Badge>جاهز للنشر ✓</Badge>
                <span className="text-xs text-muted-foreground">كل المتطلبات مكتملة — يمكنك النشر الآن (ينقل draft → active ويظهر في /programs)</span>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-destructive">البرنامج غير جاهز — النواقص:</p>
                <div className="flex flex-wrap gap-1.5">
                  {readiness.missing.map((m) => (
                    <Badge key={m} variant="destructive" className="text-[11px]">
                      {m}
                    </Badge>
                  ))}
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {showPublish && (
                <form action={publishProgramAction.bind(null, program.id)}>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={!canPublish}
                    title={!canPublish ? missingText : 'نشر البرنامج — يصبح مرئيًا في /programs و /'}
                    aria-disabled={!canPublish}
                  >
                    نشر البرنامج (draft → active)
                  </Button>
                </form>
              )}
              {showResume && (
                <form action={resumeProgramAction.bind(null, program.id)}>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={!canPublish}
                    title={!canPublish ? missingText : 'استئناف البرنامج — paused → active'}
                    aria-disabled={!canPublish}
                  >
                    استئناف (paused → active)
                  </Button>
                </form>
              )}
              {showPause && (
                <form action={pauseProgramAction.bind(null, program.id)}>
                  <Button size="sm" variant="outline" type="submit" title="إيقاف مؤقت — active → paused (يُخفى من /programs)">
                    إيقاف مؤقت (active → paused)
                  </Button>
                </form>
              )}
              {showClose && (
                <form action={closeProgramAction.bind(null, program.id)}>
                  <Button size="sm" variant="destructive" type="submit" title="إغلاق نهائي — يُخفى من /programs ويُسجل closed_at">
                    إغلاق (→ closed)
                  </Button>
                </form>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              آلة الحالات الصارمة: draft→active، active→paused، paused→active، active/pending_review/draft→closed، paused→closed. أي انتقال غير مسموح يُرفض بخطأ عربي. عند النشر يُضبط published_at ويسجل audit log ويُرسل إشعار لأعضاء الشركة ويُحدث /programs و /.
            </p>
          </CardContent>
        </Card>

        {/* Visibility control — separate from status machine */}
        <form action={visibilityAction.bind(null, program.id)} className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="vis" className="text-xs font-bold">
            الظهور:
          </label>
          <select id="vis" name="visibility" defaultValue={visibility} className="h-9 rounded-md border bg-background px-3 text-sm">
            <option value="public">عام — يراه الجميع (public) — يظهر في /programs عند active</option>
            <option value="private">خاص — للمدعوين فقط (private)</option>
            <option value="invite_only">دعوة فقط — invite_only (مخفي عن anon، RLS عبر can_view_program)</option>
          </select>
          <Button size="sm" variant="outline" type="submit">
            حفظ الظهور
          </Button>
        </form>
      </div>
      <AssetManager programId={program.id} assets={(assets ?? []) as never} />
      <Card><CardHeader><CardTitle>القواعد ({rules?.length ?? 0})</CardTitle></CardHeader><CardContent>
        {rules?.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b py-2 text-sm">
            <span><b>{r.title}:</b> {r.content}</span>
            <form action={deleteRule.bind(null, r.id, program.id)}><Button size="sm" variant="ghost" type="submit">حذف</Button></form>
          </div>
        ))}
        <form action={addRule.bind(null, program.id)} className="flex gap-2 mt-3">
          <Input name="title" required placeholder="العنوان" />
          <Input name="content" required placeholder="المحتوى" />
          <Button size="sm" type="submit">إضافة</Button>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>باحثون مدعوون (للبرامج الخاصة)</CardTitle></CardHeader><CardContent>
        {((invited ?? []) as unknown as { researcher_id: string; researcher_profiles: { display_name: string } | null }[]).map((i) => (
          <p key={i.researcher_id} className="border-b py-1 text-sm">{i.researcher_profiles?.display_name}</p>
        ))}
        <form action={inviteResearcher.bind(null, program.id)} className="mt-3 flex gap-2">
          <Input name="username" required placeholder="username الباحث" dir="ltr" />
          <Button size="sm" type="submit">دعوة</Button>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>تحديثات البرنامج</CardTitle></CardHeader><CardContent>
        {(updates ?? []).map((u: { id: string; title: string; body: string; created_at: string }) => (
          <div key={u.id} className="mb-3 border-b pb-3 last:border-0">
            <p className="text-sm font-bold">{u.title} <span className="font-normal text-muted-foreground">{new Date(u.created_at).toLocaleDateString('ar-EG')}</span></p>
            <p className="mt-1 text-sm text-muted-foreground">{u.body}</p>
          </div>
        ))}
        <form action={publishUpdate.bind(null, program.id)} className="mt-3 space-y-2">
          <Input name="title" required maxLength={120} placeholder="عنوان التحديث" />
          <Textarea name="body" required placeholder="تفاصيل التحديث — يصل إشعار لحافظي البرنامج" />
          <Button size="sm" type="submit">نشر التحديث</Button>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>سياسات المكافآت (EGP)</CardTitle></CardHeader><CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {(bounty ?? []).map((b) => (
            <p key={b.id} className="rounded-md border p-2 text-sm"><b>{b.severity}</b>: {b.min_amount} – {b.max_amount}</p>
          ))}
        </div>
        <form action={saveBounty.bind(null, program.id)} className="mt-3 flex flex-wrap gap-2">
          <select name="severity" className="h-10 border rounded-md px-2">
            <option value="informational">informational</option><option value="low">low</option>
            <option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option>
          </select>
          <Input name="min_amount" type="number" min={0} required placeholder="من" className="w-28" dir="ltr" />
          <Input name="max_amount" type="number" min={0} required placeholder="إلى" className="w-28" dir="ltr" />
          <Button size="sm" type="submit">حفظ النطاق</Button>
        </form>
      </CardContent></Card>
    </main>
  );
}
