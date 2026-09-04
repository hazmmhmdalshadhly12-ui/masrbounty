import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { slugify } from '@/utils/slug';

async function saveCompany(formData: FormData) {
  'use server';
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Unauthorized');
  const name = String(formData.get('name'));
  const slug = slugify(String(formData.get('slug') || name));
  const { data: existing } = await supabase.from('company_profiles').select('id').eq('owner_id', user.user.id).single();
  if (existing) {
    await supabase.from('company_profiles').update({ name, slug, description: String(formData.get('description') ?? ''), website: String(formData.get('website') ?? '') }).eq('id', existing.id);
  } else {
    const { data: c } = await supabase.from('company_profiles').insert({ owner_id: user.user.id, name, slug, description: String(formData.get('description') ?? ''), website: String(formData.get('website') ?? '') }).select('id').single();
    if (c) await supabase.from('company_members').insert({ company_id: c.id, user_id: user.user.id, role: 'owner' });
  }
  revalidatePath('/company/settings');
}

export default async function CompanySettings() {
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: company } = await supabase.from('company_profiles').select('*').eq('owner_id', user.user.id).single();
  return (
    <main className="container py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">إعدادات الشركة</h1>
      <Card><CardHeader><CardTitle>Profile</CardTitle></CardHeader><CardContent>
        <form action={saveCompany} className="space-y-3">
          <Input name="name" required defaultValue={company?.name ?? ''} placeholder="Company name" />
          <Input name="slug" required defaultValue={company?.slug ?? ''} placeholder="slug" dir="ltr" />
          <Input name="description" defaultValue={company?.description ?? ''} placeholder="Description" />
          <Input name="website" defaultValue={company?.website ?? ''} placeholder="https://…" dir="ltr" />
          <Button type="submit">Save</Button>
        </form>
      </CardContent></Card>
    </main>
  );
}
