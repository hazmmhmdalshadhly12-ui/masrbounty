import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { markReadAction, markAllReadAction } from '@/features/notifications/services';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';

export default async function CompanyNotifications() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return <div className="py-2 text-sm">سجّل الدخول أولًا.</div>;
  const { data: notifs } = await supabase.from('notifications').select('*').eq('user_id', user.user.id).order('created_at', { ascending: false }).limit(50);
  return (
    <div className="py-2">
      <PageHeader
        icon={Bell}
        title="إشعارات الفريق"
        desc="تعليقات وتحديثات التقارير الخاصة بك"
        action={<form action={markAllReadAction}><Button size="sm" variant="outline" type="submit">تعيين الكل كمقروء</Button></form>}
      />
      {!notifs?.length ? <p className="text-sm text-muted-foreground">لا إشعارات.</p> :
        notifs.map((n) => (
          <Card key={n.id} className={`mb-2 ${n.is_read ? 'opacity-60' : ''}`}><CardContent className="p-3 flex justify-between items-center">
            <div><p className="font-semibold">{n.title}</p><p className="text-sm text-muted-foreground">{n.body}</p>
              {n.link && <Link href={n.link} className="text-xs underline">فتح</Link>} <Badge className="ml-2">{n.type}</Badge></div>
            {!n.is_read && <form action={markReadAction.bind(null, n.id)}><Button size="sm" variant="ghost" type="submit">تعيين كمقروء</Button></form>}
          </CardContent></Card>
        ))}
    </div>
  );
}
