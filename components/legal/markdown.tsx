import type { ReactNode } from 'react';

/**
 * Minimal, dependency-free markdown renderer for legal documents.
 * Supports the subset used by the seeded policies: `##`/`###` headings,
 * `>` notice blocks, `-` lists, paragraphs and **bold** spans.
 * Builds React elements directly — never dangerouslySetInnerHTML.
 */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const parts = text.split(/\*\*(.+?)\*\*/g);
  parts.forEach((part, i) => {
    if (!part) return;
    out.push(i % 2 === 1 ? <strong key={`${keyBase}-b${i}`}>{part}</strong> : <span key={`${keyBase}-s${i}`}>{part}</span>);
  });
  return out;
}

export function MarkdownDoc({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (para.length) {
      const text = para.join(' ');
      blocks.push(<p key={`p${k++}`} className="leading-relaxed">{inline(text, `p${k}`)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul${k++}`} className="list-disc space-y-1.5 pr-5">
          {list.map((item, i) => (
            <li key={i} className="leading-relaxed">{inline(item, `li${k}-${i}`)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      blocks.push(
        <blockquote key={`q${k++}`} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium leading-relaxed text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
          {inline(quote.join(' '), `q${k}`)}
        </blockquote>
      );
      quote = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      flushAll();
      blocks.push(<h3 key={`h3${k++}`} className="mt-6 text-base font-black">{inline(line.replace(/^###\s+/, ''), `h3${k}`)}</h3>);
    } else if (/^##\s+/.test(line)) {
      flushAll();
      blocks.push(<h2 key={`h2${k++}`} className="mt-8 border-b pb-2 text-lg font-black">{inline(line.replace(/^##\s+/, ''), `h2${k}`)}</h2>);
    } else if (/^#\s+/.test(line)) {
      flushAll();
      blocks.push(<h1 key={`h1${k++}`} className="mt-4 text-xl font-black">{inline(line.replace(/^#\s+/, ''), `h1${k}`)}</h1>);
    } else if (/^>\s?/.test(line)) {
      flushPara();
      flushList();
      quote.push(line.replace(/^>\s?/, ''));
    } else if (/^[-*]\s+/.test(line)) {
      flushPara();
      flushQuote();
      list.push(line.replace(/^[-*]\s+/, ''));
    } else if (line.trim() === '') {
      flushAll();
    } else {
      flushList();
      flushQuote();
      para.push(line.trim());
    }
  }
  flushAll();

  return <div className="space-y-4 text-sm">{blocks}</div>;
}
