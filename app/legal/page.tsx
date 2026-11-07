import Link from 'next/link';
import { ChevronLeft, FileText } from 'lucide-react';
import { PageHero } from '@/components/layout/page-hero';
import { Card, CardContent } from '@/components/ui/card';
import { LegalWarningBanner } from '@/components/legal/legal-warning-banner';
import { LEGAL_DOCUMENTS, CATEGORIES_AR } from '@/constants/legal';
import type { LegalCategory } from '@/types/legal';

export const metadata = {
  title: 'السياسات والاتفاقيات | MasrBounty',
  description: 'جميع سياسات واتفاقيات منصة MasrBounty — قابلة للإصدار والمراجعة بالنسخ',
};

export default async function LegalIndexPage() {
  const categories: LegalCategory[] = ['core', 'bounty', 'company', 'researcher', 'data'];
  return (
    <>
      <PageHero
        kicker="قانوني"
        title="السياسات والاتفاقيات"
        desc="وثائق المنصة الرسمية — كل وثيقة لها رقم إصدار وتاريخ نشر وسجل نسخ سابقة"
      />
      <div className="container max-w-4xl space-y-6 py-10">
        <LegalWarningBanner />
        {categories.map((cat) => {
          const docs = LEGAL_DOCUMENTS.filter((d) => d.category === cat);
          if (!docs.length) return null;
          return (
            <section key={cat} aria-label={CATEGORIES_AR[cat]}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
                <span aria-hidden="true" className="inline-block h-4 w-1 rounded-full bg-primary" />
                {CATEGORIES_AR[cat]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {docs.map((doc) => (
                  <Link key={doc.slug} href={`/legal/${doc.slug}`} className="group">
                    <Card className="h-full transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-lift">
                      <CardContent className="flex items-start gap-3 p-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                          <FileText className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black">{doc.title}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{doc.description}</span>
                        </span>
                        <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
