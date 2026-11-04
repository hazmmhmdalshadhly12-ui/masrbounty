import Link from 'next/link';
import { BadgeCheck, ShieldX, ShieldCheck, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SITE_URL } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'التحقق من الشهادة — MasrBounty',
  robots: { index: false },
};

type CertRow = {
  certificate_number: string;
  holder_name: string;
  title: string;
  issued_at: string;
  status: string;
};

export default async function CertificateVerifyPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const clean = number.trim().slice(0, 40);
  const supabase = await createServerClient();
  // Privacy-safe public RPC: returns ONLY public fields (no user ids/emails).
  const { data, error } = await supabase.rpc('verify_certificate', { p_number: clean });
  const rows = (data ?? []) as CertRow[];
  const cert = rows[0] ?? null;

  const verifyUrl = `${SITE_URL}/certificates/${encodeURIComponent(clean)}`;
  let qrSvg: string | null = null;
  try {
    qrSvg = await QRCode.toString(verifyUrl, {
      type: 'svg',
      margin: 1,
      width: 140,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch {
    qrSvg = null;
  }

  return (
    <div className="container max-w-2xl py-12">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black">التحقق من شهادة MasrBounty</h1>
        <p className="mt-1 text-sm text-muted-foreground" dir="ltr">{clean}</p>
      </div>

      {!cert ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <ShieldX className="h-12 w-12 text-destructive" />
            <p className="text-lg font-black">الشهادة غير موجودة</p>
            <p className="text-sm text-muted-foreground">تأكد من رقم الشهادة المكتوب على الشهادة نفسه (مثال: MB-CERT-000001) أو من رابط التحقق كاملًا.</p>
            {error ? <p className="text-xs text-muted-foreground" dir="ltr">{error.message}</p> : null}
          </CardContent>
        </Card>
      ) : cert.status === 'valid' ? (
        <Card className="border-emerald-300">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <BadgeCheck className="h-5 w-5 text-emerald-600" />
              <p className="font-black text-emerald-700">شهادة صالحة وموثقة</p>
              <Badge className="mr-auto bg-emerald-600">صالحة</Badge>
            </div>
            <dl className="divide-y text-sm">
              {[
                ['حامل الشهادة', cert.holder_name],
                ['الإنجاز / الدورة', cert.title],
                ['تاريخ الإصدار', new Date(cert.issued_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })],
                ['الجهة المصدرة', 'MasrBounty — منصة البوجاونتي المصرية'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-5 py-3">
                  <dt className="shrink-0 text-muted-foreground">{k}</dt>
                  <dd className="text-left font-bold" dir="auto">{v}</dd>
                </div>
              ))}
            </dl>
            {qrSvg && (
              <div className="flex items-center gap-3 border-t p-4">
                <div className="h-[110px] w-[110px] shrink-0 overflow-hidden rounded border bg-white p-1" aria-label="QR code للتحقق">
                  <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                </div>
                <div className="text-xs leading-relaxed text-muted-foreground">
                  <p className="mb-1 flex items-center gap-1 font-bold text-foreground"><QrCode className="h-3.5 w-3.5" /> رمز التحقق</p>
                  <p>يمسح أي جهة هذا الرمز للوصول إلى هذه الصفحة العامة والتأكد من صحة الشهادة.</p>
                  <Link href={`/certificates/${encodeURIComponent(clean)}`} className="mt-1 inline-block break-all underline" dir="ltr">{verifyUrl}</Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-300">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <ShieldCheck className="h-12 w-12 text-amber-500" />
            <p className="text-lg font-black">الشهادة موجودة لكنها ملغاة</p>
            <p className="text-sm text-muted-foreground">صدرت هذه الشهادة سابقًا وألغتها الإدارة — لا تُعتبر سارية الآن.</p>
            <Badge variant="secondary" className="bg-amber-500 text-white">ملغاة</Badge>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 text-center">
        <Link href="/academy">
          <Button type="button" variant="outline" size="sm">استكشف أكاديمية اختبار الاختراق</Button>
        </Link>
      </div>
    </div>
  );
}
