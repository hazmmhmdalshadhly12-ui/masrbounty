'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema } from '@/schemas/auth';
import { enforceRate, limits } from '@/lib/rate-limit';
import { logAudit, logSecurityEvent } from '@/services/audit';

function clientIp(): string {
  try {
    return headers().get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function loginAction(formData: FormData) {
  enforceRate(`login:${clientIp()}`, limits.login.max, limits.login.windowMs);
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) throw new Error('Invalid credentials format');
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    await logSecurityEvent('login.failed', parsed.data.email, undefined, clientIp());
    throw new Error(error.message);
  }
  await logAudit('login', 'session', data.user?.id, {}, data.user?.id);
  redirect('/dashboard');
}

export async function registerAction(formData: FormData) {
  enforceRate(`register:${clientIp()}`, limits.register.max, limits.register.windowMs);
  const parsed = registerSchema.safeParse({
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  });
  if (!parsed.success) throw new Error('Invalid registration data');
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { username: parsed.data.username, role: parsed.data.role } },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Registration failed');
  // Create profile row (RLS allows own insert)
  await supabase.from('profiles').insert({
    id: data.user.id,
    username: parsed.data.username,
  });
  await supabase.from('user_roles').insert({ user_id: data.user.id, role: parsed.data.role });
  if (parsed.data.role === 'researcher') {
    const { data: rp } = await supabase
      .from('researcher_profiles')
      .insert({ user_id: data.user.id, display_name: parsed.data.username })
      .select('id')
      .single();
    if (rp) {
      await supabase.from('wallets').insert({ researcher_id: rp.id });
      await supabase.from('researcher_reputation').insert({ researcher_id: rp.id, score: 0 });
      await supabase.from('researcher_stats').insert({ researcher_id: rp.id });
    }
  }
  redirect('/login');
}

export async function logoutAction() {
  const supabase = createServerClient();
  await supabase.auth.signOut();
  redirect('/');
}
