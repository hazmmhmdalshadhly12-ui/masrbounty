import { z } from 'zod';
import { reportSchema } from '@/schemas/report';
export type ReportInput=z.infer<typeof reportSchema>;
export type ReportStatus='draft'|'submitted'|'triaged'|'informative'|'duplicate'|'not_applicable'|'accepted'|'resolved'|'closed';
