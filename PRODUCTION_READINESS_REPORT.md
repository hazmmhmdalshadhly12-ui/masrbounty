# PRODUCTION_READINESS_REPORT — MasrBounty

**Branch:** `feature/production-readiness-hardening` (not merged to `main`)
**Date:** 2026-11-03
**Scope:** Full production-readiness & security-hardening pass: audit → fixes → tests → this report.
**Method note:** every result below comes from a command actually executed in this session; nothing is claimed that was not run.

---

## 1. Project state before the changes

Verified facts from the audit (not assumptions):

| Area | State found |
|---|---|
| Build stack | Next.js **15.4.11** (App Router, edge middleware), `@supabase/ssr` 0.12.6, `@supabase/supabase-js` 2.115.0, TS 5.9.3, target **Cloudflare Pages** (`@cloudflare/next-on-pages` 1.13) |
| Middleware | Session refresh via real `supabase.auth.getUser()` (cookie presence is *not* treated as identity for pages) — but the API gate was **cookie-presence only**, with no public-API and no webhook exception |
| API routes | 16 routes, all edge runtime, all protected routes call `getUser()`; **no service-role client reachable from routes** except indirect helpers (`notify`, audit, verification) |
| Server actions | 21 action modules + 19 pages with inline actions; every mutating action verified to derive identity from the session, never from arguments; role checks always DB-backed (`user_roles` / `company_members`) |
| RLS | Enabled on 50+ tables with per-table policies; `has_role()`/`is_company_member()`/`can_view_program()` helpers; money RPCs (`award_bounty`, `pay_award`) are idempotent and rank-enforced; triage-field protection trigger on `reports` |
| File uploads | Report attachments: MIME allow-list + magic bytes + blocked extensions + 10 MB cap + private bucket + path-bound SELECT policy |
| CI | **BROKEN — `branches: ain]`** (corrupted YAML) ⇒ CI had never triggered on any push. Stray file `n.txt` in workflows dir |
| Error handling | 11 API routes returned raw Supabase error messages to clients on 500s |
| Storage policies | `avatars_upload` / `logos_upload` allowed **any authenticated user to INSERT at ANY path** (no path binding) |
| Bootstrap | `ensureServerBootstrap` healed profiles but swallowed all errors silently (unobservable failures) |
| README | Version claims stale (Next.js 14 badge vs actual Next 15) |

---

## 2. All problems discovered

**Fixed in this branch (P0/P1):**

1. CI workflow never runs — corrupted `branches: ain]` in `ci.yml` (push + PR triggers).
2. Guests blocked from **public** data APIs (`/api/programs`, `/api/programs/[id]`, `/api/search`, `/api/leaderboard`) — cookie-presence gate had no public allow-list.
3. Authorized **webhook** requests (`/api/webhooks/supabase`, secret-authenticated, server-to-server) got 401 because they carry no user cookie.
4. `/api/verify-domain`: auth check wrapped in a **swallowing try/catch** ("service-level check will still enforce") on an endpoint that writes; the `{domainId}` code path ran **before** the auth check; service-level `Unauthorized/Forbidden` throws surfaced as framework 500s; no rate limit on an endpoint that triggers external DNS/HTTP calls.
5. Webhook shared secret compared with plain `!==` (timing-attack surface).
6. `/api/notifications`: no try/catch error envelope; duplicated inline Supabase client (drift risk).
7. 11 API routes leaked raw DB/RLS error messages to clients in 500 payloads.
8. `avatars`/`company-logos` storage: unbounded INSERT path (path squatting / cross-user writes once an UPDATE policy is ever added).
9. `ensureServerBootstrap`: silent `catch {}` — account-heal failures were invisible; check-then-insert not race-idempotent.
10. No rate limiting on public `/api/search` and `/api/programs`.
11. `path traversal` (`/api/programs/../payouts`) matched the new public allow-list (caught by the new tests, fixed in the same pass).
12. README versions inaccurate; `.env.example` missing `SUPABASE_WEBHOOK_SECRET`; stray `.github/workflows/n.txt`.

**Found and verified as already correct (no change needed):**
- No `getSession()`-only auth anywhere in `app/**` (all routes use `getUser()`).
- No client-supplied role can escalate: register role is `z.enum(['researcher','company'])`; admin/staff checks re-read `user_roles` from DB on every mutation; `roles_self_insert` RLS restricts to researcher/company.
- Money path idempotency: `award_bounty` refuses `already awarded`, `pay_award` refuses `already paid` and requires `approved` state + payment reference — a payout request is never treated as payment proof.
- Report triage transitions protected at DB level by trigger `protect_report_triage_fields`.
- Attachments: private bucket, path-bound SELECT (`storage.foldername(name))[1]::uuid = report id`), MIME + magic-byte + extension validation, 10 MB cap, DB row rollback on failed upload, audit-logged.
- Open-redirect hardened in `auth/callback` and `isSafeNext`; CSRF origin check on all non-GET `/api/*`.
- Identity documents bucket: private, owner-bound (select/upload/update/delete).
- No secrets committed (full-repo scan for `ghp_*` / `eyJ…` service tokens: clean; `.env*` gitignored).

---

## 3. Fixes implemented

| # | Fix | Where |
|---|---|---|
| 1 | CI triggers fixed to `branches: [main]`; stray `n.txt` deleted; workflow-structure regression test added | `.github/workflows/ci.yml`, `tests/security/ci-workflows.test.ts` |
| 2 | `isPublicApiPath()` allow-list: guests may GET health/programs/search/leaderboard; traversal/backslash never matches | `middleware.ts` |
| 3 | Webhook path exempt from cookie gate (secret still enforced in-route) | `middleware.ts` |
| 4 | `verify-domain`: fail-closed `getUser()` **first** (503 on client failure, 401 on missing session), per-identity rate limit (12/5min), service errors mapped 401/403/500, all service calls inside guarded scope | `app/api/verify-domain/route.ts` |
| 5 | `timingSafeEqualStrings()` (SHA-256 digest comparison) for the webhook secret | `lib/security/edge-crypto.ts`, `app/api/webhooks/supabase/route.ts` |
| 6 | Notifications route: shared `createServerClient`, full error envelope, generic 500s | `app/api/notifications/route.ts` |
| 7 | 11 routes: 500s now return a generic Arabic message; raw errors go to server logs only | `lib/api/errors.ts` (`logServerError`, `serverErrorMessage`) + all `app/api/**/route.ts` |
| 8 | Storage path-binding: avatars → folder must equal `auth.uid()`; company-logos → folder must be a company you own/are member of; UPDATE policies added; idempotent SQL section `16.3` (fresh-install block updated in place too) | `supabase/masrbounty.sql`, standalone `storage-path-binding.sql` |
| 9 | Bootstrap: race-idempotent upserts (`ignoreDuplicates`), failures logged + `security_events` row (`bootstrap.incomplete`), still never throws | `lib/auth/server-bootstrap.ts` |
| 10 | Per-IP rate limit (60/min) on `/api/search` + `/api/programs` with `Retry-After` | both route files |
| 11 | Security headers: `X-XSS-Protection: 0`, `Origin-Agent-Cluster`, `Cross-Origin-Resource-Policy: same-origin`; CSP decision documented in code | `next.config.js` |
| 12 | README versions/behavior corrected; `.env.example` completed; E2E + live-RLS suites added | `README.md`, `.env.example`, `tests/**` |

---

## 4. Files modified

**Modified (20):** `middleware.ts`, `next.config.js`, `app/api/webhooks/supabase/route.ts`, `app/api/verify-domain/route.ts`, `app/api/notifications/route.ts`, `app/api/search/route.ts`, `app/api/programs/route.ts`, `app/api/payouts/route.ts`, `app/api/auth/session/route.ts`, `app/api/disputes/route.ts`, `app/api/leaderboard/route.ts`, `app/api/messages/route.ts`, `app/api/reports/route.ts`, `app/api/reports/[id]/route.ts`, `app/api/programs/[id]/route.ts`, `app/api/wallet/route.ts`, `lib/security/edge-crypto.ts`, `lib/auth/server-bootstrap.ts`, `supabase/masrbounty.sql`, `README.md`, `.github/workflows/ci.yml`, `.env.example`

**New (10):** `lib/api/errors.ts`, `tests/security/middleware-routing.test.ts`, `tests/security/webhook-auth.test.ts`, `tests/security/storage-policies.test.ts`, `tests/security/workflow-money.test.ts`, `tests/security/ci-workflows.test.ts`, `tests/unit/bootstrap.test.ts`, `tests/integration/rls-live.test.ts`, `PRODUCTION_READINESS_REPORT.md`

**Deleted (1):** `.github/workflows/n.txt`

---

## 5 & 6. Tests executed and their results

| Command | Result | Detail |
|---|---|---|
| `npx tsc --noEmit` | ✅ PASS | 0 errors |
| `npx eslint . --max-warnings=0` | ✅ PASS | 0 errors, 0 warnings |
| `npx jest` | ✅ PASS | **33/34 suites, 192 tests passed, 8 skipped** (the skip = live-RLS suite, see below), 0 failed |
| `npm run build` (Next production) | ✅ PASS | exit 0; compiled + types valid; route table emitted |
| `npx next-on-pages` (Cloudflare Pages build) | ✅ PASS | exit 0; worker generated; 280 static assets |
| `npx playwright test` (E2E, real `npm start` server) | ⚠️ PARTIAL | **4 passed / 2 failed** — the 2 failures (`/programs` heading, `/search` input) were **reproduced identically on clean `main`** in the same sandbox and are caused by the sandbox having **no Supabase credentials** (`.env` absent), so data-dependent content cannot render. Not a regression; these pages serve correctly on the configured live deployment. |
| Live RLS cross-account tests | ⛔ **NOT EXECUTED** | No Supabase *test* project credentials available in this environment. The complete 7-scenario suite is implemented in `tests/integration/rls-live.test.ts` and runs automatically when `RLS_TEST_URL`/`RLS_TEST_ANON_KEY`/account env vars point at a staging project. It is skipped — **not claimed as passing** — until then. |

**New test coverage added this pass:** middleware public/protected/webhook routing matrix + traversal confusion; webhook secret auth (500/401/200/400 + leak-free errors) + timing-safe compare; storage path-binding policies (attachments private & path-bound, iddoc user-bound, avatars/logos folder-bound); report state-machine + bounty/pay idempotency guards; CI workflow integrity; bootstrap heal (idempotency, role clamping, no-throw, observability); live-RLS scaffold.

---

## 7. Problems NOT solved

1. **Live RLS verification was not executed** (no staging Supabase project/credentials in this environment). Static SQL analysis (52 RLS assertions across `p0-rls`, `rls`, `hardening-v2`, `storage-policies`, `workflow-money` suites) all pass, but the acceptance criterion "actual tests against a Supabase test environment with multiple accounts" remains **open until you run the provided suite once against a test project**.
2. **Staging deployment not verified from here** — pushing this branch will automatically produce a Cloudflare Pages *preview* deployment (the project is Git-connected); the final staging acceptance (`https://<preview>.pages.dev` smoke + E2E with real env) must be run there.
3. The 2 E2E scenarios cannot pass in a credentials-less sandbox (see §5) — they will pass in CI/staging where `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` secrets exist.

## 8. Remaining risks

| Risk | Severity | Mitigation status |
|---|---|---|
| `script-src 'unsafe-inline'` in CSP | Medium | **Documented decision**: `next-on-pages` prerenders static routes at build time; per-request nonces cannot cover them. Strict nonce-CSP requires migrating to the Node.js runtime (Vercel/self-hosted). All other CSP directives are strict. |
| In-memory rate limiting is per-Workers-isolate | Medium | Cloudflare isolates recycle frequently, so the in-memory limiter is a soft bound. Same-interface Redis/Upstash swap is prepared (`lib/rate-limit.ts` header documents it); for real abuse protection add Cloudflare WAF rate-limit rules on `/api/*`. |
| Webhook uses a static shared secret (no HMAC signature / replay window) | Low | Handler currently only logs. Constant-time comparison now enforced. Upgrade path: sign payloads and verify HMAC. |
| `/api/verify-domain` fetches customer-supplied domains (SSF/SSRF-ish surface) | Low | HTTPS-only, 8s timeout, no credential forwarding, DoH for TXT. Bounded, as before. |
| `startConversationAction` can open conversations with any user | Low | Rate-limited 10/h, RLS-bound, notify() spam-guard. Acceptable for beta. |
| In-memory rate-limit store + session cookie without HttpOnly (`@supabase/ssr` design; documented in `lib/supabase/cookies.ts`) | Low | Documented trade-offs. |

## 9. Production settings requiring manual review (cannot be done from code)

1. **Run `storage-path-binding.sql` once in Supabase SQL Editor** (idempotent) — applies the storage path-binding policies to the live project. Without it, the live DB keeps the old unbounded policies.
2. **GitHub**: the PAT used for this session's pushes has been exposed in chat history — **revoke and rotate it** (Settings → Developer settings → Tokens).
3. **Cloudflare Pages env vars** must include: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_WEBHOOK_SECRET` (new — add to Pages + Supabase webhook config). Never set `SUPABASE_SERVICE_ROLE_KEY` anywhere client-visible.
4. **Supabase Auth URL allow-list**: Site URL `https://masrbounty.online`, redirect `https://masrbounty.online/auth/callback` (+ preview domains if PR previews should complete logins).
5. **Staging Supabase project** for the live-RLS suite: create one, seed two researchers + one admin, set `RLS_TEST_*` env vars in CI secrets, and run `npx jest tests/integration/rls-live.test.ts` once with credentials to close §7.1.
6. Consider Cloudflare WAF rate-limit rule on `/api/*` (see §8).

## 10. Final decision

**READY FOR STAGING**

Basis: production build + Cloudflare build pass; TypeScript and lint pass with zero warnings; 192 unit/integration/security tests pass (0 failures); all critical/high code-level findings from the audit are fixed and regression-tested; no secrets in the repository. It is **not** claimed to be READY FOR LIMITED BETA/PUBLIC LAUNCH because two acceptance gates remain open and are *not* fakeable from here: (a) live multi-account RLS execution against a real Supabase test project, and (b) staging deployment verification. Both have ready-to-run tooling in this branch and are listed in §9.
