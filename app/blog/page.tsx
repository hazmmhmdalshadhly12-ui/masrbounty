import Link from 'next/link';
import { posts } from '@/constants/blog';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/layout/page-hero';

export default function Blog() {
  return (
    <main>
      <PageHero kicker="المعرفة سلاح" title="المدونة" desc="مقالات عملية في الصيد الأخلاقي وكتابة التقارير." />
      <section className="container max-w-3xl py-10">
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`}>
            <Card className="mb-3 transition-colors hover:border-slate-400">
              <CardContent className="p-6">
                <p className="text-xs text-muted-foreground">{p.date}</p>
                <h2 className="mt-1 text-lg font-bold">{p.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{p.excerpt}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}
