# DATABASE_CHANGES — التغييرات على قاعدة البيانات

> فرع `feature/smart-wallet-finance` — ثلاثة ترحيلات جديدة مرقّمة بالتسلسل بعد `23_domain_review_flow.sql`.
> جميع الترحيلات **idempotent** (قابلة لإعادة التشغيل بأمان) وتتبع نمط 21/22 (`IF NOT EXISTS` / `DROP POLICY IF EXISTS` / DO $$ blocks).

---

## Migration 24 — `24_smart_wallet_finance.sql`

### Enums (جديدة + توسعة additive)

| Enum | التغيير |
| --- | --- |
| `reward_state` | جديد: `reward_approved, awaiting_payout, processing, paid, failed, cancelled` |
| `commission_scope` | جديد: `global, company` |
| `ledger_entry_type` | جديد: `debit, credit` |
| `report_status` | **إضافة قيم فقط** (لا تغيير في الموجود): `under_review, need_more_info, rejected, reward_approved, paid` |

### company_wallets (توسعة — لا أعمدة تُحذف)

أعمدة جديدة (كلها `BIGINT NOT NULL DEFAULT 0`):
- `available_balance_minor` — CHECK ≥ 0
- `reserved_balance_minor` — CHECK ≥ 0
- `total_deposits_minor`, `total_rewards_minor`, `total_fees_minor`
- `currency TEXT DEFAULT 'EGP' CHECK (currency='EGP')`

ترحيل بيانات لمرة واحدة: `available_balance_minor = ROUND(balance*100)` للصفوف غير الممسودة.

### جداول جديدة (10)

1. **`wallet_deposit_requests`** — طلبات إيداع الشركات: `amount_minor > 0`, method CHECK, `reference NOT NULL`, `proof_url`, `status deposit_status`, `reviewed_by/at/note`, `transaction_id`. فهارس: company+created_at, partial pending. **RLS**: SELECT لأعضاء الشركة/الإدارة؛ INSERT فقط `status='pending'` + `has_company_permission(company_id,'manage_payouts')`؛ لا UPDATE للعميل (الاعتماد عبر RPC).
2. **`wallet_transactions_v2`** — `type CHECK IN (deposit, bounty_hold, bounty_release, bounty_refund, adjustment)`, `direction in/out`, `amount_minor > 0`, رصيدا «بعد»، `idempotency_key TEXT UNIQUE`, `reference_type/id`. **Trigger `wtxn2_immutable`**: منع UPDATE/DELETE. **RLS**: SELECT فقط (إدارة/صاحب المحفظة).
3. **`financial_ledger_entries`** — `account_key`, `account_type CHECK (company_available/company_reserved/platform_revenue/external)`, `entity_id`, `entry_type CHECK (debit/credit)`, `amount_minor > 0`. **Trigger `ledger_immutable`** (append-only). **RLS**: SELECT (الإدارة الكل، الشركة حساباتها فقط عبر entity_id).
4. **`bounty_rewards`** — `report_id UNIQUE`, `reward_amount_minor > 0`, `commission_rate_bp CHECK 0–10000`, `commission_amount_minor ≥ 0`, `total_charged_minor > 0`, `status reward_state`, `approved_by/at`, `paid_at`. **RLS**: SELECT (باحث صاحبها / شركة صاحبتها / إدارة). **لا كتابة من العميل.**
5. **`researcher_payouts`** — `reward_id FK`, `amount_minor > 0`, `status reward_state DEFAULT awaiting_payout`, `proof_url`, `payment_reference`, `failure_reason`, `processed_by`, `paid_at`. **RLS**: SELECT فقط بنفس ثلاثية الرؤية.
6. **`commission_settings`** — `scope commission_scope`, `company_id NULLABLE`, `rate_bp CHECK 0–10000`, `is_active`. فهارس فريدة جزئية: صف عام واحد نشط + صف واحد لكل شركة. **RLS**: SELECT (الإدارة/العامة/الشركة صاحبة النسبة). لا كتابة من العميل.
7. **`commission_history`** — سجل كل تغيير/تفعيل مع `old_rate_bp/new_rate_bp/reason/changed_by`. RLS: SELECT admin فقط.
8. **`financial_approvals`** — قرارات الإدارة (`entity_type CHECK`, `action CHECK`). RLS: SELECT admin.
9. **`financial_audit_logs`** — تدقيق مالي JSONB. **Trigger `fin_audit_immutable`**. RLS: SELECT admin.

### دوال جديدة (10 — كلها `SECURITY DEFINER SET search_path = public, pg_temp`)

| الدالة | الوظيفة والحماية |
| --- | --- |
| `get_effective_commission_rate(p_company)` | النسبة الخاصة النشطة → العامة؛ يرفع خطأ إن لم تُضبط. |
| `set_commission_rate(p_scope, p_company, p_rate_bp, p_reason)` | admin فقط؛ يوقف القديم، ينشئ جديدًا، يكتب history + audit. |
| `toggle_company_commission(p_company, p_activate)` | admin فقط؛ تفعيل/إيقاف النسبة الخاصة + history + audit. |
| `review_deposit_request_v2(p_request, p_approve, p_note, p_idempotency_key)` | admin؛ قفل صف الطلب `FOR UPDATE` + شرط `status='pending'`؛ الاعتماد: قفل المحفظة + إضافة **مرة واحدة** + قيد T1 + approvals + audit. |
| `approve_bounty_reward(p_report, p_reward_amount_minor, p_confirm, p_idempotency_key)` | عضوية `manage_payouts`/admin؛ `p_confirm IS TRUE` إلزامية؛ التقرير `accepted`؛ idempotency (مفتاح + `report_id UNIQUE`)؛ قفل المحفظة؛ فحص الكفاية؛ حجز T=R+C؛ إنشاء reward + payout؛ قيد T2؛ مزامنة محفظة الباحث؛ حالة التقرير `reward_approved`. |
| `start_reward_payout(p_payout)` | admin؛ `awaiting_payout → processing` فقط. |
| `complete_reward_payout(p_payout, p_proof_url, p_reference, p_idempotency_key)` | admin؛ قفل الصرف+المكافأة+المحفظة؛ الحالة يجب أن تكون حية؛ تحرير الحجز؛ قيد T3؛ `paid`؛ حالة التقرير `paid`؛ إضافة رصيد الباحث القابل للسحب. |
| `fail_reward_payout(p_payout, p_reason, p_cancel)` | admin؛ سبب إلزامي؛ **إرجاع الحجز دائمًا** (قيد T4)؛ `failed/cancelled`؛ المكافأة تعود `reward_approved`. |
| `retry_reward_payout(p_reward)` | إعادة حجز `total_charged_minor` **المقفول** دون إعادة تسعير + صف payout جديد. |
| `adjust_company_wallet_v2(p_company, p_amount_minor, p_note, p_idempotency_key)` | admin؛ سبب ≥3؛ منع السحب لأقل من صفر؛ قيد T5 + audit. |

### Seed
`commission_settings`: صف عام واحد `rate_bp = 2000` (20%) إذا لم يوجد أي صف عام — **بيانات إعداد**، تغييرها من الإدارة.

---

## Migration 25 — `25_legal_system.sql`

### جداول جديدة (3)

1. **`legal_documents`** — `slug UNIQUE` (regex), `title_ar`, `category CHECK (core/bounty/company/researcher/data)`, `current_version`, `status (draft/published)`, `requires_reacceptance`, `sort_order`.
2. **`legal_document_versions`** — `UNIQUE(document_id, version)`, `content_md CHECK 50–200000`, `status (draft/published/superseded)`, `published_by/at`, `change_summary_ar`.
   - **Trigger `legal_ver_immutable`**: الـ draft وحده قابل للتحرير؛ المنشور/المستبدل لا يُعدل ولا يُحذف إطلاقًا.
3. **`legal_acceptances`** — `user_id`, `document_slug`, `version > 0`, `context (registration/reacceptance/update)`, `age_confirmed`, `accepted_at`.
   - **Trigger `legal_acc_immutable`**: سجل موافقة لا يُعدل ولا يُحذف — إثبات دائم.

### RLS
- `legal_documents`: قراءة للجميع (incl. anon)؛ كتابة admin.
- `legal_document_versions`: قراءة للمنشور/المستبدل للجميع + admin الكل؛ كتابة admin فقط (والtrigger يمنع التعديل بعد النشر).
- `legal_acceptances`: SELECT للمالك/الإدارة — **لا سياسة INSERT للعميل إطلاقًا**؛ الكتابة فقط عبر RPC.

### دوال (3)
- `publish_legal_version(slug, version, requires_reacceptance)` — admin؛ **المسودة فقط** تُنشر؛ يستبدل المنشور السابق (`superseded`)؛ يحدّث `current_version` + audit.
- `accept_legal_agreement(p_slugs[], p_versions[], p_age_confirmed, p_context)` — للجلسة الحالية؛ يرفض: عدم تأكيد العمر، طول المصفوفات غير متطابق، وثيقة غير منشورة، **عدم تطابق الإصدار مع المنشور الحالي**؛ idempotent لكل (user, doc, version).
- `get_required_legal_docs(p_user)` — يعيد وثائق `requires_reacceptance` المنشورة التي إصدارها المقبول من المستخدم أقدم من الحالي (أو لا يوجد قبول) — أساس بوابة الدخول.

---

## Migration 26 — `26_legal_seed.sql`

- يزرع **12 وثيقة** منشورة (إصدار 1) بمحتوى عربي كامل: `terms-of-service, privacy-policy, disclaimer, responsible-disclosure, bug-bounty-rules, company-agreement, researcher-agreement, rewards-payment, dispute-resolution, suspension-termination, prohibited-activities, data-retention`.
- الوثائق الثلاث المرتبطة بالتسجيل (`terms-of-service`, `privacy-policy`, `responsible-disclosure`) تُزرع بـ `requires_reacceptance = true` لتفعيل بوابة الموافقة عند الدخول للمستخدمين الحاليين.
- كل وثيقة تتضمن **تنبيهًا صريحًا** أنها لم تُراجع بعد من محامٍ مصري ولا تُعد استشارة قانونية.
- الزرع idempotent: `ON CONFLICT (slug) DO NOTHING` + `NOT EXISTS` على الإصدار — لا يكتب فوق أي محتوى قائم.

---

## ملخص لغير الداتابيز

- لا حذف ولا إعادة تسمية لأي جدول/عمود قائم — كل التغييرات إضافية أو توسعات.
- `report_status` زادت خمسة قيم (additive) — أي كود قديم يعمل كما هو.
- الأرقام المالية الجديدة `BIGINT` قروش؛ الأعمدة العشرية القديمة باقية للعرض.
- تطبيق الترحيلات: `supabase db push` (أو تشغيل الملفات الثلاثة بالترتيب 24 ← 25 ← 26).
- التراجع (rollback): الترحيلات additive؛ التراجع الآمن = تعطيل الميزات في الواجهة، بينما تبقى البيانات والسجلات محفوظة. جداول الموافقات والدفتر **لا يجوز** حذفها بعد بدء تسجيل بيانات فيها.
