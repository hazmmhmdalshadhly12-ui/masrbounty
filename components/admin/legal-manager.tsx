'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, History, Loader2, ScrollText, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LEGAL_DOCUMENTS } from '@/constants/legal';
import { createLegalDraftAction, updateLegalDraftAction, publishLegalVersionAction, setRequiresReacceptanceAction } from '@/features/legal/admin-actions';

type DocRow = {
  id: string;
  slug: string;
  title_ar: string;
  current_version: number | null;
  status: string;
  requires_reacceptance: boolean;
};
type VersionRow = {
  id: string;
  document_id: string;
  version: number;
  status: string;
  change_summary_ar: string | null;
  published_at: string | null;
  created_at: string;
  content_md: string;
};
type AcceptanceRow = {
  id: string;
  user_id: string;
  document_slug: string;
  version: number;
  context: string;
  age_confirmed: boolean;
  accepted_at: string;
};

const dt = (s: string) => new Date(s).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });

function Msg({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <p role="alert" className="rounded-md bg-red-50 p-2.5 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>;
  if (ok) return <p role="status" className="rounded-md bg-green-50 p-2.5 text-sm font-medium text-green-700 dark:bg-green-950 dark:text-green-300">{ok}</p>;
  return null;
}

/** Docs admin: draft -> publish (immutable) -> versions history -> consent log. */
export function LegalManager({ docs, versions, acceptances }: { docs: DocRow[]; versions: VersionRow[]; acceptances: AcceptanceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Draft editor state
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [accFilter, setAccFilter] = useState('');

  function run(fn: () => Promise<void>, success: string) {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setOkMsg(success);
        setEditId(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل تنفيذ العملية');
      }
    });
  }

  const titleBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of docs) map.set(d.id, d.title_ar);
    for (const m of LEGAL_DOCUMENTS) if (!map.has(m.slug)) map.set(m.slug, m.title);
    return map;
  }, [docs]);

  const docById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const fAcceptances = useMemo(
    () => acceptances.filter((a) => !accFilter || a.document_slug.includes(accFilter) || a.user_id.includes(accFilter)),
    [acceptances, accFilter]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black">إدارة السياسات القانونية</h1>
        <p className="text-sm text-muted-foreground">
          المسودة قابلة للتحرير؛ النشر يجعل الإصدار غير قابل للتعديل نهائيًا ويستبدل الإصدار السابق. التغيير الجوهري يفعّل إعادة الموافقة عند الدخول.
        </p>
      </div>
      <Msg error={error} ok={okMsg} />

      <Tabs defaultValue="docs">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="docs" className="gap-1.5"><FileText className="h-4 w-4" /> الوثائق</TabsTrigger>
          <TabsTrigger value="log" className="gap-1.5"><Users className="h-4 w-4" /> سجل الموافقات</TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="space-y-4">
          {docs.length === 0 && (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                لا وثائق في قاعدة البيانات بعد — طبّق الترحيل 26 (seed) لتوليد الوثائق الاثنتي عشرة.
              </CardContent>
            </Card>
          )}
          {docs.map((doc) => {
            const docVersions = versions.filter((v) => v.document_id === doc.id);
            const draft = docVersions.find((v) => v.status === 'draft');
            const current = docVersions.find((v) => v.version === doc.current_version);
            return (
              <Card key={doc.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <ScrollText className="h-4 w-4 text-primary" />
                    {doc.title_ar}
                    <Badge variant={doc.status === 'published' ? 'default' : 'secondary'}>
                      {doc.status === 'published' ? `منشورة — إصدار ${doc.current_version}` : 'مسودة'}
                    </Badge>
                    <Badge variant={doc.requires_reacceptance ? 'destructive' : 'outline'}>
                      {doc.requires_reacceptance ? 'تتطلب إعادة موافقة' : 'بدون إعادة موافقة'}
                    </Badge>
                    <Link href={`/legal/${doc.slug}`} target="_blank" className="ms-auto text-xs font-bold text-primary underline underline-offset-4">
                      عرض الصفحة
                    </Link>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs" dir="ltr">{doc.slug}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Version history */}
                  <ul className="space-y-1.5 text-sm">
                    {docVersions.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center gap-2">
                        <Badge variant={v.status === 'published' ? 'default' : v.status === 'draft' ? 'secondary' : 'outline'}>
                          إصدار {v.version}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {v.status === 'draft' ? 'مسودة' : v.status === 'published' ? `نُشر ${v.published_at ? dt(v.published_at) : ''}` : 'مُستبدل'}
                          {v.change_summary_ar ? ` · ${v.change_summary_ar}` : ''}
                        </span>
                        {v.status === 'draft' && (
                          <span className="ms-auto flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditId(editId === v.id ? null : v.id);
                                setEditContent(v.content_md);
                                setEditSummary(v.change_summary_ar ?? '');
                              }}
                            >
                              {editId === v.id ? 'إغلاق المحرر' : 'تحرير'}
                            </Button>
                            <form action={(fd: FormData) => run(() => publishLegalVersionAction(fd), 'نُشر الإصدار وأصبح غير قابل للتعديل')}>
                              <input type="hidden" name="document_slug" value={doc.slug} />
                              <input type="hidden" name="version" value={v.version} />
                              <label className="flex items-center gap-1 text-xs font-medium">
                                <input type="checkbox" name="requires_reacceptance" className="h-4 w-4" /> إعادة موافقة
                              </label>
                              <Button size="sm" type="submit" disabled={pending}>نشر</Button>
                            </form>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* Draft editor */}
                  {editId && draft && draft.id === editId && (
                    <form
                      action={(fd: FormData) => run(() => updateLegalDraftAction(editId, fd), 'حُفظت المسودة')}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      <input type="hidden" name="document_slug" value={doc.slug} />
                      <Textarea
                        name="content_md"
                        rows={14}
                        required
                        dir="rtl"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        aria-label="محتوى المسودة (Markdown)"
                        className="font-mono text-xs"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          name="change_summary_ar"
                          placeholder="ملخص التغيير (يظهر في سجل الإصدارات)"
                          value={editSummary}
                          onChange={(e) => setEditSummary(e.target.value)}
                          className="w-96"
                        />
                        <Button size="sm" type="submit" disabled={pending}>
                          {pending && <Loader2 className="ml-1.5 h-3.5 w-3.5 animate-spin" />} حفظ المسودة
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">الإصدارات المنشورة لا تُعدل أبدًا — أي تعديل يتطلب مسودة وإصدارًا جديدًا.</p>
                    </form>
                  )}

                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" disabled={pending || Boolean(draft)} onClick={() => run(() => createLegalDraftAction(doc.slug), 'أُنشئت مسودة إصدار جديد')}>
                      <History className="ml-1 h-3.5 w-3.5" /> مسودة إصدار جديد
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => run(() => setRequiresReacceptanceAction(doc.slug, !doc.requires_reacceptance), doc.requires_reacceptance ? 'أُلغيت إعادة الموافقة' : 'فُعّلت إعادة الموافقة')}
                    >
                      {doc.requires_reacceptance ? 'إيقاف إعادة الموافقة' : 'تفعيل إعادة الموافقة'}
                    </Button>
                    {current && <span className="self-center text-xs text-muted-foreground">المحتوى المنشور: {current.content_md.length.toLocaleString('en-US')} حرف</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="log">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">سجل موافقات المستخدمين (غير قابل للتعديل)</CardTitle>
              <CardDescription>المستخدم · الوثيقة · الإصدار · سياق القبول · تأكيد العمر · التاريخ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="تصفية برقم المستخدم أو اسم الوثيقة…"
                value={accFilter}
                onChange={(e) => setAccFilter(e.target.value)}
                className="max-w-md"
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">سجل الموافقات</caption>
                  <thead>
                    <tr className="border-b bg-muted/50 text-right text-xs text-muted-foreground">
                      <th scope="col" className="px-3 py-2 font-medium">المستخدم</th>
                      <th scope="col" className="px-3 py-2 font-medium">الوثيقة</th>
                      <th scope="col" className="px-3 py-2 font-medium">الإصدار</th>
                      <th scope="col" className="px-3 py-2 font-medium">السياق</th>
                      <th scope="col" className="px-3 py-2 font-medium">العمر</th>
                      <th scope="col" className="px-3 py-2 font-medium">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fAcceptances.map((a) => (
                      <tr key={a.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-2 font-mono text-xs" dir="ltr">{a.user_id.slice(0, 8)}…</td>
                        <td className="px-3 py-2">{titleBySlug.get(a.document_slug) ?? a.document_slug}</td>
                        <td className="px-3 py-2 tabular-nums">{a.version}</td>
                        <td className="px-3 py-2 text-xs">{a.context}</td>
                        <td className="px-3 py-2">{a.age_confirmed ? '18+ ✓' : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{dt(a.accepted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!fAcceptances.length && <p className="p-3 text-sm text-muted-foreground">لا سجلات موافقات بعد.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
