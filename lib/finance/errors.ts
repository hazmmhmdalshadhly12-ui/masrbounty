/** Map SQL RPC errors to Arabic user-facing messages (pure, testable). */
export function financeError(e: { message?: string } | null | undefined): string {
  const m = e?.message ?? '';
  if (/unauthorized/i.test(m)) return 'سجّل الدخول أولًا';
  if (/forbidden/i.test(m)) return 'غير مصرّح لك بهذه العملية';
  if (/confirmation required/i.test(m)) return 'لم يتم تأكيد العملية صراحةً';
  if (/insufficient funds|insufficient company balance/i.test(m)) return 'الرصيد المتاح لا يكفي — اشحن محفظتك أولًا';
  if (/insufficient reserved/i.test(m)) return 'تعذر تنفيذ العملية — الحجز غير كافٍ';
  if (/already decided|already awarded|already paid/i.test(m)) return 'تم تنفيذ هذه العملية مسبقًا';
  if (/report not accepted/i.test(m)) return 'لا يمكن اعتماد مكافأة إلا لتقرير مقبول';
  if (/invalid state/i.test(m)) return 'حالة العملية لا تسمح بهذا الإجراء';
  if (/invalid amount/i.test(m)) return 'مبلغ غير صالح';
  if (/reason required|note required/i.test(m)) return 'السبب/الملاحظة مطلوبة (٣ أحرف على الأقل)';
  if (/not found|wallet missing/i.test(m)) return 'غير موجود — تأكد من المعرف';
  if (/no commission configured/i.test(m)) return 'لم تُضبط نسبة العمولة بعد — تواصل مع الإدارة';
  return 'تعذّر تنفيذ العملية — حاول لاحقًا';
}
