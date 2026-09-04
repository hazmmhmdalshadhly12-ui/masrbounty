export default function About() {
  return (
    <main className="container py-12 max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold">عن MasrBounty</h1>
      <p>MasrBounty is an Egyptian bug bounty platform connecting security researchers with companies through authorized, scoped testing programs.</p>
      <p><b>Researchers</b> submit vulnerability reports, earn bounties, build reputation, and collect badges.</p>
      <p><b>Companies</b> publish public or private programs with clear scope, rules, and bounty ranges, then triage and reward valid reports.</p>
      <p className="text-muted-foreground">Only authorized testing within program scope is allowed. Random scanning or attacks without permission are prohibited.</p>
    </main>
  );
}
