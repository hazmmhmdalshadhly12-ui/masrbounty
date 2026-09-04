import { UpdatePasswordForm } from '@/components/forms/update-password-form';
import { Card, CardContent } from '@/components/ui/card';

export default async function UpdatePassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="bg-slate-100 dark:bg-slate-950">
      <div className="container grid min-h-[calc(100vh-4rem)] items-center py-10">
        <Card className="mx-auto w-full max-w-md shadow-xl">
          <CardContent className="p-8">
            <h2 className="text-2xl font-black">كلمة سر جديدة</h2>
            <UpdatePasswordForm serverError={error} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
