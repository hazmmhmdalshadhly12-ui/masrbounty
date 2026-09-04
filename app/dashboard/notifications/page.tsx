import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { markReadAction, markAllReadAction } from '@/features/notifications/services';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default async function NotificationsPage() {
  const supabase = createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', user.user.id).order('created_at', { ascending: false }).limit(50);
  return (
    <main className="container py-8">
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">الإشعارات</h1>
        <form action={markAllReadAction}><Button size="sm" variant="outline" type="submit">Mark all read</Button></form>
      </div>
      {!notifs?.length ? <p className="text-muted-foreground">No notifications.</p> :
        notifs.map((n) => (
          <Card key={n.id} className={`mb-2 ${n.is_read ? 'opacity-60' : ''}`}><CardContent className="p-3 flex justify-between items-center">
            <div><p className="font-semibold">{n.title}</p><p className="text-sm text-muted-foreground">{n.body}</p>
              {n.link && <Link href={n.link} className="text-xs underline">Open</Link>} <Badge className="ml-2">{n.type}</Badge></div>
            {!n.is_read && <form action={markReadAction.bind(null, n.id)}><Button size="sm" variant="ghost" type="submit">Read</Button></form>}
          </CardContent></Card>
        ))}
    </main>
  );
}
