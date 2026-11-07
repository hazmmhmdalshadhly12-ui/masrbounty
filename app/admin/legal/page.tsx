import { requireSession } from '@/lib/auth/guard';
import { createServerClient } from '@/lib/supabase/server';
import { LegalManager } from '@/components/admin/legal-manager';
import type { LegalAcceptance, LegalDocument, LegalDocumentVersion } from '@/types/legal';

export const dynamic = 'force-dynamic';

export default async function AdminLegalPage() {
  await requireSession({ roles: ['admin'], next: '/admin/legal' });

  const supabase = await createServerClient();
  const [{ data: docs }, { data: versions }, { data: acceptances }] = await Promise.all([
    supabase.from('legal_documents').select('*').order('sort_order'),
    supabase.from('legal_document_versions').select('id,document_id,version,status,change_summary_ar,published_at,created_at,content_md').order('version', { ascending: false }).limit(120),
    supabase.from('legal_acceptances').select('*').order('accepted_at', { ascending: false }).limit(100),
  ]);

  const docRows = (docs ?? []) as unknown as LegalDocument[];
  const versionRows = (versions ?? []) as unknown as Array<Pick<LegalDocumentVersion, 'id' | 'document_id' | 'version' | 'status' | 'change_summary_ar' | 'published_at' | 'created_at' | 'content_md'>>;
  const acceptanceRows = (acceptances ?? []) as unknown as LegalAcceptance[];

  return (
    <div className="container space-y-6 py-8">
      <LegalManager docs={docRows} versions={versionRows} acceptances={acceptanceRows} />
    </div>
  );
}
