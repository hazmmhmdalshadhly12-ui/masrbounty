/** Shared, framework-free mapping of Supabase auth errors to Arabic messages. */

export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('email not confirmed')) return 'لم يتم تأكيد البريد بعد — افتح رابط التفعيل في إيميلك ثم حاول الدخول';
  if (m.includes('invalid login credentials')) return 'البريد أو كلمة السر غير صحيحة';
  if (m.includes('user already registered') || m.includes('already exists') || m.includes('duplicate'))
    return 'هذا البريد مسجل بالفعل — سجّل الدخول بدلًا من ذلك';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('exceeded') || m.includes('over_email_send_rate_limit'))
    return 'طلبات كثيرة في وقت قصير (حد Supabase للإيميلات) — انتظر 10 دقائق وحاول مجددًا';
  if (m.includes('signup') && m.includes('disabled')) return 'التسجيل متوقف مؤقتًا — حاول لاحقًا';
  // Recovery-specific failures must map BEFORE the generic 'email invalid'
  // and 'password' rules: descriptions like "Email link is invalid or has
  // expired" contain both words and would otherwise be misclassified.
  if (m.includes('auth session missing') || m.includes('session missing'))
    return 'انتهت جلسة الاستعادة — اطلب رابط استعادة جديدًا ثم أعد المحاولة';
  if (m.includes('otp_expired') || m.includes('email link is invalid or has expired') || m.includes('already been used'))
    return 'انتهت صلاحية رابط الاستعادة أو استُخدم مسبقًا — اطلب رابطًا جديدًا';
  if (m.includes('code verifier'))
    return 'تعذر التحقق تلقائيًا — افتح رابط الاستعادة الجديد من نفس المتصفح الذي طُلبت منه';
  if (m.includes('different from the old password'))
    return 'كلمة السر الجديدة مطابقة للحالية — اختر كلمة سر مختلفة';
  if (m.includes('email') && (m.includes('invalid') || m.includes('not valid'))) return 'البريد الإلكتروني غير صالح';
  if (m.includes('password')) return 'كلمة السر قصيرة أو غير صالحة (8 أحرف على الأقل)';
  if (m.includes('phone')) return 'رقم الهاتف غير صالح';
  if (m.includes('network') || m.includes('fetch') || m.includes('timeout')) return 'تعذر الوصول لخدمة المصادقة — تحقق من الإنترنت وحاول مجددًا';
  if (m.includes('smtp') || m.includes('sending') || m.includes('send email') || m.includes('mailer'))
    return 'فشل إرسال بريد التفعيل (إعدادات SMTP) — راجع إعدادات البريد في Supabase أو عطّل SMTP المخصص مؤقتًا';
  return 'حدث خطأ — حاول مرة أخرى';
}
