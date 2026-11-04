'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, PlusCircle, Ban, Save, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  searchResearchersForAdminAction,
  adjustReputationAction,
  issueAchievementCertificateAction,
  revokeCertificateAction,
  updateResearcherLevelAction,
  type ResearcherSearchRow,
} from '@/features/reputation/admin-actions';
import { toastSuccess, toastError } from '@/components/toasts/toast-utils';

export type AdminLevelRow = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  min_score: number;
  min_accepted: number;
  requires_identity_verified: boolean;
  is_active: boolean;
};

export type AdminCertificateRow = {
  id: string;
  certificate_number: string;
  user_id: string;
  type: string;
  title_ar: string;
  status: string;
  created_at: string;
  revoked_reason: string | null;
};

export function ReputationAdmin({
  isAdmin,
  levels,
  certificates,
  holders,
}: {
  isAdmin: boolean;
  levels: AdminLevelRow[];
  certificates: AdminCertificateRow[];
  holders: Record<string, string>;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [results, setResults] = React.useState<ResearcherSearchRow[]>([]);
  const [selected, setSelected] = React.useState<ResearcherSearchRow | null>(null);
  const [delta, setDelta] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [certTitle, setCertTitle] = React.useState('');
  const [certReason, setCertReason] = React.useState('');
  const [revokeReason, setRevokeReason] = React.useState<Record<string, string>>({});

  async function search() {
    setSearching(true);
    const res = await searchResearchersForAdminAction(q);
    if (res.ok) setResults(res.rows);
    else toastError(res.error ?? 'فشل البحث');
    setSearching(false);
  }

  async function applyAdjustment() {
    if (!selected) return;
    setBusy(true);
    const res = await adjustReputationAction(selected.researcherId, Number(delta), reason);
    if (res.ok) {
      toastSuccess(`تم التعديل — النتيجة الجديدة: ${res.newScore}`);
      setDelta('');
      setReason('');
      setSelected({ ...selected, score: res.newScore ?? selected.score });
      router.refresh();
    } else toastError(res.error ?? 'فشل التعديل');
    setBusy(false);
  }

  async function issueCert() {
    if (!selected) return;
    setBusy(true);
    const res = await issueAchievementCertificateAction(selected.userId, certTitle, certTitle, certReason);
    if (res.ok) {
      toastSuccess(`صدرت الشهادة: ${res.certificateNumber}`);
      setCertTitle('');
      setCertReason('');
      router.refresh();
    } else toastError(res.error ?? 'فشل الإصدار');
    setBusy(false);
  }

  async function revoke(cert: AdminCertificateRow) {
    const reason = (revokeReason[cert.id] ?? '').trim();
    setBusy(true);
    const res = await revokeCertificateAction(cert.id, reason);
    if (res.ok) toastSuccess('أُلغيت الشهادة');
    else toastError(res.error ?? 'فشل الإلغاء');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Researcher search + adjustment */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">تعديل سمعة باحث</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الباحث أو المعرّف…" onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} />
            <Button type="button" variant="outline" onClick={search} disabled={searching || q.trim().length < 2} className="gap-1">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} بحث
            </Button>
          </div>
          {results.length > 0 && (
            <div className="divide-y rounded-lg border">
              {results.map((r) => (
                <button key={r.researcherId} type="button" onClick={() => setSelected(r)} className={`flex w-full items-center gap-3 p-3 text-start text-sm hover:bg-accent ${selected?.researcherId === r.researcherId ? 'bg-primary/5' : ''}`}>
                  <span className="font-bold">{r.displayName}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">@{r.username}</span>
                  <span className="mr-auto flex items-center gap-2">
                    {r.levelName && <Badge variant="outline" className="text-[10px]">{r.levelName}</Badge>}
                    <strong className="tabular-nums" dir="ltr">{r.score}</strong>
                  </span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-black">{selected.displayName} — النتيجة الحالية: <span className="tabular-nums" dir="ltr">{selected.score}</span></p>
              <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                <div><Label>التعديل (±500)</Label><Input type="number" dir="ltr" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="-50 أو +25" /></div>
                <div><Label>السبب (يُسجّل في سجل السمعة والتدقيق) *</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: خصم بعد مراجعة إساءة استخدام متعمدة" /></div>
              </div>
              <Button type="button" onClick={applyAdjustment} disabled={busy || !delta || reason.trim().length < 5} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} تطبيق التعديل
              </Button>

              <div className="border-t pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold"><Award className="h-3.5 w-3.5 text-amber-500" /> إصدار شهادة إنجاز Bug Bounty (بأساس موثق)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>عنوان الإنجاز</Label><Input value={certTitle} onChange={(e) => setCertTitle(e.target.value)} placeholder="مثال: إصلاح ثغرة حرجة في برنامج X" /></div>
                  <div><Label>الأساس (10 أحرف على الأقل) *</Label><Input value={certReason} onChange={(e) => setCertReason(e.target.value)} placeholder="رقم التقرير وقرار الشركة/الإدارة" /></div>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={issueCert} disabled={busy || certTitle.trim().length < 3 || certReason.trim().length < 10} className="mt-2 gap-1">
                  <PlusCircle className="h-3.5 w-3.5" /> إصدار الشهادة
                </Button>
                <p className="mt-2 text-[11px] text-muted-foreground">لا تُصدر شهادة لمجرد إرسال تقرير — يجب اعتماد التقرير من الشركة أو الإدارة حسب نوع الشهادة.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Levels management (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">مستويات الباحثين (تُحتسب تلقائيًا من النقاط + التقارير المقبولة + توثيق الهوية)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {levels.map((l) => (
              <LevelRow key={l.id} level={l} onSaved={() => router.refresh()} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Certificates */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">أحدث الشهادات ({certificates.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {certificates.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">لا شهادات بعد.</p>}
          {certificates.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
              <span className="font-mono text-xs" dir="ltr">{c.certificate_number}</span>
              <span className="font-bold">{holders[c.id] ?? '—'}</span>
              <span className="text-xs text-muted-foreground">{c.title_ar}</span>
              {c.status === 'valid' ? (
                <Badge className="bg-emerald-600 text-[10px]">صالحة</Badge>
              ) : (
                <Badge variant="secondary" className="bg-amber-500 text-[10px] text-white">ملغاة</Badge>
              )}
              <a href={`/certificates/${c.certificate_number}`} target="_blank" rel="noopener noreferrer" className="text-xs underline text-muted-foreground">تحقق</a>
              {c.status === 'valid' && isAdmin && (
                <div className="mr-auto flex items-center gap-1">
                  <Input
                    value={revokeReason[c.id] ?? ''}
                    onChange={(e) => setRevokeReason((m) => ({ ...m, [c.id]: e.target.value }))}
                    placeholder="سبب الإلغاء…"
                    className="h-8 w-44 text-xs"
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => revoke(c)} disabled={busy || (revokeReason[c.id] ?? '').trim().length < 5} aria-label="إلغاء الشهادة">
                    <Ban className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function LevelRow({ level, onSaved }: { level: AdminLevelRow; onSaved: () => void }) {
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({
    name_ar: level.name_ar,
    name_en: level.name_en,
    min_score: String(level.min_score),
    min_accepted: String(level.min_accepted),
    requires_identity_verified: level.requires_identity_verified,
    is_active: level.is_active,
  });

  async function save() {
    setBusy(true);
    const res = await updateResearcherLevelAction(level.id, {
      name_ar: form.name_ar,
      name_en: form.name_en,
      min_score: Number(form.min_score),
      min_accepted: Number(form.min_accepted),
      requires_identity_verified: form.requires_identity_verified,
      is_active: form.is_active,
    });
    if (res.ok) { toastSuccess('حُفظ المستوى'); setEditing(false); onSaved(); }
    else toastError(res.error ?? 'فشل الحفظ');
    setBusy(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
        <span className="font-bold">{level.name_ar}</span>
        <span className="text-xs text-muted-foreground" dir="ltr">{level.name_en || level.code}</span>
        <Badge variant="outline" className="text-[10px]">نقاط ≥ <span dir="ltr" className="tabular-nums">{level.min_score}</span></Badge>
        <Badge variant="outline" className="text-[10px]">مقبولة ≥ <span dir="ltr" className="tabular-nums">{level.min_accepted}</span></Badge>
        {level.requires_identity_verified && <Badge variant="secondary" className="text-[10px]">يتطلب توثيق هوية</Badge>}
        {!level.is_active && <Badge variant="secondary" className="text-[10px]">معطّل</Badge>}
        <Button type="button" size="sm" variant="ghost" className="mr-auto" onClick={() => setEditing(true)}>تعديل</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-primary/40 p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <div><Label>الاسم (عربي)</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
        <div><Label>الاسم (إنجليزي)</Label><Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
        <div><Label>أدنى نقاط</Label><Input type="number" dir="ltr" value={form.min_score} onChange={(e) => setForm({ ...form, min_score: e.target.value })} /></div>
        <div><Label>أدنى تقارير مقبولة</Label><Input type="number" dir="ltr" value={form.min_accepted} onChange={(e) => setForm({ ...form, min_accepted: e.target.value })} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requires_identity_verified} onChange={(e) => setForm({ ...form, requires_identity_verified: e.target.checked })} /> يتطلب توثيق هوية</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> مفعّل</label>
        <div className="mr-auto flex gap-2">
          <Button type="button" size="sm" onClick={save} disabled={busy} className="gap-1">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} حفظ</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>إلغاء</Button>
        </div>
      </div>
    </div>
  );
}
