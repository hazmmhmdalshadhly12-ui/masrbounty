'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema } from '@/schemas/auth';
import { enforceRate, limits } from '@/lib/rate-limit';
import { logAudit, logSecurityEvent } from '@/services/audit';

async function clientIp(): Promise<string> {
  try {
    return (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('email not confirmed')) return 'لم يتم تأكيد البريد بعد — افتح رابط التفعيل في إيميلك ثم حاول الدخول';
  if (m.includes('invalid login credentials')) return 'البريد أو كلمة السر غير صحيحة';
  if (m.includes('user already registered') || m.includes('already exists')) return 'هذا البريد مسجل بالفعل — سجّل الدخول بدلًا من ذلك';
  if (m.includes('password')) return 'كلمة السر قصيرة أو غير صالحة (8 أحرف على الأقل)';
  return 'حدث خطأ — حاول مرة أخرى';
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) redirect('/login?error=' + encodeURIComponent('صيغة الدخول غير صالحة'));
  let ip = 'unknown';
  try {
    ip = await clientIp();
  } catch {
    /* ignore */
  }
  enforceRate(`login:${ip}`, limits.login.max, limits.login.windowMs);
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    await logSecurityEvent('login.failed', parsed.data.email, undefined, ip);
    redirect('/login?error=' + encodeURIComponent(friendlyAuthError(error.message)));
  }
  await logAudit('login', 'session', data.user?.id, {}, data.user?.id);
  redirect('/dashboard');
}

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  });
  if (!parsed.success) redirect('/register?error=' + encodeURIComponent('بيانات التسجيل غير صالحة'));
  let ip = 'unknown';
  try {
    ip = await clientIp();
  } catch {
    /* ignore */
  }
  enforceRate(`register:${ip}`, limits.register.max, limits.register.windowMs);
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { username: parsed.data.username, role: parsed.data.role } },
  });
  if (error) redirect('/register?error=' + encodeURIComponent(friendlyAuthError(error.message)));
  if (!data.user) redirect('/register?error=' + encodeURIComponent('فشل إنشاء الحساب — حاول مرة أخرى'));
  // Create profile row (RLS allows own insert)
  const { error: pErr } = await supabase.from('profiles').insert({
    id: data.user.id,
    username: parsed.data.username,
  });
  if (pErr) redirect('/register?error=' + encodeURIComponent('اسم المستخدم مستخدم بالفعل — اختر اسمًا آخر'));
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
  redirect('/login?ok=' + encodeURIComponent('تم إنشاء الحساب — سجّل الدخول الآن'));
}

export async function requestResetAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email.includes('@')) redirect('/forgot-password?error=' + encodeURIComponent('بريد غير صالح'));
  const supabase = await createServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/auth/update-password`,
  });
  if (error) redirect('/forgot-password?error=' + encodeURIComponent(friendlyAuthError(error.message)));
  redirect('/forgot-password?sent=1');
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) redirect('/auth/update-password?error=' + encodeURIComponent('كلمة السر 8 أحرف على الأقل'));
  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/auth/update-password?error=' + encodeURIComponent(friendlyAuthError(error.message)));
  redirect('/login?ok=' + encodeURIComponent('تم تغيير كلمة السر — سجّل الدخول'));
}

export async function logoutAction() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/');
}
