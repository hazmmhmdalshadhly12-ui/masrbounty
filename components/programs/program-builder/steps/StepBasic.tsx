'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { slugify } from '@/utils/slug';
import type { WizardData } from '../types';

export function StepBasic({
  data,
  onChange,
  errors,
}: {
  data: WizardData['basic'];
  onChange: (p: Partial<WizardData['basic']>) => void;
  errors?: string[];
}) {
  return (
    <Card className="border bg-card dark:bg-card">
      <CardHeader>
        <CardTitle>البيانات الأساسية</CardTitle>
        <CardDescription>أدخل اسم البرنامج ومعلوماته التعريفية — ستظهر للباحثين في صفحة البرنامج</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {errors && errors.length > 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <ul className="list-disc ps-5 space-y-1">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">اسم البرنامج *</Label>
            <Input
              id="name"
              value={data.name}
              onChange={(e) => {
                const name = e.target.value;
                const autoSlug = !data.slug ? slugify(name) : data.slug;
                onChange({ name, slug: autoSlug });
              }}
              placeholder="مثال: برنامج منصة مصر باونتي"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">المعرّف (slug)</Label>
            <Input
              id="slug"
              dir="ltr"
              value={data.slug}
              onChange={(e) => onChange({ slug: slugify(e.target.value) })}
              placeholder="masrbounty-platform"
            />
            <p className="text-xs text-muted-foreground">يُستخدم في الرابط — أحرف صغيرة وأرقام وشرطات فقط</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="logo">رابط الشعار (اختياري)</Label>
            <Input id="logo" dir="ltr" value={data.logo_url} onChange={(e) => onChange({ logo_url: e.target.value })} placeholder="https://example.com/logo.png" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">الموقع الإلكتروني</Label>
            <Input id="website" dir="ltr" value={data.website} onChange={(e) => onChange({ website: e.target.value })} placeholder="https://example.com" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">الوصف *</Label>
          <Textarea
            id="desc"
            value={data.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="اشرح برنامجك، أهدافه، وما تتوقعه من الباحثين — ٥٠ حرفًا على الأقل"
            rows={5}
            required
          />
          <p className="text-xs text-muted-foreground">{data.description.length} حرف — الحد الأدنى ٥٠</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact">بريد التواصل *</Label>
          <Input id="contact" dir="ltr" type="email" value={data.contact_email} onChange={(e) => onChange({ contact_email: e.target.value })} placeholder="security@example.com" required />
        </div>
      </CardContent>
    </Card>
  );
}
