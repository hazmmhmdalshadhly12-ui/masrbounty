import Link from 'next/link';
import { notFound } from 'next/navigation';
import { posts } from '@/constants/blog';

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();
  return (
    <main className="container max-w-2xl py-12">
      <p className="text-xs text-muted-foreground">{post.date} — مدونة MasrBounty</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">{post.title}</h1>
      <div className="mt-8 space-y-5">
        {post.body.map((para, i) => (
          <p key={i} className="leading-loose text-slate-700 dark:text-slate-300">{para}</p>
        ))}
      </div>
      <Link href="/blog" className="mt-10 inline-block text-sm underline">كل المقالات</Link>
    </main>
  );
}
