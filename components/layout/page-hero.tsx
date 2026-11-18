import type { ReactNode } from 'react';

export function PageHero({ kicker, title, desc, children }: { kicker: string; title: string; desc: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-navy-800/60 bg-navy text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-ink" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px hairline-x" />
      <div className="container relative flex flex-col gap-6 py-14 md:flex-row md:items-end md:justify-between md:py-16">
        <div className="animate-fade-up">
          <p className="kicker text-amber-400">{kicker}</p>
          <h1 className="mt-4 text-3xl font-black md:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-navy-100/90">{desc}</p>
        </div>
        {children ? <div className="flex shrink-0 flex-wrap gap-2">{children}</div> : null}
      </div>
    </section>
  );
}
