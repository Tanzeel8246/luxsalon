-- ============================================================
-- Migration: 005_business_features
-- Cancellation policies, intake forms, before/after photos,
-- tips management, recurring billing, customer merge, end-of-day
-- ============================================================

-- ── Cancellation Policy ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cancellation_policies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL DEFAULT 'Standard Policy',
  notice_hours    INTEGER NOT NULL DEFAULT 24,   -- min hours notice for free cancel
  fee_percentage  DECIMAL(5,2) NOT NULL DEFAULT 0,
  fee_fixed       DECIMAL(10,2) NOT NULL DEFAULT 0,
  no_show_fee_pct DECIMAL(5,2) NOT NULL DEFAULT 100, -- 100% on no-show
  deposit_required BOOLEAN DEFAULT false,
  deposit_pct     DECIMAL(5,2) DEFAULT 20,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track cancellation fees charged
CREATE TABLE IF NOT EXISTS cancellation_fees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  policy_id       UUID REFERENCES cancellation_policies(id) ON DELETE SET NULL,
  fee_amount      DECIMAL(10,2) NOT NULL,
  reason          VARCHAR(15) CHECK (reason IN ('late_cancel','no_show','early_cancel')),
  charged_at      TIMESTAMPTZ,
  waived          BOOLEAN DEFAULT false,
  waived_by       UUID REFERENCES staff(id) ON DELETE SET NULL,
  waived_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Intake Forms ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intake_forms (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  fields       JSONB NOT NULL DEFAULT '[]',  -- [{id, label, type, required, options}]
  service_ids  UUID[] DEFAULT '{}',          -- Apply to specific services
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intake_submissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id         UUID REFERENCES intake_forms(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  responses       JSONB NOT NULL DEFAULT '{}',
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (form_id, appointment_id)
);

-- ── Customer Allergies & Preferences ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_health_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  allergies       TEXT[] DEFAULT '{}',
  sensitivities   TEXT[] DEFAULT '{}',        -- chemical, fragrance, latex
  medical_notes   TEXT,
  preferred_products TEXT[] DEFAULT '{}',
  avoided_products   TEXT[] DEFAULT '{}',
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID REFERENCES staff(id) ON DELETE SET NULL
);

-- ── Before/After Photos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_photos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  staff_id        UUID REFERENCES staff(id) ON DELETE SET NULL,
  photo_type      VARCHAR(10) CHECK (photo_type IN ('before','after','during')),
  storage_path    TEXT NOT NULL,
  storage_url     TEXT,
  consent_given   BOOLEAN NOT NULL DEFAULT false,
  is_portfolio    BOOLEAN DEFAULT false,  -- Can be used for marketing
  taken_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tips Management ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tips (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID REFERENCES appointments(id) ON DELETE CASCADE,
  transaction_id  UUID REFERENCES pos_transactions(id) ON DELETE SET NULL,
  staff_id        UUID REFERENCES staff(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  amount          DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  method          VARCHAR(20) CHECK (method IN ('cash','card','wallet','included')),
  declared_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMPTZ,
  included_in_payroll BOOLEAN DEFAULT false,
  UNIQUE (appointment_id, staff_id)
);

-- ── End-of-Day Reconciliation ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS day_end_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID REFERENCES branches(id) ON DELETE CASCADE,
  report_date     DATE NOT NULL,
  closed_by       UUID REFERENCES staff(id) ON DELETE SET NULL,
  status          VARCHAR(15) DEFAULT 'open' CHECK (status IN ('open','closed','reconciled')),
  -- Revenue
  total_revenue       DECIMAL(12,2) DEFAULT 0,
  cash_expected       DECIMAL(10,2) DEFAULT 0,
  cash_actual         DECIMAL(10,2) DEFAULT 0,
  cash_variance       DECIMAL(10,2) GENERATED ALWAYS AS (cash_actual - cash_expected) STORED,
  card_total          DECIMAL(10,2) DEFAULT 0,
  tips_total          DECIMAL(10,2) DEFAULT 0,
  refunds_total       DECIMAL(10,2) DEFAULT 0,
  -- Appointments
  appointments_total  INTEGER DEFAULT 0,
  appointments_done   INTEGER DEFAULT 0,
  appointments_cancelled INTEGER DEFAULT 0,
  no_shows            INTEGER DEFAULT 0,
  walk_ins            INTEGER DEFAULT 0,
  -- Staff
  active_staff        INTEGER DEFAULT 0,
  -- Inventory
  inventory_consumed  JSONB DEFAULT '{}',
  -- Notes
  notes               TEXT,
  discrepancy_reason  TEXT,
  closed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, report_date)
);

-- ── Customer Merge Log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_merges (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  primary_id      UUID REFERENCES customers(id) ON DELETE CASCADE,
  merged_id       UUID NOT NULL,  -- The deleted customer
  merged_by       UUID REFERENCES staff(id) ON DELETE SET NULL,
  merge_summary   JSONB DEFAULT '{}',  -- What data was transferred
  merged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Recurring Billing ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  plan_id         UUID REFERENCES subscription_plans(id) ON DELETE CASCADE,
  stripe_sub_id   TEXT UNIQUE,
  amount          DECIMAL(10,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'USD',
  interval        VARCHAR(10) CHECK (interval IN ('weekly','monthly','yearly')),
  next_billing    DATE NOT NULL,
  last_billed     DATE,
  status          VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','failed')),
  retry_count     INTEGER DEFAULT 0,
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Deposits ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointment_deposits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID REFERENCES appointments(id) ON DELETE CASCADE UNIQUE,
  amount          DECIMAL(10,2) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'USD',
  stripe_payment_intent_id TEXT,
  status          VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','applied')),
  paid_at         TIMESTAMPTZ,
  applied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cancel_fees_apt     ON cancellation_fees(appointment_id);
CREATE INDEX IF NOT EXISTS idx_intake_sub_cust     ON intake_submissions(customer_id);
CREATE INDEX IF NOT EXISTS idx_photos_apt          ON service_photos(appointment_id);
CREATE INDEX IF NOT EXISTS idx_tips_staff          ON tips(staff_id, declared_at);
CREATE INDEX IF NOT EXISTS idx_tips_apt            ON tips(appointment_id);
CREATE INDEX IF NOT EXISTS idx_day_end_branch      ON day_end_reports(branch_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_billing_next        ON billing_schedules(next_billing) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_deposit_apt         ON appointment_deposits(appointment_id);

-- ── Function: calculate cancellation fee ──────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_calculate_cancellation_fee(
  p_appointment_id UUID,
  p_cancelled_at   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(fee_amount DECIMAL, reason TEXT, policy_name TEXT)
LANGUAGE plpgsql AS $$
DECLARE
  v_appt      appointments%ROWTYPE;
  v_policy    cancellation_policies%ROWTYPE;
  v_hours_notice DECIMAL;
  v_fee       DECIMAL := 0;
  v_reason    TEXT    := 'early_cancel';
BEGIN
  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Get applicable policy (branch → tenant default)
  SELECT * INTO v_policy
  FROM cancellation_policies
  WHERE tenant_id = (SELECT tenant_id FROM branches WHERE id = v_appt.branch_id LIMIT 1)
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::DECIMAL, 'no_policy'::TEXT, 'none'::TEXT;
    RETURN;
  END IF;

  v_hours_notice := EXTRACT(EPOCH FROM (v_appt.start_time - p_cancelled_at)) / 3600;

  IF v_hours_notice < 0 THEN
    -- Already past — no-show
    v_fee    := v_appt.total_price * (v_policy.no_show_fee_pct / 100);
    v_reason := 'no_show';
  ELSIF v_hours_notice < v_policy.notice_hours THEN
    -- Late cancellation
    IF v_policy.fee_fixed > 0 THEN
      v_fee := v_policy.fee_fixed;
    ELSE
      v_fee := v_appt.total_price * (v_policy.fee_percentage / 100);
    END IF;
    v_reason := 'late_cancel';
  ELSE
    -- Free cancellation
    v_fee    := 0;
    v_reason := 'early_cancel';
  END IF;

  RETURN QUERY SELECT ROUND(v_fee, 2), v_reason, v_policy.name;
END;
$$;

-- ── Function: end-of-day auto-calculation ────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_generate_day_end_report(
  p_branch_id UUID,
  p_date      DATE DEFAULT CURRENT_DATE
)
RETURNS day_end_reports LANGUAGE plpgsql AS $$
DECLARE
  v_report day_end_reports%ROWTYPE;
BEGIN
  INSERT INTO day_end_reports (branch_id, report_date, status)
  VALUES (p_branch_id, p_date, 'open')
  ON CONFLICT (branch_id, report_date) DO NOTHING;

  UPDATE day_end_reports r SET
    total_revenue = (
      SELECT COALESCE(SUM(t.total), 0) FROM pos_transactions t
      WHERE t.branch_id = p_branch_id AND t.status = 'completed'
        AND DATE(t.created_at) = p_date
    ),
    cash_expected = (
      SELECT COALESCE(SUM(t.total), 0) FROM pos_transactions t
      WHERE t.branch_id = p_branch_id AND t.status = 'completed'
        AND t.payment_method = 'cash' AND DATE(t.created_at) = p_date
    ),
    card_total = (
      SELECT COALESCE(SUM(t.total), 0) FROM pos_transactions t
      WHERE t.branch_id = p_branch_id AND t.status = 'completed'
        AND t.payment_method IN ('card','wallet') AND DATE(t.created_at) = p_date
    ),
    tips_total = (
      SELECT COALESCE(SUM(t.tip_amount), 0) FROM pos_transactions t
      WHERE t.branch_id = p_branch_id AND t.status = 'completed'
        AND DATE(t.created_at) = p_date
    ),
    refunds_total = (
      SELECT COALESCE(SUM(t.total), 0) FROM pos_transactions t
      WHERE t.branch_id = p_branch_id AND t.status IN ('refunded','partial_refund')
        AND DATE(t.created_at) = p_date
    ),
    appointments_total = (
      SELECT COUNT(*) FROM appointments a
      WHERE a.branch_id = p_branch_id AND DATE(a.start_time) = p_date
    ),
    appointments_done = (
      SELECT COUNT(*) FROM appointments a
      WHERE a.branch_id = p_branch_id AND DATE(a.start_time) = p_date
        AND a.status = 'completed'
    ),
    appointments_cancelled = (
      SELECT COUNT(*) FROM appointments a
      WHERE a.branch_id = p_branch_id AND DATE(a.start_time) = p_date
        AND a.status = 'cancelled'
    ),
    no_shows = (
      SELECT COUNT(*) FROM appointments a
      WHERE a.branch_id = p_branch_id AND DATE(a.start_time) = p_date
        AND a.status = 'no_show'
    )
  WHERE r.branch_id = p_branch_id AND r.report_date = p_date
  RETURNING * INTO v_report;

  RETURN v_report;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE intake_forms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_health_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_photos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_end_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_fees    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_own"     ON customer_health_notes FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "photos_own"     ON service_photos        FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()) OR staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));
CREATE POLICY "tips_staff"     ON tips                  FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid()));
CREATE POLICY "day_end_admin"  ON day_end_reports       FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin','staff')));
CREATE POLICY "fees_staff"     ON cancellation_fees     FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid()));
