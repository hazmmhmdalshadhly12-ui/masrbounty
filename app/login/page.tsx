import { loginAction } from '@/features/auth/services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="container py-12 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>تسجيل الدخول</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required dir="ltr" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required dir="ltr" />
            </div>
            <Button type="submit" className="w-full">
              دخول
            </Button>
          </form>
          <p className="mt-4 text-sm">
            No account? <Link href="/register" className="underline">Register</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
