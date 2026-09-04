import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function ProgramsPage() {
  const supabase = createServerClient();
  const { data: programs } = await supabase
    .from('programs')
    .select('id,name,slug,description,status,visibility')
    .eq('status', 'active')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!programs?.length) {
    return (
      <main className="container py-12">
        <h1 className="text-2xl font-bold">البرامج</h1>
        <p className="text-muted-foreground mt-2">No active public programs yet.</p>
      </main>
    );
  }
  return (
    <main className="container py-8">
      <h1 className="text-2xl font-bold mb-6">برامج Bug Bounty</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {programs.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>
                <Link href={`/programs/${p.slug}`} className="hover:underline">
                  {p.name}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
              <div className="mt-3 flex gap-2">
                <Badge>{p.status}</Badge>
                <Badge variant="secondary">{p.visibility}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
