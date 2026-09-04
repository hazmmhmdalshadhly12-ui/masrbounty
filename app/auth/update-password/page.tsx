import { updatePasswordAction } from '@/features/auth/services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default async function UpdatePassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="bg-slate-100 dark:bg-slate-950">
      <div className="container grid min-h-[calc(100vh-4rem)] items-center py-10">
        <Card className="mx-auto w-full max-w-md shadow-xl">
          <CardContent className="p-8">
            <h2 className="text-2xl font-black">كلمة سر جديدة</h2>
            {error && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <form action={updatePasswordAction} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="password">كلمة السر الجديدة (8+ أحرف)</Label>
                <Input id="password" name="password" type="password" required minLength={8} dir="ltr" className="mt-1" />
              </div>
              <Button type="submit" className="w-full bg-amber-400 font-bold text-[#0a1628] hover:bg-amber-300">
                حفظ
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
