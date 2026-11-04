'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateReportLimitsAction, setReportLimitOverrideAction } from '@/features/reputation/admin-actions';
import { toastSuccess, toastError } from '@/components/toasts/toast-utils';

type OverrideRow = { userId: string; username: string; daily: number | null; hourly: number | null; reason: string };
type AbuseRow = { id: string; username: string; kind: string; detail: string; severity: string; createdAt: string };

export function ReportLimitsAdmin({
  isAdmin,
  dailyMax,
  hourlyMax,
  overrides,
  abuse,
}: {
  isAdmin: boolean;
  dailyMax: number;
  hourlyMax: number;
  overrides: OverrideRow[];
  abuse: AbuseRow[];
}) {
  const router = useRouter();
  const [daily, setDaily] = React.useState(String(dailyMax));
  const [hourly, setHourly] = React.useState(String(hourlyMax));
  const [busy, setBusy] = React.useState(false);

  // override editor
  const [ovUser, setOvUser] = React.useState('');
  const [ovDaily, setOvDaily] = React.useState('');
  const [ovHourly, setOvHourly] = React.useState('');
  const [ovReason, setOvReason] = React.useState('');

  async function saveLimits() {
    setBusy(true);
    const res = await updateReportLimitsAction(Number(daily), Number(hourly));
    if (res.ok) toastSuccess('حُفظت حدود المنصة'); else toastError(res.error ?? 'فشل الحفظ');
    setBusy(false);
    router.refresh();
  }

  async function saveOverride() {
    setBusy(true);
    const res = await setReportLimitOverrideAction(
      ovUser.trim(),
      ovDaily.trim() === '' ? null : Number(ovDaily),
      ovHourly.trim() === '' ? null : Number(ovHourly),
      ovReason
    );
    if (res.ok) {
      toastSuccess(ovDaily.trim() === '' && ovHourly.trim() === '' ? 'أُزيل الاستثناء — يعود للحد العام' : 'حُفظ استثناء الحد');
      setOvUser(''); setOvDaily(''); setOvHourly(''); setOvReason('');
      router.refresh();
    } else toastError(res.error ?? 'فشل الحفظ');
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">حدود المنصة العامة (تُطبق على الإرسال فقط — المسودات والتعديل غير محدودة)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label>الحد اليومي (تقارير/24س)</Label><Input type="number" dir="ltr" className="w-28" value={daily} onChange={(e) => setDaily(e.target.value)} /></div>
            <div><Label>الحد الساعي (تقارير/ساعة)</Label><Input type="number" dir="ltr" className="w-28" value={hourly} onChange={(e) => setHourly(e.target.value)} /></div>
            <Button type="button" onClick={saveLimits} disabled={busy || !isAdmin} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
            </Button>
          </div>
          {!isAdmin && <p className="text-xs text-muted-foreground">العرض فقط — التعديل للأدمن فقط.</p>}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">استثناء حد لمستخدم (رفع لموثوق / خفض لمخالف — فارغ يعني إزالة الاستثناء)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2"><Label>User ID</Label><Input dir="ltr" value={ovUser} onChange={(e) => setOvUser(e.target.value)} placeholder="uuid من صفحة المستخدمين" /></div>
              <div><Label>حد يومي خاص</Label><Input type="number" dir="ltr" value={ovDaily} onChange={(e) => setOvDaily(e.target.value)} placeholder="فارغ = بلا تغيير" /></div>
              <div><Label>حد ساعي خاص</Label><Input type="number" dir="ltr" value={ovHourly} onChange={(e) => setOvHourly(e.target.value)} placeholder="فارغ = بلا تغيير" /></div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[240px]"><Label>السبب</Label><Input value={ovReason} onChange={(e) => setOvReason(e.target.value)} placeholder="مثال: باحث موثوق لديه إذن فحص جارٍ" /></div>
              <Button type="button" onClick={saveOverride} disabled={busy || ovUser.trim().length < 10} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} حفظ الاستثناء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {overrides.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">استثناءات حالية ({overrides.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {overrides.map((o) => (
              <div key={o.userId} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                <span className="font-bold" dir="ltr">@{o.username}</span>
                <Badge variant="outline" className="text-[10px]">يومي: <span dir="ltr" className="tabular-nums">{o.daily ?? '—'}</span></Badge>
                <Badge variant="outline" className="text-[10px]">ساعي: <span dir="ltr" className="tabular-nums">{o.hourly ?? '—'}</span></Badge>
                {o.reason && <span className="text-xs text-muted-foreground">{o.reason}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">مراقبة محاولات الإساءة (أحدث 30)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {abuse.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">لا محاولات مسجلة.</p>}
          {abuse.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs">
              <Badge variant={a.severity === 'high' ? 'default' : 'secondary'} className={`text-[10px] ${a.severity === 'high' ? 'bg-red-600' : ''}`}>{a.severity}</Badge>
              <span className="font-bold">{a.kind}</span>
              {a.username && <span dir="ltr">@{a.username}</span>}
              <span className="text-muted-foreground">{a.detail}</span>
              <span className="mr-auto text-muted-foreground" dir="ltr">{new Date(a.createdAt).toLocaleString('ar-EG')}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
