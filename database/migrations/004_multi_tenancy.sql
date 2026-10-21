-- ============================================================
-- Migration: 004_multi_tenancy
-- Tenant isolation for SaaS deployment
-- ============================================================

-- ── Tenants table (one per salon chain/franchise owner) ───────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  slug         VARCHAR(100) UNIQUE NOT NULL,
  plan         VARCHAR(20) DEFAULT 'starter' CHECK (plan IN ('starter','professional','enterprise','franchise')),
  status       VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled','trial')),
  trial_ends   TIMESTAMPTZ,
  owner_email  VARCHAR(255) NOT NULL,
  config       JSONB DEFAULT '{}',
  stripe_customer_id  TEXT,
  stripe_subscription_id TEXT,
  max_branches INTEGER DEFAULT 1,
  max_staff    INTEGER DEFAULT 10,
  timezone     VARCHAR(50) DEFAULT 'UTC',
  currency     VARCHAR(3) DEFAULT 'USD',
  locale       VARCHAR(10) DEFAULT 'en',
  tax_rate     DECIMAL(5,4) DEFAULT 0.08,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Add tenant_id to all core tables ─────────────────────────────────────────
-- Run each ALTER only if column doesn't exist
DO $$
DECLARE col_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'tenant_id'
  ) INTO col_exists;

  IF NOT col_exists THEN
    ALTER TABLE branches    ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE staff       ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE customers   ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE services    ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE packages    ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE appointments ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE inventory   ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    ALTER TABLE campaigns   ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- ── Indexes for tenant isolation queries ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_branches_tenant    ON branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_tenant       ON staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant   ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant    ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant   ON inventory(tenant_id);

-- ── Tenant-level RLS policy template ─────────────────────────────────────────
-- Each table needs tenant isolation. Pattern: auth.uid() maps to tenant.

-- Helper function: get tenant_id for current user
CREATE OR REPLACE FUNCTION fn_get_current_tenant()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_tenant_id UUID;
BEGIN
  -- Resolve tenant from staff
  SELECT s.tenant_id INTO v_tenant_id
  FROM staff s WHERE s.user_id = auth.uid() LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN RETURN v_tenant_id; END IF;

  -- Resolve from customer
  SELECT c.tenant_id INTO v_tenant_id
  FROM customers c WHERE c.user_id = auth.uid() LIMIT 1;

  RETURN v_tenant_id;
END;
$$;

-- Apply tenant RLS to services
DROP POLICY IF EXISTS "services_public_read" ON services;
CREATE POLICY "services_tenant_read" ON services
  FOR SELECT USING (
    tenant_id = fn_get_current_tenant()
    OR tenant_id IS NULL  -- legacy data without tenant
  );

-- Apply tenant RLS to appointments
DROP POLICY IF EXISTS "appointments_read"   ON appointments;
DROP POLICY IF EXISTS "appointments_insert" ON appointments;

CREATE POLICY "appointments_tenant_read" ON appointments
  FOR SELECT USING (
    tenant_id = fn_get_current_tenant()
    AND (
      customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
      OR staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "appointments_tenant_insert" ON appointments
  FOR INSERT WITH CHECK (
    tenant_id = fn_get_current_tenant()
    AND customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );

-- ── Tenant usage metrics ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_usage (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  month        DATE NOT NULL DEFAULT DATE_TRUNC('month', NOW()),
  appointments INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  storage_gb   DECIMAL(8,4) DEFAULT 0,
  api_calls    INTEGER DEFAULT 0,
  UNIQUE (tenant_id, month)
);

-- ── Tenant settings (per-tenant config) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_settings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  booking_advance_days  INTEGER DEFAULT 60,
  cancellation_hours    INTEGER DEFAULT 24,
  cancellation_fee_pct  DECIMAL(5,2) DEFAULT 0,
  deposit_required      BOOLEAN DEFAULT false,
  deposit_pct           DECIMAL(5,2) DEFAULT 20,
  allow_walk_ins        BOOLEAN DEFAULT true,
  require_phone         BOOLEAN DEFAULT true,
  auto_confirm          BOOLEAN DEFAULT true,
  intake_form_enabled   BOOLEAN DEFAULT false,
  tips_enabled          BOOLEAN DEFAULT true,
  loyalty_enabled       BOOLEAN DEFAULT true,
  whatsapp_enabled      BOOLEAN DEFAULT false,
  fcm_enabled           BOOLEAN DEFAULT false,
  google_calendar_enabled BOOLEAN DEFAULT false,
  stripe_enabled        BOOLEAN DEFAULT false,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_settings_own" ON tenant_settings
  FOR ALL USING (tenant_id = fn_get_current_tenant());

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS tenant_usage, tenant_settings, tenants CASCADE;
-- ALTER TABLE branches DROP COLUMN IF EXISTS tenant_id; ...etc
