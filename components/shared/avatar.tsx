import Image from 'next/image';
import { cn } from '@/lib/utils';

const palette = [
  'bg-slate-900 text-amber-400',
  'bg-emerald-900 text-emerald-200',
  'bg-blue-900 text-blue-200',
  'bg-violet-900 text-violet-200',
  'bg-rose-900 text-rose-200',
  'bg-cyan-900 text-cyan-200',
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return palette[h % palette.length] as string;
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  if (src) {
    const dims = size === 'sm' ? 32 : size === 'lg' ? 56 : 40;
    // unoptimized: avatars are tiny remote files; skipping the image
    // optimizer removes an entire native-code attack surface (libvips).
    return (
      <Image
        src={src}
        alt={name}
        width={dims}
        height={dims}
        unoptimized
        className={cn('rounded-full object-cover', sizes[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full font-black', sizes[size], colorFor(name), className)}
    >
      {initial}
    </span>
  );
}
