import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/services/audit';

export type ServiceResult<T> = { data: T | null; error: string | null };

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

type Db = SupabaseClient;

async function getDb(client?: Db): Promise<Db> {
  return client ?? ((await createServerClient()) as unknown as Db);
}

function err(e: unknown, fallback = 'Unexpected error'): string {
  return e instanceof Error ? e.message : fallback;
}

async function requireUser(db: Db): Promise<string> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error('Unauthorized');
  return auth.user.id;
}

/** Open a ticket; optionally seeds the thread with a first message. */
export async function createTicket(
  subject: string,
  body?: string,
  client?: Db
): Promise<ServiceResult<SupportTicket>> {
  try {
    const cleanSubject = subject.trim();
    if (cleanSubject.length < 5) return { data: null, error: 'Subject must be at least 5 characters' };
    const db = await getDb(client);
    const userId = await requireUser(db);
    const { data: ticket, error } = await db
      .from('support_tickets')
      .insert({ user_id: userId, subject: cleanSubject.slice(0, 200), status: 'open' })
      .select('*')
      .single();
    if (error || !ticket) return { data: null, error: error?.message ?? 'Create failed' };
    const t = ticket as SupportTicket;
    const first = body?.trim();
    if (first) {
      await db.from('support_messages').insert({ ticket_id: t.id, author_id: userId, body: first.slice(0, 10000) });
    }
    await logAudit('create', 'support_tickets', t.id, { subject: cleanSubject }, userId);
    try {
      revalidatePath('/support');
    } catch {
      /* ignore */
    }
    return { data: t, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function listTickets(
  filters?: { status?: TicketStatus; limit?: number },
  client?: Db
): Promise<ServiceResult<SupportTicket[]>> {
  try {
    const db = await getDb(client);
    let q = db.from('support_tickets').select('*').order('updated_at', { ascending: false });
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.limit) q = q.limit(filters.limit);
    const { data, error } = await q;
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as SupportTicket[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function getTicket(id: string, client?: Db): Promise<ServiceResult<SupportTicket>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db.from('support_tickets').select('*').eq('id', id).single();
    if (error || !data) return { data: null, error: error?.message ?? 'Ticket not found' };
    return { data: data as SupportTicket, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function addTicketMessage(
  ticketId: string,
  body: string,
  client?: Db
): Promise<ServiceResult<SupportMessage>> {
  try {
    const clean = body.trim();
    if (!clean) return { data: null, error: 'Message is empty' };
    if (clean.length > 10000) return { data: null, error: 'Message too long' };
    const db = await getDb(client);
    const userId = await requireUser(db);
    const { data: ticket } = await db.from('support_tickets').select('id,status').eq('id', ticketId).maybeSingle();
    if (!ticket) return { data: null, error: 'Ticket not found or not authorized' };
    if ((ticket as { status: TicketStatus }).status === 'closed') {
      return { data: null, error: 'Ticket is closed' };
    }
    const { data, error } = await db
      .from('support_messages')
      .insert({ ticket_id: ticketId, author_id: userId, body: clean })
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Send failed' };
    await db.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);
    return { data: data as SupportMessage, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function listTicketMessages(
  ticketId: string,
  client?: Db
): Promise<ServiceResult<SupportMessage[]>> {
  try {
    const db = await getDb(client);
    const { data, error } = await db
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as SupportMessage[], error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  client?: Db
): Promise<ServiceResult<SupportTicket>> {
  try {
    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return { data: null, error: 'Invalid status' };
    }
    const db = await getDb(client);
    const userId = await requireUser(db);
    const { data, error } = await db
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId)
      .select('*')
      .single();
    if (error || !data) return { data: null, error: error?.message ?? 'Update failed' };
    await logAudit('update', 'support_tickets', ticketId, { status }, userId);
    try {
      revalidatePath('/support');
    } catch {
      /* ignore */
    }
    return { data: data as SupportTicket, error: null };
  } catch (e) {
    return { data: null, error: err(e) };
  }
}
