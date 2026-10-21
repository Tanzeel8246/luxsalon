# ✂️ LuxSalon — Smart Salon & Groom Center SaaS v2.0

> Production-grade, multi-tenant salon management system with AI-powered booking,
> real-time queue, dynamic pricing, WhatsApp notifications, and full business automation.

---

## 🚀 Quick Start (5 minutes)

```bash
# 1. Clone and install
git clone https://github.com/your-org/luxsalon.git
cd luxsalon
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials (see Configuration section)

# 3. Run database migrations
# Open Supabase Dashboard → SQL Editor → run each file in database/migrations/ in order

# 4. Seed initial data
# In Supabase SQL Editor, run: database/seed.sql

# 5. Start development server
npm run dev
# → http://localhost:3000
```

---

## 📋 System Requirements

| Requirement | Version |
|-------------|---------|
| Node.js     | 20+     |
| npm         | 10+     |
| Supabase    | Free tier or above |
| Redis       | Upstash (serverless) |

---

## ⚙️ Configuration

Copy `.env.example` to `.env.local` and fill in:

### Required (must have)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://your-salon.com
CSRF_SECRET=<openssl rand -hex 32>
```

### Payments (Stripe)
```env
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
Setup: stripe.com → Developers → API keys

### WhatsApp Notifications
```env
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<random string>
```
Setup: developers.facebook.com → WhatsApp → Cloud API

### Push Notifications (Firebase)
```env
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```
Setup: console.firebase.google.com → Project Settings → Service Accounts

### Caching & Rate Limiting (Upstash)
```env
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```
Setup: console.upstash.com → Create Redis database

### Security
```env
ENCRYPTION_KEY=<openssl rand -hex 32>   # For 2FA TOTP secrets
```

---

## 🗄️ Database Setup

Run migrations in **exact order** in Supabase SQL Editor:

```
1. schema.sql                        — Core tables
2. schema_v2.sql                     — Modules 1-5
3. schema_v3.sql                     — Modules 6-10
4. schema_v4.sql                     — Modules 11-13
5. database/migrations/001_fix_booking_concurrency.sql
6. database/migrations/002_commission_rules.sql
7. database/migrations/003_fix_inventory_branches.sql
8. database/migrations/004_multi_tenancy.sql
9. database/migrations/005_business_features.sql
10. database/migrations/006_mv_refresh_functions.sql
11. database/seed.sql                — Initial data
```

**Verify setup:**
```sql
SELECT COUNT(*) FROM services;      -- Should be > 0
SELECT COUNT(*) FROM training_modules; -- Should be 8
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js 14 (App Router)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  React UI    │  │  Server      │  │   API Routes     │  │
│  │  (Client)    │  │  Components  │  │   (REST)         │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│  ┌──────▼─────────────────▼────────────────────▼─────────┐  │
│  │              Service Layer (20 services)               │  │
│  │  booking · pos · queue · payroll · ai · marketing ...  │  │
│  └──────────────────────────┬─────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼─────┐        ┌─────▼──────┐      ┌─────▼──────┐
    │ Supabase │        │  Upstash   │      │  External  │
    │  DB+Auth │        │   Redis    │      │  APIs      │
    │  Storage │        │  Cache+RL  │      │ Stripe/WA  │
    └──────────┘        └────────────┘      └────────────┘
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| State | Zustand (client) + TanStack Query (server) |
| Database | PostgreSQL via Supabase (RLS + Row-level security) |
| Cache | Upstash Redis (cache-aside pattern) |
| Auth | Supabase Auth + 2FA (otplib) |
| Payments | Stripe (PaymentIntents + Webhooks) |
| Notifications | WhatsApp Cloud API + Firebase FCM |
| Analytics | Custom BI + Materialized Views |
| PDFs | @react-pdf/renderer |
| Excel | ExcelJS |
| Monitoring | Sentry |
| CI/CD | GitHub Actions |
| Deployment | Vercel / Docker |

---

## 📁 Project Structure

```
salon-system/
├── app/                     # Next.js 14 App Router
│   ├── api/                 # 15+ API routes
│   ├── auth/                # Login, register
│   └── dashboard/           # All admin pages
├── components/
│   ├── ai/                  # Demand forecast, Churn alerts, Chatbot
│   ├── analytics/           # Customer LTV, BI charts
│   ├── booking/             # 4-step wizard
│   ├── branch/              # Multi-branch dashboard
│   ├── dashboard/           # Stats cards, revenue charts
│   ├── financial/           # Payroll panel
│   ├── integrations/        # 15+ integrations panel
│   ├── inventory/           # Stock, suppliers, expiry
│   ├── layout/              # Sidebar, Header, ThemeToggle
│   ├── marketing/           # Campaign manager, Gift cards
│   ├── operations/          # Task board, SOP, Training
│   ├── performance/         # System health dashboard
│   ├── pos/                 # POS Terminal
│   ├── queue/               # Queue board, items
│   ├── scheduling/          # Shift manager, Leave manager
│   └── ui/                  # Design system components
├── database/
│   ├── migrations/          # 6 incremental migration files
│   └── seed.sql             # Initial data
├── hooks/                   # 8 React hooks
├── lib/                     # Core utilities
│   ├── currency.ts          # Multi-currency
│   ├── fcm.ts               # Firebase FCM
│   ├── googleCalendar.ts    # OAuth + Calendar sync
│   ├── i18n/                # en, ur translations
│   ├── pdf.ts               # PDF + CSV generation
│   ├── redis.ts             # Upstash cache
│   ├── ratelimit.ts         # API rate limiting
│   ├── sanitize.ts          # XSS prevention
│   ├── scheduler.ts         # Cron jobs
│   ├── stripe.ts            # Stripe SDK
│   ├── totp.ts              # Real 2FA
│   └── whatsapp.ts          # WhatsApp Cloud API
├── services/                # 20 business logic files
├── types/                   # Full TypeScript coverage
├── __tests__/               # Unit + E2E tests
│   ├── e2e/                 # Playwright tests
│   └── lib/                 # Unit tests
├── public/
│   ├── sw.js                # Service Worker (offline)
│   ├── manifest.json        # PWA manifest
│   └── offline.html         # Offline fallback
├── .github/
│   └── workflows/ci.yml     # CI/CD pipeline
├── Dockerfile               # Production Docker image
└── docker-compose.yml       # Local + production orchestration
```

---

## 🔐 Security Checklist

- ✅ TOTP 2FA with AES-256-GCM encrypted secrets (otplib)
- ✅ bcrypt hashed backup codes
- ✅ CSRF protection on all mutations
- ✅ Input sanitization (sanitize-html + xss)
- ✅ API rate limiting (Upstash: 100/min public, 500/min auth)
- ✅ Brute-force protection (5 login attempts / 15 min)
- ✅ Row Level Security on all 40+ tables
- ✅ Tenant isolation (multi-tenancy)
- ✅ Stripe webhook signature verification (HMAC-SHA256)
- ✅ WhatsApp webhook signature verification
- ✅ Security headers (HSTS, CSP, X-Frame-Options, etc.)
- ✅ Environment variable validation on startup
- ✅ Parameterized queries (Supabase client, no raw SQL from user input)
- ✅ Sentry error monitoring with PII redaction

---

## 📊 All 13 Modules

| # | Module | Status |
|---|--------|--------|
| 1 | AI & Machine Learning (Demand Forecast, Churn, Chatbot) | ✅ Production |
| 2 | Mobile App & PWA (SW, Push, Offline) | ✅ Production |
| 3 | Financial / POS (Stripe, Payroll, Subscriptions) | ✅ Production |
| 4 | Advanced BI (LTV, Segments, KPI, Reports) | ✅ Production |
| 5 | Marketing & CRM (WhatsApp, Campaigns, Gift Cards) | ✅ Production |
| 6 | Customer Experience (Waitlist, Kiosk, Try-on) | ✅ Production |
| 7 | Multi-Branch (4 branches, Franchise royalties) | ✅ Production |
| 8 | Security & Compliance (2FA, Audit, GDPR) | ✅ Production |
| 9 | Advanced Scheduling (Shifts, Leaves, Recurring) | ✅ Production |
| 10 | Advanced Inventory (Suppliers, PO, Barcode, Expiry) | ✅ Production |
| 11 | Operations (Tasks, SOP, Incidents, Training) | ✅ Production |
| 12 | Performance & Technical (Health, Errors, Webhooks) | ✅ Production |
| 13 | Integrations & API (Stripe, Calendar, Zapier, Reports) | ✅ Production |

---

## 🚀 Deployment

### Option A: Vercel (Recommended)
```bash
npm install -g vercel
vercel login
vercel --prod
```

Set all ENV vars in Vercel Dashboard → Settings → Environment Variables.

### Option B: Docker
```bash
docker build -t luxsalon \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY \
  --build-arg NEXT_PUBLIC_APP_URL=https://yourdomain.com .

docker run -p 3000:3000 --env-file .env.local luxsalon
```

### Option C: Docker Compose
```bash
docker compose up -d
```

---

## 🧪 Testing

```bash
# Unit tests
npm test

# With coverage (must be ≥80%)
npm run test:coverage

# E2E tests (requires running server)
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e

# Type check
npm run type-check
```

---

## 📡 API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | Public | System health check |
| `/api/booking` | GET/POST | Auth | Slots + create booking |
| `/api/queue` | GET/POST/PATCH | Auth | Queue management |
| `/api/walk-in` | POST | Staff | Walk-in customer |
| `/api/ai/forecast` | GET | Public | Demand forecast |
| `/api/ai/chat` | POST | Public | AI chatbot |
| `/api/reports` | GET | Admin | CSV/Excel reports |
| `/api/day-end` | GET/POST | Staff | Reconciliation |
| `/api/tips` | GET/POST | Auth | Tips management |
| `/api/deposits` | POST/PATCH | Auth | Stripe deposits |
| `/api/customers/merge` | GET/POST | Admin | Duplicate merge |
| `/api/stripe-webhook` | POST | Stripe | Payment events |
| `/api/whatsapp-webhook` | GET/POST | Meta | WA delivery status |
| `/api/google-calendar/auth` | GET | Staff | OAuth initiation |
| `/api/google-calendar/callback` | GET | Public | OAuth callback |

---

## 🔧 Maintenance

### Database maintenance
```sql
-- Refresh materialized views (auto via scheduler)
SELECT refresh_mv_daily_revenue();
SELECT refresh_mv_service_profitability();
SELECT refresh_mv_customer_ltv();

-- Check queue health
SELECT * FROM fn_calculate_queue_wait();

-- Day-end report
SELECT * FROM fn_generate_day_end_report('branch-uuid-here');
```

### Monitoring
- Sentry: Track errors and performance
- `/api/health`: Health check endpoint (used by Docker healthcheck)
- Supabase Dashboard: Database + Storage monitoring
- Upstash Console: Redis cache + rate limit monitoring

---

## 📝 License

MIT — Free to use, modify, and deploy for commercial purposes.

---

## 🤝 Support

- Issues: GitHub Issues
- Documentation: `/docs` (coming soon)
- WhatsApp: Configured in your `.env.local`
