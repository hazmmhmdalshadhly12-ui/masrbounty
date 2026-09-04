import { registerAction } from '@/features/auth/services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <main className="container py-12 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>حساب جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={registerAction} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" required minLength={3} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required dir="ltr" />
            </div>
            <div>
              <Label htmlFor="password">Password (8+)</Label>
              <Input id="password" name="password" type="password" required minLength={8} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <select id="role" name="role" className="w-full h-10 rounded-md border px-3" defaultValue="researcher">
                <option value="researcher">Researcher</option>
                <option value="company">Company</option>
              </select>
            </div>
            <Button type="submit" className="w-full">
              إنشاء الحساب
            </Button>
          </form>
          <p className="mt-4 text-sm">
            Have account? <Link href="/login" className="underline">Login</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
