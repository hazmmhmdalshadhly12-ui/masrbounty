import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';

export default async function HallOfFamePage() {
  const supabase = await createServerClient();
  const { data } = await supabase.from('hall_of_fame').select('*').order('recognized_at', { ascending: false }).limit(100);
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-2">قاعة المشاهير</h1>
      <p className="text-muted-foreground mb-6">Researchers recognized by companies.</p>
      {!data?.length ? <p className="text-muted-foreground">No recognitions yet.</p> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((h) => (
            <Card key={h.id}><CardContent className="p-4"><p className="font-bold">{h.display_name}</p><p className="text-sm mt-1">{h.achievement}</p></CardContent></Card>
          ))}
        </div>
      )}
    </main>
  );
}
