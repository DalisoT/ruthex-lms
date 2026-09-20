# RUTHEX Lending Institution — Loan Management System

A complete, runnable, production-grade loan management system for RUTHEX Lending Institution, a Zambian non-deposit-taking microfinance institution (NDT MFI) regulated by the Bank of Zambia under the Banking and Financial Services Act 2017 (with the BFSA 2026 transition prepared for). The system encodes every regulatory obligation surfaced in the companion research deliverable: minimum capital, KYC/CDD with PEP handling, AML/CFT with auto-CTR flagging and a five-rule STR engine, multi-level approval workflow, mobile-money collection (mock adapter), USSD origination, PWA borrower portal, IFRS 9 staging, audit-grade log with SHA-256 hash chain, BOZ prudential reporting, and an admin console for users, products, and branches.

## What it includes

### Regulatory modules (encoded from the research)

| Requirement | Where it lives |
| --- | --- |
| Form MFI / Form BFI document pack | `prisma/schema.prisma` (Borrower, KycDocument, KycRiskAssessment) + `/api/borrowers` |
| K104m / K520m bank, K100k NDT MFI, K2.5m DT MFI capital floors | `LoanProduct` model + `MFI_MIN_CAR_PCT` in `types.ts` |
| Fit-and-proper for significant shareholders, directors, senior officers | `User.fitProperStatus`, `User.role`, `KycActions.tsx`, `audit.ts` events |
| Beneficial ownership at 25% | `BeneficialOwner` model, `UBO_THRESHOLD_PCT` in `aml.ts` |
| CTR auto-flag at USD 10,000 (S.I. 52/2016) | `aml.ts` `evaluateTransactionForCtr`, fired in `/api/repayments` and `/api/loans/[id]/disburse` |
| STR within 2 working days | `aml.ts` `openStr` + `STR_FILING_DEADLINE_DAYS` |
| Extended STR engine: structuring, velocity, round-number, PEP-amount, rapid loan cycling | `aml-engine.ts`, wired into `/api/repayments` |
| 10-year record retention | All Prisma timestamps + audit log + BOZ snapshot hashes |
| CAR ≥ 15% (S.I. 62/2025) | `MFI_MIN_CAR_PCT`, `generateCapitalAdequacyReport` |
| Liquidity ratio (≥ 20%) | `generateLiquidityReport` |
| IFRS 9 staging (1 / 2 / 3) | `Loan.ifrs9Stage`, `generateAssetQualityReport` |
| Large exposures (25% single counterparty) | `generateLargeExposuresReport` |
| Related-party exposures (≤ 20% of capital) | `generateRelatedPartyReport` |
| Tamper-evident audit log | `audit.ts` (SHA-256 hash chain), verified on `/dashboard/settings` |

### Lending modules

- Borrower onboarding with KYC risk scoring, PEP flagging, geo-tagging
- Document vault with SHA-256 integrity hashes (`KycDocument`)
- Loan origination with auto-decisioning based on credit grade and amount
- Multi-level approval workflow (officer → branch manager → committee) on every application
- Disbursement through mobile money or bank transfer with auto-CTR
- Repayment recording with FIFO allocation (principal → interest → fees) and IFRS 9 staging
- Restructuring and write-off workflows

### Admin console

- User management with role assignment, password reset (returns temp password), last-admin protection
- Loan product management with active toggle
- Branch management with codes and BOZ branch code mapping
- Audit log viewer with chain-integrity indicator and per-entry payload drill-down
- BOZ report snapshot persistence with SHA-256 hashes

### Innovative features

- **Alternative-data credit scoring** (`credit-score.ts`) — 0–1000 score from mobile-money inflow, utility payment regularity, employer stability, tenure, prior performance, bureau (optional)
- **USSD origination** (`api/ussd`, `notifications.ts`) — *123# feature-phone flow
- **Mobile-money abstraction** (`mobile-money.ts`) — MTN/Airtel/Zamtel share one interface; mock adapter for dev
- **PWA borrower portal** (`/apply`) — two-step public application + KYC upload
- **Auto-decisioning** — small loans under K50,000 with grade A–C are approved and scheduled in one transaction
- **Auto-flagging AML engine** — CTR on threshold, plus 5 STR pattern detectors
- **Borrower statement portal** (`/dashboard/borrowers/[id]/statement`) — printable PDF via browser
- **Notifications inbox** (`/dashboard/notifications`) — per-user activity stream
- **Toast system** (`ToastProvider`) — global success/error feedback
- **Rate limiting** (`rate-limit.ts`) — token-bucket per IP per scope

### Operational infrastructure

- Health endpoint at `/api/health` (200/503 with DB latency, optional `?detail=1` counts)
- Global error boundary (`app/error.tsx`) and not-found page (`app/not-found.tsx`)
- Print stylesheet for clean PDF statements
- Audit-chain integrity verified on the Settings page
- 7 user roles with server-side RBAC (`lib/rbac.ts`) and client `<Can>` helper
- Mobile-responsive shell with bottom nav for field officers
- pnpm/npm.cmd compatible Windows installation story

## Quick start

```bash
# 1. Install dependencies
cd ruthex-lms
npm.cmd install

# 2. Configure environment
Copy-Item .env.example .env
# Edit JWT_SECRET before any non-local deployment

# 3. Push schema and generate Prisma client
npm.cmd run db:push

# 4. Seed demo data (1 branch, 7 users, 3 products, 3 borrowers, 1 sample loan)
npm.cmd run db:seed

# 5. Start the dev server
npm.cmd run dev
# → http://localhost:3000

# 6. Verify the deployment health
curl http://localhost:3000/api/health
curl 'http://localhost:3000/api/health?detail=1'
```

## Default logins

All seeded users share the password `Ruthex@2026`:

| Email | Role | Sees |
| --- | --- | --- |
| `admin@ruthex.local` | ADMIN | Everything (incl. /dashboard/admin/* and audit log) |
| `manager@ruthex.local` | BRANCH_MANAGER | Branch operations + reports |
| `credit@ruthex.local` | CREDIT_OFFICER | Loan applications + approvals + borrowers |
| `lo@ruthex.local` | LOAN_OFFICER | Borrower onboarding + applications |
| `cashier@ruthex.local` | CASHIER | Repayments + disbursements |
| `compliance@ruthex.local` | COMPLIANCE_OFFICER | AML queue + BOZ reports + audit log |
| `auditor@ruthex.local` | AUDITOR | Read-only access + audit log integrity |

**Change all passwords before any non-local deployment.**

## Module map

```
src/
├── app/
│   ├── login/                       # auth page
│   ├── (dashboard)/
│   │   ├── dashboard/                # KPI + BOZ snapshot + 30-day charts
│   │   ├── borrowers/                # list, new, detail, KYC actions, statement
│   │   ├── applications/             # list + detail (with approval workflow)
│   │   ├── loans/                    # list, new, detail, actions, repayments, approval
│   │   ├── repayments/               # receipts list with CTR/STR flags
│   │   ├── aml/                      # alerts list + detail + review
│   │   ├── reports/                  # BOZ prudential reports + snapshot
│   │   ├── notifications/            # inbox of outbound messages
│   │   ├── audit-log/                # filterable timeline + chain integrity
│   │   ├── admin/                    # users + products + branches
│   │   ├── settings/                 # admin overview + audit chain integrity
│   ├── apply/                        # public PWA borrower application
│   ├── api/
│   │   ├── auth/                     # login (rate-limited), logout
│   │   ├── borrowers/                # POST create, KYC decide
│   │   ├── loans/applications/       # POST submit, POST decide (approve/reject)
│   │   ├── loans/[id]/               # disburse, restructure, writeoff
│   │   ├── repayments/               # POST record (triggers AML + STR + engine)
│   │   ├── aml/[id]/                 # POST decide (investigate / report / dismiss / escalate)
│   │   ├── reports/snapshot/          # POST persist BOZ reports
│   │   ├── credit-score/preview/      # POST compute score preview
│   │   ├── public/apply, public/kyc/  # unauthenticated borrower flows
│   │   ├── admin/users, products, branches/  # CRUD with RBAC
│   │   ├── ussd/                     # feature-phone origination
│   │   ├── webhooks/mobile-money/     # provider callbacks
│   │   └── health/                   # uptime monitor endpoint
├── lib/
│   ├── auth.ts                       # JWT + bcrypt + RBAC session
│   ├── rbac.ts                       # server-side role guards + role groups
│   ├── db.ts                         # Prisma singleton
│   ├── audit.ts                      # SHA-256 hash-chained audit log
│   ├── aml.ts                        # CTR threshold + STR triggers
│   ├── aml-engine.ts                 # structuring / velocity / round-number / PEP / loan cycling
│   ├── mobile-money.ts               # provider abstraction (mock / MTN / Airtel / Zamtel)
│   ├── credit-score.ts               # alt-data score 0–1000 with factors
│   ├── boz-reports.ts                # capital adequacy, liquidity, asset quality, large/related exposures
│   ├── notifications.ts              # SMS / email / WhatsApp / USSD scaffold + templates
│   ├── rate-limit.ts                 # token-bucket rate limiter (in-memory)
│   ├── utils.ts                      # formatters + amortization calculator
│   └── types.ts                      # domain constants (CTR threshold, role lists, status enums)
├── components/
│   ├── Can.tsx                       # client-side role gate
│   ├── Sparkline.tsx                 # inline-SVG trend chart (no chart lib)
│   └── ToastProvider.tsx             # global toast context + UI
├── prisma/
│   ├── schema.prisma                 # 21 models
│   └── seed.ts                       # demo data
```

## Compliance mapping (one screen deep)

| BOZ / FIC requirement | Where it lives |
| --- | --- |
| Form MFI + supporting documents | `prisma/schema.prisma` + `/api/borrowers` |
| Fit-and-proper | `User.fitProperStatus`, `KycActions.tsx` |
| 25% beneficial ownership | `BeneficialOwner` + `UBO_THRESHOLD_PCT` |
| KYC risk scoring | `KycRiskAssessment` + `borrowers/[id]/KycActions.tsx` |
| CTR auto-flag at USD 10,000 | `aml.ts` `evaluateTransactionForCtr` |
| STR within 2 working days | `aml.ts` `openStr` + `STR_FILING_DEADLINE_DAYS` |
| 5 STR pattern detectors | `aml-engine.ts` (`runAllDetectors`) |
| Capital adequacy ratio ≥ 15% | `boz-reports.ts` + `MFI_MIN_CAR_PCT` |
| Liquidity ratio | `boz-reports.ts` |
| Asset quality (IFRS 9) | `Loan.ifrs9Stage` + `boz-reports.ts` |
| Large exposures (25%) | `boz-reports.ts` |
| Related-party (≤ 20%) | `boz-reports.ts` |
| Tamper-evident audit log | `audit.ts` + `/dashboard/settings` integrity check |
| 10-year record retention | Prisma timestamps + snapshot SHA-256 hashes |
| BFSA 2026 readiness | `BeneficialOwner`, `KycDocument` integrity, audit chain, RBAC — all in place for the new regime |

## Mobile money integration

The `src/lib/mobile-money.ts` module abstracts MTN, Airtel, Zamtel behind a single interface. The default `MockMobileMoneyAdapter` lets the system run end-to-end without provider credentials. To go live:

1. Implement the matching real adapter(s) — the interface is small and isolated.
2. Set `MOBILE_MONEY_PROVIDER=mtn | airtel | zamtel` in `.env`.
3. Configure provider-specific webhook URLs in the provider dashboard pointing to `POST /api/webhooks/mobile-money`.
4. Implement HMAC signature verification in `verifyWebhookSignature` (the mock currently always passes).

The disbursement flow uses the same adapter, so a single switch enables inbound (repayments) and outbound (disbursements) on the same provider.

## USSD channel

`POST /api/ussd` is wired to the Zambia-standard USSD protocol (CON / END response). In production, point Africa's Talking (or equivalent) at this endpoint. The session interpreter is in `src/lib/notifications.ts` (`processUssd`) and is intentionally minimal — extend it to match the menu depth your operations need.

## Switching to Postgres / Supabase

When you're ready to move off SQLite (e.g. to Supabase Postgres):

1. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.
2. Set `DATABASE_URL=postgresql://...` in `.env`.
3. Run `npm run db:migrate -- --name init` instead of `db:push`.
4. Re-run `npm run db:seed`.

The Prisma schema is portable — no SQLite-specific constructs are used. If you want Supabase Auth instead of the JWT layer, swap `src/lib/auth.ts` for `@supabase/supabase-ssr` and rewire the cookies. If you want Supabase Storage for the document vault, swap the `KycDocument.storagePath` writes for `supabase.storage.from('ruthex').upload(...)`.

## Innovative features — how they fit together

1. **Borrower applies** via the public `/apply` page on a phone or laptop. They fill a 2-step form and upload NRC + selfie for KYC.
2. **System runs the alternative-data credit score** combining declared income, the loan amount, and our default signals (mobile money, utility payments, employer stability, prior performance). This gives a 0–1000 score and a letter grade.
3. **Auto-decision** kicks in for small loans (≤ K50,000) with strong grades; otherwise the file is queued for a credit officer via the Applications list.
4. **Officer approves** on the application detail page. The loan record is created and the amortization schedule is computed and persisted. Each decision records a multi-level audit entry.
5. **Disbursement** fires through the mobile-money adapter. For cash over the CTR threshold, an automatic CTR alert opens. The 5-rule STR engine also runs.
6. **Repayment** is recorded by the cashier via the dashboard or by the borrower via mobile money. The system allocates the payment FIFO (principal → interest), updates the schedule, and re-evaluates IFRS 9 stage.
7. **Compliance** auto-flags CTR and STR events. The compliance officer reviews each in `/dashboard/aml` and marks it investigated, dismissed, or reported to FIC.
8. **BOZ reports** are generated monthly. The snapshot persists figures for audit. Audit-chain integrity is verified in Settings.
9. **Borrower statement** is one click from any borrower profile — browser-native print saves a clean PDF.

## Production deployment

The app supports standalone Next.js builds:

```bash
BUILD_STANDALONE=1 npm run build
```

Output goes to `.next/standalone/`. Set `BUILD_STANDALONE=1` for minimal Docker images. The app expects only a database — no other runtime services.

Recommended production hardening before real customer traffic:
1. Real mobile money adapters for MTN / Airtel / Zamtel
2. Real document storage (S3 / local + signed URLs)
3. Real sanctions list integration (UN consolidated + local)
4. Multi-tenant branch scoping on top of `branchId`
5. TLS termination + reverse proxy (Caddy / Nginx)
6. Database backups + WAL archiving (Postgres)
7. Centralized logging (structured logs to a sink)
8. Uptime monitoring pointing at `/api/health`

## Tests / CI

Tests are not included in the MVP. Recommended first set when scaling:
- `aml.test.ts` — CTR threshold, same-day aggregation, 5 STR detectors
- `boz-reports.test.ts` — snapshot math against known loan books
- `auth.test.ts` — fit-and-proper logic, RBAC guards
- `credit-score.test.ts` — known inputs → expected scores
- `rate-limit.test.ts` — token bucket exhaustion

## What the system handles today

- 7 distinct user roles with server- and client-side RBAC
- 21-model Prisma schema covering identity, KYC, AML, loans, repayments, BOZ reports, audit
- Loan lifecycle: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → ACTIVE → IN_ARREARS → RESTRUCTURED → CLOSED/WRITTEN_OFF
- AML: CTR auto-flagging + 5 STR pattern detectors + 2-working-day filing deadline
- IFRS 9 staging 1/2/3 driven by days-in-arrears
- Multi-level approval workflow with full audit history
- BOZ monthly reports with snapshot persistence + chain integrity
- Borrower PWA portal (apply, view) + USSD *123# channel
- Admin console for users, products, branches
- Audit log viewer with tamper-evident hash chain
- Toast system, 404/500 pages, error boundary
- Rate limiting on auth endpoints
- Health endpoint for uptime monitors
- Print-to-PDF for borrower statements
- Sparkline trend charts on the dashboard

## What it doesn't yet handle (deliberate, for the paid-services phase)

- Real MTN/Airtel/Zamtel adapter implementations (mock is in place; swap implementations in `src/lib/mobile-money.ts`)
- Supabase Postgres migration (one-line Prisma provider swap + new `DATABASE_URL`)
- Real document upload (KycDocument.storagePath is recorded; storage backend is the swap point)
- Email/SMS/WhatsApp outbound integration (notifications queue is in place; wire Africa's Talking / Twilio / Meta Business API in `src/lib/notifications.ts`)
- 2FA for high-privilege roles
- Automated test suite

## License

Internal RUTHEX Lending Institution — proprietary, all rights reserved.
