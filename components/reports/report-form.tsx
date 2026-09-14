'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ReportFormValues {
  title: string;
  severity: string;
  affectedAsset: string;
  description: string;
  impact: string;
  reproductionSteps: string;
}

interface ReportFormProps extends Omit<React.HTMLAttributes<HTMLFormElement>, 'onSubmit' | 'defaultValue'> {
  programId?: string;
  defaultValues?: Partial<ReportFormValues>;
  submitting?: boolean;
  onSubmit?: (values: ReportFormValues) => void | Promise<void>;
  title?: string;
}

const severities = ['informational', 'low', 'medium', 'high', 'critical'];

function ReportForm({
  programId,
  defaultValues,
  submitting = false,
  onSubmit,
  className,
  ...props
}: ReportFormProps) {
  const [values, setValues] = React.useState<ReportFormValues>({
    title: defaultValues?.title ?? '',
    severity: defaultValues?.severity ?? 'medium',
    affectedAsset: defaultValues?.affectedAsset ?? '',
    description: defaultValues?.description ?? '',
    impact: defaultValues?.impact ?? '',
    reproductionSteps: defaultValues?.reproductionSteps ?? '',
  });
  const [error, setError] = React.useState<string | null>(null);

  const set = (key: keyof ReportFormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (values.title.trim().length < 10) {
      setError('Title must be at least 10 characters.');
      return;
    }
    if (values.description.trim().length < 30) {
      setError('Description must be at least 30 characters.');
      return;
    }
    setError(null);
    await onSubmit?.(values);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)} {...props}>
      {programId && <input type="hidden" name="program_id" value={programId} />}
      <div className="space-y-2">
        <Label htmlFor="report-title">Title</Label>
        <Input
          id="report-title"
          value={values.title}
          onChange={set('title')}
          placeholder="Stored XSS in company profile bio"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="report-severity">Severity</Label>
          <select
            id="report-severity"
            value={values.severity}
            onChange={set('severity')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {severities.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-asset">Affected asset</Label>
          <Input
            id="report-asset"
            value={values.affectedAsset}
            onChange={set('affectedAsset')}
            placeholder="https://example.com/profile"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="report-description">Description</Label>
        <Textarea
          id="report-description"
          value={values.description}
          onChange={set('description')}
          placeholder="Describe the vulnerability in detail…"
          rows={5}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="report-impact">Impact</Label>
        <Textarea
          id="report-impact"
          value={values.impact}
          onChange={set('impact')}
          placeholder="What can an attacker achieve?"
          rows={3}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="report-repro">Reproduction steps</Label>
        <Textarea
          id="report-repro"
          value={values.reproductionSteps}
          onChange={set('reproductionSteps')}
          placeholder="1. … 2. … 3. …"
          rows={4}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit report'}
      </Button>
    </form>
  );
}

export { ReportForm };
export type { ReportFormProps };
