'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const OPT = {
  av: [['network', 'شبكة', 0.85], ['adjacent', 'مجاورة', 0.62], ['local', 'محلية', 0.55], ['physical', 'فيزيائية', 0.2]],
  ac: [['low', 'منخفض', 0.77], ['high', 'مرتفع', 0.44]],
  pr: [['none', 'بلا', 0.85], ['low', 'منخفضة', 0.62], ['high', 'عالية', 0.27]],
  ui: [['none', 'بلا', 0.85], ['required', 'مطلوب', 0.62]],
  impact: [['none', 'لا يوجد', 0], ['low', 'منخفض', 0.22], ['high', 'مرتفع', 0.56]],
} as const;

type Key = keyof typeof OPT;

function Row({ k, label, v, set }: { k: Key; label: string; v: string; set: (x: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {(OPT[k] as readonly (readonly [string, string, number])[]).map(([val, ar]) => (
          <button
            key={val}
            type="button"
            onClick={() => set(val)}
            className={`rounded-md border px-2.5 py-1 text-xs ${v === val ? 'border-slate-900 bg-slate-900 font-bold text-white dark:bg-slate-100 dark:text-slate-900' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {ar}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CvssCalculator({ onPick }: { onPick: (score: number) => void }) {
  const [av, setAv] = useState('network');
  const [ac, setAc] = useState('low');
  const [pr, setPr] = useState('none');
  const [ui, setUi] = useState('none');
  const [c, setC] = useState('high');
  const [i, setI] = useState('high');
  const [a, setA] = useState('low');

  const score = useMemo(() => {
    const get = (k: Key, v: string) => (OPT[k] as readonly (readonly [string, string, number])[]).find((o) => o[0] === v)?.[2] ?? 0;
    const exploit = 8.22 * get('av', av) * get('ac', ac) * get('pr', pr) * get('ui', ui);
    const isc = 1 - (1 - get('impact', c)) * (1 - get('impact', i)) * (1 - get('impact', a));
    if (isc <= 0) return 0;
    const impact = 6.42 * isc;
    const s = Math.min(impact + exploit, 10);
    return Math.round(s * 10) / 10;
  }, [av, ac, pr, ui, c, i, a]);

  return (
    <Card>
      <CardHeader><CardTitle>حاسبة CVSS تقديرية</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Row k="av" label="منفذ الهجوم" v={av} set={setAv} />
        <Row k="ac" label="التعقيد" v={ac} set={setAc} />
        <Row k="pr" label="الصلاحيات المطلوبة" v={pr} set={setPr} />
        <Row k="ui" label="تفاعل المستخدم" v={ui} set={setUi} />
        <Row k="impact" label="سرية الأثر" v={c} set={setC} />
        <Row k="impact" label="سلامة الأثر" v={i} set={setI} />
        <Row k="impact" label="توافر الأثر" v={a} set={setA} />
        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-2xl font-black tabular-nums" dir="ltr">{score.toFixed(1)}</p>
          <Button type="button" size="sm" onClick={() => onPick(score)}>استخدام الدرجة</Button>
        </div>
      </CardContent>
    </Card>
  );
}
