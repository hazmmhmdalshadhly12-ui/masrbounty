import Link from 'next/link';
export default function Home() {
  return (<main className="container py-16"><h1 className="text-4xl font-bold">MasrBounty — منصة Bug Bounty مصرية</h1><p className="mt-4 text-muted-foreground">Authorized security testing only.</p><div className="mt-6 flex gap-3"><Link href="/programs">Programs</Link><Link href="/leaderboard">Leaderboard</Link><Link href="/hall-of-fame">Hall of Fame</Link></div></main>);
}
