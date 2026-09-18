'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { addAssetAction, updateAssetAction, deleteAssetAction } from '@/components/programs/asset-actions';

// program_assets: web/api/mobile/ip/cloud/other, host (value), scope_status, risk, desc (description) — with server actions
export type AssetTypeDb = 'web' | 'api' | 'mobile' | 'network' | 'other';
export type AssetTypeUi = 'web' | 'api' | 'mobile' | 'ip' | 'cloud' | 'other';

export interface Asset {
  id: string;
  program_id: string;
  type: AssetTypeDb;
  value: string; // host
  description: string | null; // desc + encoded scope_status/risk
  created_at: string;
}

const typeArabic: Record<string, string> = {
  web: 'ويب',
  api: 'واجهة برمجية',
  mobile: 'تطبيق جوال',
  network: 'شبكة / IP',
  ip: 'شبكة / IP',
  other: 'أخرى / سحابة',
  cloud: 'سحابة',
};

const typeOptions: { value: AssetTypeUi; label: string }[] = [
  { value: 'web', label: 'ويب — web' },
  { value: 'api', label: 'API — واجهة برمجية' },
  { value: 'mobile', label: 'جوال — mobile' },
  { value: 'ip', label: 'شبكة/IP — ip' },
  { value: 'cloud', label: 'سحابة — cloud' },
  { value: 'other', label: 'أخرى — other' },
];

const scopeOptions: { value: string; label: string }[] = [
  { value: 'unknown', label: 'غير محدد' },
  { value: 'in_scope', label: 'داخل النطاق — scope_status: in' },
  { value: 'out_of_scope', label: 'خارج النطاق — scope_status: out' },
];

const riskOptions: { value: string; label: string }[] = [
  { value: 'none', label: 'غير محدد' },
  { value: 'low', label: 'منخفضة' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'high', label: 'عالية' },
  { value: 'critical', label: 'حرجة' },
  { value: 'informational', label: 'معلوماتية' },
];

function AddForm({ programId }: { programId: string }) {
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);
  return (
    <form
      action={(fd) => {
        setErr(null);
        start(async () => {
          try {
            await addAssetAction(programId, fd);
            (document.getElementById('asset-add-form') as HTMLFormElement | null)?.reset();
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'فشل الإضافة');
          }
        });
      }}
      id="asset-add-form"
      className="mt-4 grid gap-3 rounded-lg border bg-muted/30 p-4"
    >
      <p className="text-sm font-bold">إضافة أصل جديد — web/api/mobile/ip/cloud/other</p>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <div className="space-y-1">
          <Label htmlFor="asset-type">النوع *</Label>
          <select id="asset-type" name="type" defaultValue="web" className="h-10 w-full rounded-md border bg-background px-2 text-sm">
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="asset-value">المضيف / host *</Label>
          <Input id="asset-value" name="value" required placeholder="https://example.com أو 192.0.2.0/24 أو com.example.app" dir="ltr" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="asset-scope">حالة النطاق — scope_status</Label>
          <select id="asset-scope" name="scope_status" defaultValue="unknown" className="h-10 w-full rounded-md border bg-background px-2 text-sm">
            {scopeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="asset-risk">المخاطر — risk</Label>
          <select id="asset-risk" name="risk" defaultValue="none" className="h-10 w-full rounded-md border bg-background px-2 text-sm">
            {riskOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="asset-desc">الوصف — desc</Label>
        <Textarea id="asset-desc" name="description" rows={2} placeholder="وصف الأصل وتفاصيل النطاق والمخاطر" />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'جاري الحفظ…' : 'إضافة الأصل'}
      </Button>
    </form>
  );
}

function Row({ asset, programId }: { asset: Asset; programId: string }) {
  const [editing, setEditing] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b py-3 text-sm last:border-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{typeArabic[asset.type] ?? asset.type}</Badge>
            <span className="font-mono text-[13px]" dir="ltr">
              {asset.value}
            </span>
          </div>
          {asset.description && <p className="mt-1 text-xs text-muted-foreground">{asset.description}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            تعديل
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  await deleteAssetAction(asset.id, programId);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : 'فشل الحذف');
                }
              })
            }
          >
            {pending ? '…' : 'حذف'}
          </Button>
        </div>
        {err && <p className="w-full text-xs text-destructive">{err}</p>}
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        setErr(null);
        start(async () => {
          try {
            await updateAssetAction(asset.id, fd);
            setEditing(false);
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'فشل التحديث');
          }
        });
      }}
      className="grid gap-2 border-b py-3 last:border-0"
    >
      <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
        <select name="type" defaultValue={asset.type === 'network' ? 'ip' : asset.type} className="h-10 rounded-md border bg-background px-2 text-sm">
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Input name="value" defaultValue={asset.value} required dir="ltr" placeholder="host" />
        <div className="flex gap-1">
          <Button size="sm" type="submit" disabled={pending}>
            {pending ? '…' : 'حفظ'}
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
            إلغاء
          </Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select name="scope_status" defaultValue="unknown" className="h-10 rounded-md border bg-background px-2 text-sm">
          {scopeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select name="risk" defaultValue="none" className="h-10 rounded-md border bg-background px-2 text-sm">
          {riskOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <Textarea name="description" defaultValue={asset.description ?? ''} rows={2} placeholder="desc" />
      {err && <p className="text-xs text-destructive">{err}</p>}
    </form>
  );
}

export function AssetManager({ programId, assets }: { programId: string; assets: Asset[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الأصول — إدارة النطاق ({assets.length})</CardTitle>
        <p className="text-xs text-muted-foreground">
          الأنواع: web / api / mobile / ip / cloud / other — الحقول: host (المضيف/الرابط)، scope_status (حالة النطاق)، risk (المخاطر)، desc (الوصف). CRUD عبر server actions مع تحقق RBAC.
        </p>
      </CardHeader>
      <CardContent>
        {assets.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">لا توجد أصول بعد — أضف أول أصل أدناه.</p>
        ) : (
          <div>{assets.map((a) => <Row key={a.id} asset={a} programId={programId} />)}</div>
        )}
        <AddForm programId={programId} />
      </CardContent>
    </Card>
  );
}
