'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import type { WizardData, AssetType } from '../types';

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'web', label: 'ويب — دومين/سب دومين' },
  { value: 'api', label: 'API' },
  { value: 'mobile', label: 'تطبيق جوال' },
  { value: 'network', label: 'شبكة/IP' },
  { value: 'other', label: 'أخرى' },
];

export function StepScope({
  data,
  onChange,
  errors,
}: {
  data: WizardData['scope'];
  onChange: (p: Partial<WizardData['scope']>) => void;
  errors?: string[];
}) {
  const addAsset = () => {
    const id = Date.now().toString();
    onChange({ assets: [...data.assets, { id, type: 'web', value: '', description: '' }] });
  };
  const updateAsset = (id: string, patch: Partial<(typeof data.assets)[number]>) => {
    onChange({ assets: data.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  };
  const removeAsset = (id: string) => {
    if (data.assets.length <= 1) return;
    onChange({ assets: data.assets.filter((a) => a.id !== id) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>النطاق (Scope)</CardTitle>
        <CardDescription>حدّد الأصول المشمولة — الدومينات، الـ APIs، التطبيقات، وعناوين IP. أضف وصفًا لكل أصل.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {errors && errors.length > 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <ul className="list-disc ps-5 space-y-1">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {data.assets.map((asset, idx) => (
            <div key={asset.id} className="rounded-lg border bg-muted/30 p-4 space-y-3 dark:bg-muted/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">أصل #{idx + 1}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeAsset(asset.id)} disabled={data.assets.length <= 1} aria-label="حذف الأصل">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                <div className="space-y-2">
                  <Label>النوع</Label>
                  <select
                    value={asset.type}
                    onChange={(e) => updateAsset(asset.id, { type: e.target.value as AssetType })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>القيمة *</Label>
                  <Input
                    dir="ltr"
                    value={asset.value}
                    onChange={(e) => updateAsset(asset.id, { value: e.target.value })}
                    placeholder="*.example.com أو https://api.example.com أو 192.0.2.0/24"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>وصف الأصل (اختياري)</Label>
                <Input value={asset.description} onChange={(e) => updateAsset(asset.id, { description: e.target.value })} placeholder="مثال: المنصة الرئيسية — تسجيل الدخول والدفع" />
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addAsset} className="w-full">
            <Plus className="me-2 h-4 w-4" />
            إضافة أصل آخر
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="oos">خارج النطاق (Out of Scope)</Label>
          <Textarea
            id="oos"
            value={data.out_of_scope}
            onChange={(e) => onChange({ out_of_scope: e.target.value })}
            placeholder="مثال: نطاقات الطرف الثالث، هجمات التصيّد الاجتماعي، الـ DoS، الثغرات النظرية بدون إثبات…"
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
}
