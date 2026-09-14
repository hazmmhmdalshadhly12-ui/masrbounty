'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ProgramFormValues {
  name: string;
  description: string;
  minBounty: number;
  maxBounty: number;
}

interface ProgramFormProps extends Omit<React.HTMLAttributes<HTMLFormElement>, 'onSubmit' | 'defaultValue'> {
  defaultValues?: Partial<ProgramFormValues>;
  submitting?: boolean;
  onSubmit?: (values: ProgramFormValues) => void | Promise<void>;
  title?: string;
}

function ProgramForm({ defaultValues, submitting = false, onSubmit, className, ...props }: ProgramFormProps) {
  const [values, setValues] = React.useState<ProgramFormValues>({
    name: defaultValues?.name ?? '',
    description: defaultValues?.description ?? '',
    minBounty: defaultValues?.minBounty ?? 50,
    maxBounty: defaultValues?.maxBounty ?? 1000,
  });
  const [error, setError] = React.useState<string | null>(null);

  const set = (key: keyof ProgramFormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const raw = e.target.value;
    setValues((v) => ({ ...v, [key]: key === 'name' || key === 'description' ? raw : Number(raw) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (values.name.trim().length < 3) {
      setError('Program name must be at least 3 characters.');
      return;
    }
    if (values.minBounty < 0 || values.maxBounty < values.minBounty) {
      setError('Max bounty must be greater than or equal to min bounty.');
      return;
    }
    setError(null);
    await onSubmit?.(values);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)} {...props}>
      <div className="space-y-2">
        <Label htmlFor="program-name">Program name</Label>
        <Input
          id="program-name"
          value={values.name}
          onChange={set('name')}
          placeholder="Acme Web Platform"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="program-description">Description</Label>
        <Textarea
          id="program-description"
          value={values.description}
          onChange={set('description')}
          placeholder="Describe the scope and goals of this program…"
          rows={4}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="program-min">Min bounty (USD)</Label>
          <Input id="program-min" type="number" min={0} value={values.minBounty} onChange={set('minBounty')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="program-max">Max bounty (USD)</Label>
          <Input id="program-max" type="number" min={0} value={values.maxBounty} onChange={set('maxBounty')} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save program'}
      </Button>
    </form>
  );
}

export { ProgramForm };
export type { ProgramFormProps };
