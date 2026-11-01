import type { ReactNode } from 'react';

export function PageHero({ kicker, title, desc, children }: { kicker: string; title: string; desc: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-slate-800 bg-navy text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to left, rgb(148 163 184 / 0.4) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.4) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-amber-500/[0.08] via-transparent to-transparent" />
      <div className="container relative flex flex-col gap-6 py-12 md:flex-row md:items-end md:justify-between md:py-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {kicker}
          </span>
          <h1 className="mt-4 text-3xl font-black md:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-slate-300">{desc}</p>
        </div>
        {children ? <div className="flex shrink-0 flex-wrap gap-2">{children}</div> : null}
      </div>
    </section>
  );
}
