import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t mt-16">
      <div className="container py-8 flex flex-col md:flex-row justify-between gap-4 text-sm text-muted-foreground">
        <p>MasrBounty © {new Date().getFullYear()} — Authorized testing only</p>
        <div className="flex gap-4">
          <Link href="/about">About</Link>
          <Link href="/security">Security</Link>
          <Link href="/faq">FAQ</Link>
        </div>
      </div>
    </footer>
  );
}
