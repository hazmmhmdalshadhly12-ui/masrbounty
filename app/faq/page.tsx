const QA = [
  ['How do report numbers work?', 'Every report gets a unique MB-000001 style number generated safely in PostgreSQL.'],
  ['How do I get paid?', 'Approved bounties credit your wallet. Request a payout; an admin reviews and completes it.'],
  ['What can I test?', 'Only assets explicitly listed in an active program scope. Out-of-scope testing is forbidden.'],
  ['How are disputes handled?', 'Open a dispute on the report. The company responds; moderators review and resolve.'],
  ['Is my data private?', 'Report attachments are private storage. Only the reporter, program company team, and admins can access them.'],
];

export default function Faq() {
  return (
    <main className="container py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">الأسئلة الشائعة</h1>
      {QA.map(([q, a]) => <div key={q} className="border rounded-md p-4 mb-3"><p className="font-semibold">{q}</p><p className="text-sm text-muted-foreground mt-1">{a}</p></div>)}
    </main>
  );
}
