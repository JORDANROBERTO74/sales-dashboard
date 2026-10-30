# Sales Dashboard

A multi-account Stripe sales, commission and payout dashboard built with Next.js 15, Supabase and TypeScript. White-label ready.

![Sales Dashboard landing page](docs/01-landing.png)

## What it is

Sales Dashboard centralizes the commercial and financial operations of a sales team around Stripe: it ingests transactions from one or more Stripe accounts, assigns each sale to a seller, computes commissions, tracks available and pending balances, and executes payouts with an audit trail.

It ships with:

- Supabase authentication and email invitations.
- Five roles with database-enforced row-level security.
- A white-label brand layer driven by environment variables.
- A per-account payout policy stored in the database.

It is a template, not a payment processor. Stripe remains the source of truth; the dashboard mirrors transactions through webhooks and manual syncs.

## Why this over a generic CRM template

- **Dynamic Stripe accounts.** Accounts live in `public.stripe_accounts`; the UI generates tabs and routes from the database. Nothing is hardcoded to a specific account name.
- **Per-account payout rules.** `requires_funds_available` and `admin_only_payouts` let each account decide whether payouts need released funds and whether only admins can create them.
- **Security in the database.** Row-level security, privilege-escalation guards, last-owner protection, invitation rate limiting and encrypted payment-method fields.
- **White label in one place.** Brand name, company, URL and logo come from `src/config/brand.ts` and `.env.local`.
- **Small dependency surface.** Next.js, React, Supabase, Stripe, TanStack Query, Zod, Tailwind CSS and shadcn/ui primitives.

## Screenshots

| Login | Dashboard |
| --- | --- |
| ![Login page](docs/02-login.png) | ![Operations dashboard](docs/03-dashboard.png) |

| Transactions | Transaction detail |
| --- | --- |
| ![Transactions list](docs/04-transactions.png) | ![Transaction detail](docs/05-transaction-detail.png) |

## Quick start

Requirements: Node.js 20+ (see `.nvmrc`) and npm.

```bash
git clone https://github.com/JORDANROBERTO74/sales-dashboard.git
cd sales-dashboard
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Fill `.env.local` before the first run; the app validates the required Supabase variables at boot.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Create an optimized production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Environment variables

Base: `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | Yes | Brand name shown in titles, metadata and navigation |
| `NEXT_PUBLIC_COMPANY_NAME` | No | Legal or commercial company name |
| `NEXT_PUBLIC_SITE_URL` | No | Absolute base URL for invitation and reset links |
| `NEXT_PUBLIC_LOGO_URL` | No | Logo asset URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only key for admin operations; never expose it |
| `PAYMENT_ENCRYPTION_KEY` | Yes | 64 hex characters, AES-256-GCM for payment methods |
| `STRIPE_ACCOUNT_<N>_EXTERNAL_ID` | Yes per account | Stripe account ID (`acct_...`) |
| `STRIPE_ACCOUNT_<N>_SECRET_KEY` | Yes per account | Stripe secret key |
| `STRIPE_ACCOUNT_<N>_WEBHOOK_SECRET` | Yes per account | Stripe webhook signing secret |

## Multi-account Stripe model

The schema supports any number of connected Stripe accounts.

1. Insert rows into `public.stripe_accounts` from the admin UI or a migration. Each row stores `stripe_account_external_id`, `display_name`, `requires_funds_available` and `admin_only_payouts`.
2. Configure `STRIPE_ACCOUNT_<N>_*` for each account you want to sync.
3. Balances, payouts and transaction routes are generated from active accounts. Transaction paths follow `/admin/transactions/[accountExternalId]`.

Payout rules are data, not code:

- `requires_funds_available = true` only counts commissions whose Stripe funds are released.
- `requires_funds_available = false` counts every assigned commission.
- `admin_only_payouts = true` restricts payout creation to `owner` and `admin`.

## Roles and security

| Role | Scope |
| --- | --- |
| `owner` | Full access, including assigning the owner role and creating roles |
| `admin` | Manage users, transactions and payouts; cannot assign `owner` |
| `seller` | See assigned sales, balances and request payouts |
| `analyst` | Read-only access to reports and transactions |
| `viewer` | Read-only access to the dashboard |

- RLS and `FORCE ROW LEVEL SECURITY` on every table.
- Triggers prevent privilege escalation, protect the last active owner and validate invitation transitions.
- Payment-method fields are encrypted with AES-256-GCM.
- Invitations are rate-limited to 20 per admin per hour.

## Project structure

```text
src/
  app/                  App Router pages and API routes
    admin/transactions/[accountExternalId]/  dynamic per-account routes
  components/           UI and domain components
  config/brand.ts       white-label identity
  data/                 payment-link placeholders
  hooks/                TanStack Query data layer
  lib/                  auth, permissions, Stripe, Supabase, crypto
supabase/schema.sql      tables, functions, triggers and RLS
docs/                    README screenshots
```

## Deployment

The app uses the default Vercel Next.js preset; no `vercel.json` is required.

1. Import the repository and keep the detected settings (`npm install`, `npm run build`, output `.next`).
2. Add the environment variables from `.env.example` in the Vercel project.
3. Apply `supabase/schema.sql` to your Supabase project.
4. Configure the Stripe webhook endpoint as `https://<your-domain>/api/webhooks/stripe` for each account.
5. Deploy, then verify login, the dashboard, a manual Stripe sync and a payout.

Live demo: <https://sales-dashboard-stripe.vercel.app>

## Status and scope

This is a reference implementation for a white-label sales dashboard. `npm run lint` and `npm run build` pass; there is no automated test suite yet. The demo runs on Stripe test data. Review the payout rules, encryption key and webhook secrets before using it with real money.

## License

MIT. See [LICENSE](LICENSE).
