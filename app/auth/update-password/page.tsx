import { redirect } from 'next/navigation';
import { UpdatePasswordForm } from '@/components/forms/update-password-form';
import { Card, CardContent } from '@/components/ui/card';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Password change screen — only reachable with a live auth session
 * established by the recovery callback. Guests are bounced to /login:
 * the actual password change is enforced by Supabase (updateUser requires
 * a session), this guard just avoids rendering a form that cannot succeed.
 */
export default async function UpdatePassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  let hasUser = false;
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    hasUser = Boolean(data.user);
  } catch {
    hasUser = false;
  }
  if (!hasUser) {
    redirect('/login?error=' + encodeURIComponent('انتهت جلسة الاستعادة — اطلب رابطًا جديدًا'));
  }
  return (
    <div className="bg-slate-100 dark:bg-slate-950">
      <div className="container grid min-h-[calc(100vh-4rem)] items-center py-10">
        <Card className="mx-auto w-full max-w-md shadow-xl">
          <CardContent className="p-8">
            <h2 className="text-2xl font-black">كلمة سر جديدة</h2>
            <UpdatePasswordForm serverError={error} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
