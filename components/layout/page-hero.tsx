export function PageHero({ kicker, title, desc }: { kicker: string; title: string; desc: string }) {
  return (
    <section className="bg-[#0a1628] text-white">
      <div className="container py-10">
        <span className="inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
          {kicker}
        </span>
        <h1 className="mt-3 text-3xl font-black md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-slate-300">{desc}</p>
      </div>
    </section>
  );
}
