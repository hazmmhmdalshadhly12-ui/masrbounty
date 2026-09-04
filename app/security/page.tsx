export default function Security() {
  return (
    <main className="container py-12 max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold">الأمان</h1>
      <p>MasrBounty enforces security at the database layer with Row Level Security on all 50 tables, server-side authorization in every Server Action, Zod validation on all inputs, private report attachments, audit logging, and security headers.</p>
      <p>Found a vulnerability in MasrBounty itself? Email <span dir="ltr">security@masrbounty.com</span> — see SECURITY.md for responsible disclosure. Do not open public issues for security reports.</p>
    </main>
  );
}
