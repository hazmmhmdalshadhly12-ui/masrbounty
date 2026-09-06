import './globals.css';
import { Cairo, Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/toaster';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import type { Metadata } from 'next';

export const runtime = 'edge';

const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-cairo', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'MasrBounty', template: '%s | MasrBounty' },
  description: 'Egyptian Bug Bounty Platform — Authorized security testing only',
  icons: { icon: '/logo.svg', apple: '/logo.svg' },
  manifest: '/manifest.json',
  themeColor: '#0a1628',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} ${inter.variable} ${mono.variable}`}>
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-amber-400 focus:px-4 focus:py-2 focus:text-slate-950">
          تخطَّ إلى المحتوى
        </a>
        <ThemeProvider>
          <QueryProvider>
            <Header />
            <main id="content" className="min-h-[80vh] pb-16 md:pb-0">{children}</main>
            <Footer />
            <MobileBottomNav />
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
