'use client';

import { useState } from 'react';
import { generateApiKey, revokeApiKey } from '@/features/api-keys/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Key {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  created_at: string;
}

export function ApiKeysCard({ initial }: { initial: Key[] }) {
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('name', name || 'default');
      const token = await generateApiKey(fd);
      setFresh(token);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإنشاء');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>مفاتيح API</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">للاستخدامات المستقبلية والتكاملات. المفتاح الكامل يظهر مرة واحدة فقط.</p>
        {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {fresh && (
          <p className="rounded-md bg-green-50 p-2 font-mono text-xs break-all" dir="ltr">{fresh}</p>
        )}
        {initial.map((k) => (
          <div key={k.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
            <span><b>{k.name}</b> <span className="font-mono text-xs text-muted-foreground" dir="ltr">{k.key_prefix}…</span></span>
            <span className="flex items-center gap-2">
              {k.is_active ? <Badge>نشط</Badge> : <Badge variant="secondary">ملغي</Badge>}
              {k.is_active && <Button size="sm" variant="outline" onClick={() => revokeApiKey(k.id)}>إلغاء</Button>}
            </span>
          </div>
        ))}
        <form onSubmit={create} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المفتاح" maxLength={60} />
          <Button size="sm" type="submit" disabled={busy}>توليد</Button>
        </form>
      </CardContent>
    </Card>
  );
}
