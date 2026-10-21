-- ============================================================
-- Migration: 002_commission_rules
-- Replaces hardcoded 35% commission with configurable per-staff rules
-- ============================================================

-- Commission rules table
-- Priority: staff+service > staff+category > staff_only > global
CREATE TABLE commission_rules (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id       UUID REFERENCES staff(id) ON DELETE CASCADE,
  service_id     UUID REFERENCES services(id) ON DELETE CASCADE,
  category       VARCHAR(100),            -- service category override
  rule_type      VARCHAR(20) NOT NULL CHECK (
    rule_type IN ('percentage','fixed','tiered')
  ),
  rate           DECIMAL(5,4),            -- percentage (0.35 = 35%)
  fixed_amount   DECIMAL(10,2),           -- fixed per service
  tiers          JSONB,                   -- [{min_revenue, rate}] for tiered
  applies_retail BOOLEAN DEFAULT false,    -- also applies to product sales
  valid_from     DATE DEFAULT CURRENT_DATE,
  valid_until    DATE,
  priority       INTEGER DEFAULT 0,        -- higher = takes precedence
  is_active      BOOLEAN DEFAULT true,
  created_by     UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_commission_target CHECK (
    staff_id IS NOT NULL OR category IS NOT NULL
  ),
  CONSTRAINT chk_commission_value CHECK (
    (rule_type = 'percentage' AND rate IS NOT NULL) OR
    (rule_type = 'fixed'      AND fixed_amount IS NOT NULL) OR
    (rule_type = 'tiered'     AND tiers IS NOT NULL)
  )
);

-- Staff salary config (base salary per staff)
CREATE TABLE staff_salary_config (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id       UUID REFERENCES staff(id) ON DELETE CASCADE UNIQUE,
  base_salary    DECIMAL(10,2) NOT NULL DEFAULT 0,
  pay_period     VARCHAR(10) DEFAULT 'monthly' CHECK (pay_period IN ('weekly','biweekly','monthly')),
  currency       VARCHAR(3) DEFAULT 'PKR',
  effective_from DATE DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payroll rules for deductions/bonuses
CREATE TABLE payroll_deductions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id     UUID REFERENCES staff(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  type         VARCHAR(15) CHECK (type IN ('deduction','bonus','loan_repay','tax')),
  amount       DECIMAL(10,2) NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  frequency    VARCHAR(10) CHECK (frequency IN ('once','monthly','weekly')),
  start_date   DATE,
  end_date     DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commission_rules_staff   ON commission_rules(staff_id) WHERE is_active = true;
CREATE INDEX idx_commission_rules_service ON commission_rules(service_id) WHERE is_active = true;
CREATE INDEX idx_commission_priority      ON commission_rules(priority DESC);
CREATE INDEX idx_salary_config_staff      ON staff_salary_config(staff_id);

-- ─── Function: resolve commission for a service completion ───────────────────
CREATE OR REPLACE FUNCTION fn_resolve_commission(
  p_staff_id    UUID,
  p_service_id  UUID,
  p_revenue     DECIMAL,
  p_period_start DATE,
  p_period_end   DATE
)
RETURNS DECIMAL
LANGUAGE plpgsql AS $$
DECLARE
  v_rule   commission_rules%ROWTYPE;
  v_category VARCHAR(100);
  v_period_revenue DECIMAL;
  v_tier    JSONB;
  v_rate    DECIMAL;
BEGIN
  -- Get service category
  SELECT category INTO v_category FROM services WHERE id = p_service_id;

  -- Find applicable rule (priority: staff+service > staff+category > staff_only > global)
  SELECT * INTO v_rule
  FROM commission_rules
  WHERE is_active = true
    AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    AND (
      (staff_id = p_staff_id AND service_id = p_service_id)  -- Most specific
      OR (staff_id = p_staff_id AND category = v_category AND service_id IS NULL)
      OR (staff_id = p_staff_id AND service_id IS NULL AND category IS NULL)
      OR (staff_id IS NULL AND service_id = p_service_id)
      OR (staff_id IS NULL AND category = v_category)
      OR (staff_id IS NULL AND service_id IS NULL AND category IS NULL)
    )
  ORDER BY priority DESC, created_at DESC
  LIMIT 1;

  -- If no rule found, return 0 (requires explicit configuration)
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Apply rule
  IF v_rule.rule_type = 'percentage' THEN
    RETURN ROUND(p_revenue * v_rule.rate, 2);

  ELSIF v_rule.rule_type = 'fixed' THEN
    RETURN v_rule.fixed_amount;

  ELSIF v_rule.rule_type = 'tiered' THEN
    -- Calculate total period revenue for tiered commission
    SELECT COALESCE(SUM(total_price), 0) INTO v_period_revenue
    FROM appointments
    WHERE staff_id  = p_staff_id
      AND status    = 'completed'
      AND DATE(start_time) BETWEEN p_period_start AND p_period_end;

    -- Find applicable tier
    v_rate := 0;
    FOR v_tier IN SELECT * FROM jsonb_array_elements(v_rule.tiers) LOOP
      IF v_period_revenue >= (v_tier->>'min_revenue')::DECIMAL THEN
        v_rate := (v_tier->>'rate')::DECIMAL;
      END IF;
    END LOOP;

    RETURN ROUND(p_revenue * v_rate, 2);
  END IF;

  RETURN 0;
END;
$$;

-- ─── Seed: default commission rules ──────────────────────────────────────────
-- Admin should configure these after deployment.
-- This creates a default 30% rule for all staff as fallback.
INSERT INTO commission_rules (
  rule_type, rate, priority, notes
) VALUES (
  'percentage', 0.30, 0, 'Global default — 30% on all services. Configure per-staff rules to override.'
) ON CONFLICT DO NOTHING;

-- ─── Rollback ─────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS payroll_deductions CASCADE;
-- DROP TABLE IF EXISTS staff_salary_config CASCADE;
-- DROP TABLE IF EXISTS commission_rules CASCADE;
-- DROP FUNCTION IF EXISTS fn_resolve_commission;
