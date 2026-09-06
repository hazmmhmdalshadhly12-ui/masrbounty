import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { markReadAction, markAllReadAction } from '@/features/notifications/services';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/utils/time';
import { isInternalLink } from '@/lib/links';

export default async function NotificationsPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <main className="container py-12">Login required.</main>;
  const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', user.user.id).order('created_at', { ascending: false }).limit(50);
  return (
    <div className="py-2">
      <PageHeader
        icon={Bell}
        title="الإشعارات"
        desc="تحديثات التقارير والمكافآت والبرامج"
        action={<form action={markAllReadAction}><Button size="sm" variant="outline" type="submit">تعيين الكل كمقروء</Button></form>}
      />
      {!notifs?.length ? <p className="text-muted-foreground">No notifications.</p> :
        notifs.map((n) => (
          <Card key={n.id} className={`mb-2 ${n.is_read ? 'opacity-60' : ''}`}><CardContent className="p-3 flex justify-between items-center">
            <div><p className="font-semibold">{n.title}</p><p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.created_at)} {isInternalLink(n.link) && <Link href={n.link as string} className="underline">فتح</Link>} <Badge className="ml-2">{n.type}</Badge></p></div>
            {!n.is_read && <form action={markReadAction.bind(null, n.id)}><Button size="sm" variant="ghost" type="submit">تعيين كمقروء</Button></form>}
          </CardContent></Card>
        ))}
    </div>
  );
}
