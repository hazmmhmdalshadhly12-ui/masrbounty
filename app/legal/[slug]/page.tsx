import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { ArrowRight, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LegalWarningBanner } from '@/components/legal/legal-warning-banner';
import { MarkdownDoc } from '@/components/legal/markdown';
import { legalDocBySlug } from '@/constants/legal';
import type { LegalDocument, LegalDocumentVersion } from '@/types/legal';

/**
 * Public, versioned policy page. Content comes from the DB (published
 * versions only, enforced by RLS). Published versions are immutable —
 * what was accepted is what is shown, forever.
 */
export default async function LegalDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = legalDocBySlug(slug);
  if (!meta) notFound();

  const supabase = await createServerClient();
  const { data: docData } = await supabase.from('legal_documents').select('*').eq('slug', slug).maybeSingle();
  const doc = (docData ?? null) as unknown as LegalDocument | null;
  if (!doc || doc.status !== 'published' || !doc.current_version) {
    // Not (yet) published in the DB — the doc exists in the registry, so 404 cleanly.
    notFound();
  }

  const [{ data: currentData }, { data: historyData }] = await Promise.all([
    supabase
      .from('legal_document_versions')
      .select('*')
      .eq('document_id', doc.id)
      .eq('version', doc.current_version)
      .eq('status', 'published')
      .maybeSingle(),
    supabase
      .from('legal_document_versions')
      .select('id,version,status,published_at,change_summary_ar')
      .eq('document_id', doc.id)
      .neq('version', doc.current_version)
      .order('version', { ascending: false })
      .limit(10),
  ]);
  const current = (currentData ?? null) as unknown as LegalDocumentVersion | null;
  const history = ((historyData ?? []) as unknown as Array<Pick<LegalDocumentVersion, 'id' | 'version' | 'status' | 'published_at' | 'change_summary_ar'>>) ?? [];

  return (
    <>
      <div className="container max-w-3xl py-8">
        <Link href="/legal" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          كل السياسات
        </Link>
        <h1 className="mt-4 text-2xl font-black">{doc.title_ar}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">الإصدار {doc.current_version}</Badge>
          {current?.published_at && (
            <span>
              نُشر: {new Date(current.published_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          )}
          {current?.change_summary_ar && <span>· {current.change_summary_ar}</span>}
        </div>
        <div className="mt-5 space-y-5">
          <LegalWarningBanner />
          <Card>
            <CardContent className="p-6">
              {current ? <MarkdownDoc content={current.content_md} /> : <p className="text-sm text-muted-foreground">تعذر تحميل محتوى الوثيقة.</p>}
            </CardContent>
          </Card>
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" aria-hidden="true" />
                  الإصدارات السابقة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {history.map((h) => (
                  <p key={h.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">الإصدار {h.version}</Badge>
                    <span>{h.status === 'superseded' ? 'مُستبدل' : h.status}</span>
                    {h.published_at && (
                      <span>
                        · {new Date(h.published_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    )}
                    {h.change_summary_ar && <span>· {h.change_summary_ar}</span>}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
