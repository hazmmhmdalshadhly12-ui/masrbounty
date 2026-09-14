import { z } from 'zod';

export const companySchema = z.object({
  id: z.string().uuid().optional(),
});

export const companyProfileSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  website: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  country: z.string().length(2).optional(),
});

export const inviteMemberSchema = z.object({
  company_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'triager', 'viewer']),
});

export const updateMemberRoleSchema = z.object({
  company_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'triager', 'viewer']),
});

export type CompanyFormInput = z.infer<typeof companyProfileSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
