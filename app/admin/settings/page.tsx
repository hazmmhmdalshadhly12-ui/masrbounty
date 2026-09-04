import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

async function save(formData: FormData) {
  'use server';
  const supabase = await createServerClient();
  await supabase.from('platform_settings').upsert({ key: String(formData.get('key')), value: JSON.parse(String(formData.get('value') || '{}')) });
  revalidatePath('/admin/settings');
}

export default async function AdminSettings() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('platform_settings').select('*');
  return (
    <main className="container py-8 max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">إعدادات المنصة</h1>
      {data?.map((s) => <Card key={s.key}><CardContent className="p-3 text-sm"><b dir="ltr">{s.key}</b>: <span dir="ltr">{JSON.stringify(s.value)}</span></CardContent></Card>)}
      <Card><CardHeader><CardTitle>Upsert setting</CardTitle></CardHeader><CardContent>
        <form action={save} className="flex gap-2"><Input name="key" required placeholder="key" dir="ltr" /><Input name="value" required placeholder='{"a":1}' dir="ltr" /><Button type="submit">Save</Button></form>
      </CardContent></Card>
    </main>
  );
}
