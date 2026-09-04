'use client';

import { useState } from 'react';
import { createReportAction } from '@/features/reports/services';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CvssCalculator } from '@/components/reports/cvss-calculator';

export function ReportCreateForm({ programs }: { programs: { id: string; name: string }[] }) {
  const [cvss, setCvss] = useState('');

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader><CardTitle>تقرير جديد</CardTitle></CardHeader>
        <CardContent>
          <form action={createReportAction} className="space-y-4">
            <div>
              <Label>Program</Label>
              <select name="program_id" required className="mt-1 h-10 w-full rounded-md border px-3">
                {programs?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><Label>Title (10+ chars)</Label><Input name="title" required minLength={10} className="mt-1" /></div>
            <div><Label>Summary</Label><Textarea name="summary" required className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vuln type</Label><Input name="vulnerability_type" required placeholder="XSS, SQLi, IDOR…" className="mt-1" /></div>
              <div><Label>Severity</Label>
                <select name="severity" className="mt-1 h-10 w-full rounded-md border px-3">
                  <option value="informational">Informational</option><option value="low">Low</option>
                  <option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div><Label>Affected asset</Label><Input name="affected_asset" required placeholder="https://…" dir="ltr" className="mt-1" /></div>
            <div><Label>Description</Label><Textarea name="description" required className="mt-1" /></div>
            <div><Label>Impact</Label><Textarea name="impact" required className="mt-1" /></div>
            <div><Label>Reproduction steps</Label><Textarea name="reproduction_steps" required className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CVSS (0–10, اختياري)</Label>
                <Input name="cvss_score" type="number" min={0} max={10} step={0.1} dir="ltr" placeholder="7.5" className="mt-1" value={cvss} onChange={(e) => setCvss(e.target.value)} />
              </div>
              <div><Label>Remediation (optional)</Label><Textarea name="remediation" className="mt-1" /></div>
            </div>
            <Button type="submit" className="w-full bg-slate-900 font-bold text-white hover:bg-slate-700">إنشاء كمسودة</Button>
          </form>
        </CardContent>
      </Card>
      <div className="lg:sticky lg:top-20 lg:self-start">
        <CvssCalculator onPick={(s) => setCvss(String(s))} />
      </div>
    </div>
  );
}
