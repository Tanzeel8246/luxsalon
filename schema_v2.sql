-- ============================================================
-- LuxSalon V2 — Schema Extension (Modules 1-5)
-- ============================================================

-- ─────────────────────────────────────────
-- MODULE 1: AI / ML
-- ─────────────────────────────────────────

CREATE TABLE demand_forecasts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forecast_date DATE NOT NULL,
  day_of_week  INTEGER,
  predicted_customers INTEGER,
  predicted_revenue   DECIMAL(10,2),
  confidence_score    DECIMAL(4,3),
  model_version       VARCHAR(20) DEFAULT 'v1',
  actual_customers    INTEGER,
  actual_revenue      DECIMAL(10,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE churn_predictions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id      UUID REFERENCES customers(id) ON DELETE CASCADE,
  churn_score      DECIMAL(4,3) NOT NULL CHECK (churn_score BETWEEN 0 AND 1),
  risk_level       VARCHAR(10) NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  days_since_visit INTEGER,
  avg_visit_gap    DECIMAL(6,1),
  predicted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_taken     BOOLEAN DEFAULT false,
  action_type      VARCHAR(50),
  resolved_at      TIMESTAMPTZ
);

CREATE TABLE ai_service_recommendations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  UUID REFERENCES customers(id) ON DELETE CASCADE,
  service_id   UUID REFERENCES services(id) ON DELETE CASCADE,
  score        DECIMAL(4,3),
  reason       VARCHAR(100),
  shown_at     TIMESTAMPTZ,
  booked_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chatbot_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
  channel      VARCHAR(20) CHECK (channel IN ('web','whatsapp','sms')),
  messages     JSONB NOT NULL DEFAULT '[]',
  intent       VARCHAR(50),
  resolved     BOOLEAN DEFAULT false,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ
);

CREATE TABLE smart_schedule_suggestions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id     UUID REFERENCES staff(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  suggested_start TIME,
  suggested_end   TIME,
  reason          TEXT,
  fatigue_score   DECIMAL(3,2),
  accepted        BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- MODULE 2: MOBILE / PWA
-- ─────────────────────────────────────────

CREATE TABLE device_tokens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL,
  platform     VARCHAR(10) CHECK (platform IN ('ios','android','web')),
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE TABLE push_notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  body         TEXT NOT NULL,
  data         JSONB DEFAULT '{}',
  type         VARCHAR(50),
  is_read      BOOLEAN DEFAULT false,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- MODULE 3: FINANCIAL / POS
-- ─────────────────────────────────────────

CREATE TABLE pos_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  cashier_id      UUID REFERENCES staff(id) ON DELETE SET NULL,
  subtotal        DECIMAL(10,2) NOT NULL,
  tax_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate        DECIMAL(5,3)  NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  tip_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL,
  payment_method  VARCHAR(20) CHECK (payment_method IN ('cash','card','wallet','split','gift_card')),
  payment_ref     VARCHAR(255),
  status          VARCHAR(15) DEFAULT 'completed' CHECK (status IN ('pending','completed','refunded','partial_refund')),
  notes           TEXT,
  receipt_number  VARCHAR(50) UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pos_splits (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES pos_transactions(id) ON DELETE CASCADE,
  method         VARCHAR(20) NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  ref            VARCHAR(255)
);

CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES pos_transactions(id) ON DELETE SET NULL,
  issue_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date       DATE,
  subtotal       DECIMAL(10,2) NOT NULL,
  tax_total      DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  grand_total    DECIMAL(10,2) NOT NULL,
  status         VARCHAR(15) DEFAULT 'paid' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  notes          TEXT,
  pdf_url        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  quantity    DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL,
  total       DECIMAL(10,2) NOT NULL
);

CREATE TABLE subscription_plans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(100) NOT NULL,
  description         TEXT,
  price_monthly       DECIMAL(10,2) NOT NULL,
  service_allowances  JSONB DEFAULT '{}',
  unlimited_services  TEXT[] DEFAULT '{}',
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  color               VARCHAR(20) DEFAULT '#D4AF37',
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  plan_id         UUID REFERENCES subscription_plans(id) ON DELETE CASCADE,
  status          VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','expired')),
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date        DATE,
  next_billing    DATE,
  payment_method  VARCHAR(50),
  usage_this_month JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_payroll (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id        UUID REFERENCES staff(id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  base_salary     DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission_rate DECIMAL(5,3)  NOT NULL DEFAULT 0,
  commission_earned DECIMAL(10,2) NOT NULL DEFAULT 0,
  tips_earned     DECIMAL(10,2) NOT NULL DEFAULT 0,
  bonuses         DECIMAL(10,2) NOT NULL DEFAULT 0,
  deductions      DECIMAL(10,2) NOT NULL DEFAULT 0,
  gross_total     DECIMAL(10,2) NOT NULL,
  tax_deducted    DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_pay         DECIMAL(10,2) NOT NULL,
  status          VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending','approved','paid')),
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category     VARCHAR(100) NOT NULL,
  description  TEXT NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url  TEXT,
  approved_by  UUID REFERENCES staff(id) ON DELETE SET NULL,
  branch_id    UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- MODULE 4: ADVANCED ANALYTICS / BI
-- ─────────────────────────────────────────

CREATE TABLE customer_ltv (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  total_spent     DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_visits    INTEGER       NOT NULL DEFAULT 0,
  avg_order_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  visit_frequency DECIMAL(6,2),
  predicted_ltv   DECIMAL(12,2),
  clv_segment     VARCHAR(20) CHECK (clv_segment IN ('champion','loyal','at_risk','lost','new')),
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE revenue_snapshots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date DATE NOT NULL,
  snapshot_hour INTEGER CHECK (snapshot_hour BETWEEN 0 AND 23),
  total_revenue  DECIMAL(12,2) NOT NULL DEFAULT 0,
  appointments   INTEGER       NOT NULL DEFAULT 0,
  new_customers  INTEGER       NOT NULL DEFAULT 0,
  avg_ticket     DECIMAL(10,2) NOT NULL DEFAULT 0,
  branch_id      UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_date, snapshot_hour, branch_id)
);

CREATE TABLE kpi_targets (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_name  VARCHAR(100) NOT NULL,
  target_value DECIMAL(12,2) NOT NULL,
  period       VARCHAR(20) CHECK (period IN ('daily','weekly','monthly','yearly')),
  year         INTEGER,
  month        INTEGER,
  week         INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Materialized view: daily revenue summary
CREATE MATERIALIZED VIEW mv_daily_revenue AS
SELECT
  DATE(start_time)   AS day,
  COUNT(*)           AS total_appointments,
  SUM(total_price)   AS total_revenue,
  AVG(total_price)   AS avg_ticket,
  COUNT(DISTINCT customer_id) AS unique_customers
FROM appointments
WHERE status = 'completed'
GROUP BY DATE(start_time)
WITH DATA;

CREATE UNIQUE INDEX ON mv_daily_revenue(day);

-- Materialized view: service profitability
CREATE MATERIALIZED VIEW mv_service_profitability AS
SELECT
  s.id,
  s.name,
  s.category,
  s.base_price,
  s.duration,
  COUNT(a.id)         AS total_bookings,
  SUM(a.total_price)  AS total_revenue,
  AVG(a.total_price)  AS avg_revenue,
  AVG(a.rating)       AS avg_rating,
  SUM(a.total_price) / NULLIF(s.duration, 0) AS revenue_per_minute
FROM services s
LEFT JOIN appointments a ON a.service_id = s.id AND a.status = 'completed'
GROUP BY s.id, s.name, s.category, s.base_price, s.duration
WITH DATA;

CREATE UNIQUE INDEX ON mv_service_profitability(id);

-- ─────────────────────────────────────────
-- MODULE 5: MARKETING / CRM
-- ─────────────────────────────────────────

CREATE TABLE campaigns (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(255) NOT NULL,
  type           VARCHAR(30) CHECK (type IN ('whatsapp','sms','email','push','all')),
  status         VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','paused','completed','cancelled')),
  target_segment VARCHAR(50),
  target_tiers   TEXT[] DEFAULT '{}',
  message_template TEXT NOT NULL,
  subject        VARCHAR(255),
  scheduled_at   TIMESTAMPTZ,
  sent_count     INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count   INTEGER DEFAULT 0,
  clicked_count  INTEGER DEFAULT 0,
  converted_count INTEGER DEFAULT 0,
  created_by     UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE campaign_recipients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id   UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id) ON DELETE CASCADE,
  status        VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','opened','clicked','converted','failed','unsubscribed')),
  sent_at       TIMESTAMPTZ,
  opened_at     TIMESTAMPTZ,
  clicked_at    TIMESTAMPTZ,
  error         TEXT,
  UNIQUE (campaign_id, customer_id)
);

CREATE TABLE whatsapp_templates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(100) UNIQUE NOT NULL,
  category     VARCHAR(50) CHECK (category IN ('booking','reminder','promotion','feedback','queue','loyalty')),
  template     TEXT NOT NULL,
  variables    TEXT[] DEFAULT '{}',
  is_approved  BOOLEAN DEFAULT false,
  language     VARCHAR(10) DEFAULT 'en',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
  channel      VARCHAR(20) CHECK (channel IN ('whatsapp','sms','email','push')),
  type         VARCHAR(50),
  status       VARCHAR(20) CHECK (status IN ('sent','delivered','failed','read')),
  message      TEXT,
  meta         JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gift_cards (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           VARCHAR(20) UNIQUE NOT NULL,
  initial_value  DECIMAL(10,2) NOT NULL,
  balance        DECIMAL(10,2) NOT NULL,
  purchased_by   UUID REFERENCES customers(id) ON DELETE SET NULL,
  recipient_name VARCHAR(255),
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  message        TEXT,
  status         VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active','used','expired','cancelled')),
  expires_at     DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gift_card_transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gift_card_id UUID REFERENCES gift_cards(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES pos_transactions(id) ON DELETE SET NULL,
  amount_used  DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL,
  balance_after  DECIMAL(10,2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE referrals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id    UUID REFERENCES customers(id) ON DELETE CASCADE,
  referee_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  referral_code  VARCHAR(20) UNIQUE NOT NULL,
  status         VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','rewarded','expired')),
  reward_points  INTEGER DEFAULT 200,
  rewarded_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE unsubscribes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  UUID REFERENCES customers(id) ON DELETE CASCADE,
  channel      VARCHAR(20) NOT NULL,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, channel)
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────

CREATE INDEX idx_churn_risk        ON churn_predictions(risk_level, predicted_at DESC);
CREATE INDEX idx_churn_customer    ON churn_predictions(customer_id);
CREATE INDEX idx_pos_created       ON pos_transactions(created_at);
CREATE INDEX idx_pos_customer      ON pos_transactions(customer_id);
CREATE INDEX idx_payroll_staff     ON staff_payroll(staff_id, period_start);
CREATE INDEX idx_campaigns_status  ON campaigns(status);
CREATE INDEX idx_gift_code         ON gift_cards(code);
CREATE INDEX idx_referral_code     ON referrals(referral_code);
CREATE INDEX idx_notif_customer    ON notification_logs(customer_id, created_at DESC);
CREATE INDEX idx_device_user       ON device_tokens(user_id);
CREATE INDEX idx_ltv_segment       ON customer_ltv(clv_segment);
CREATE INDEX idx_forecast_date     ON demand_forecasts(forecast_date);
CREATE INDEX idx_revenue_snap      ON revenue_snapshots(snapshot_date, snapshot_hour);

-- ─────────────────────────────────────────
-- FUNCTIONS
-- ─────────────────────────────────────────

-- Auto-update customer LTV after appointment completion
CREATE OR REPLACE FUNCTION fn_update_customer_ltv()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total   DECIMAL;
  v_visits  INTEGER;
  v_avg     DECIMAL;
  v_freq    DECIMAL;
  v_segment VARCHAR(20);
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    SELECT
      COALESCE(SUM(total_price), 0),
      COUNT(*),
      COALESCE(AVG(total_price), 0)
    INTO v_total, v_visits, v_avg
    FROM appointments
    WHERE customer_id = NEW.customer_id AND status = 'completed';

    -- frequency: avg days between visits
    SELECT CASE WHEN COUNT(*) > 1
      THEN EXTRACT(EPOCH FROM (MAX(start_time) - MIN(start_time))) / 86400 / NULLIF(COUNT(*)-1,0)
      ELSE NULL END
    INTO v_freq
    FROM appointments
    WHERE customer_id = NEW.customer_id AND status = 'completed';

    v_segment := CASE
      WHEN v_visits >= 10 AND v_total >= 1000 THEN 'champion'
      WHEN v_visits >= 5                       THEN 'loyal'
      WHEN v_freq > 60                         THEN 'at_risk'
      WHEN v_visits = 0                        THEN 'lost'
      ELSE 'new'
    END;

    INSERT INTO customer_ltv(customer_id, total_spent, total_visits, avg_order_value, visit_frequency, clv_segment, calculated_at)
    VALUES (NEW.customer_id, v_total, v_visits, v_avg, v_freq, v_segment, NOW())
    ON CONFLICT (customer_id) DO UPDATE SET
      total_spent     = v_total,
      total_visits    = v_visits,
      avg_order_value = v_avg,
      visit_frequency = v_freq,
      clv_segment     = v_segment,
      calculated_at   = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_ltv
AFTER UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION fn_update_customer_ltv();

-- Generate receipt number
CREATE OR REPLACE FUNCTION fn_generate_receipt()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number := 'RCP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
      LPAD(NEXTVAL('receipt_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS receipt_seq START 1;
CREATE TRIGGER trg_receipt_number
BEFORE INSERT ON pos_transactions
FOR EACH ROW EXECUTE FUNCTION fn_generate_receipt();

-- Generate invoice number
CREATE OR REPLACE FUNCTION fn_generate_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
      LPAD(NEXTVAL('invoice_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
CREATE TRIGGER trg_invoice_number
BEFORE INSERT ON invoices
FOR EACH ROW EXECUTE FUNCTION fn_generate_invoice_number();

-- Churn score calculator
CREATE OR REPLACE FUNCTION fn_calculate_churn_score(p_customer_id UUID)
RETURNS DECIMAL LANGUAGE plpgsql AS $$
DECLARE
  v_days_since   INTEGER;
  v_avg_gap      DECIMAL;
  v_total_visits INTEGER;
  v_score        DECIMAL;
BEGIN
  SELECT
    COALESCE(EXTRACT(DAYS FROM NOW() - MAX(start_time))::INTEGER, 999),
    CASE WHEN COUNT(*) > 1
      THEN EXTRACT(EPOCH FROM (MAX(start_time)-MIN(start_time)))/86400/NULLIF(COUNT(*)-1,0)
      ELSE 30 END,
    COUNT(*)
  INTO v_days_since, v_avg_gap, v_total_visits
  FROM appointments
  WHERE customer_id = p_customer_id AND status IN ('completed','confirmed');

  v_score :=
    LEAST(1.0, v_days_since::DECIMAL / GREATEST(v_avg_gap * 2.5, 30)) * 0.5
    + CASE WHEN v_total_visits <= 1 THEN 0.3 WHEN v_total_visits <= 3 THEN 0.15 ELSE 0 END
    + CASE WHEN v_days_since > 90 THEN 0.2 WHEN v_days_since > 60 THEN 0.1 ELSE 0 END;

  RETURN LEAST(1.0, ROUND(v_score, 4));
END;
$$;

-- RLS for new tables
ALTER TABLE pos_transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns               ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payroll           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_predictions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_admin"          ON pos_transactions       FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "invoices_admin"     ON invoices               FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin','staff')));
CREATE POLICY "campaigns_admin"    ON campaigns              FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "payroll_admin"      ON staff_payroll          FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "churn_admin"        ON churn_predictions      FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "gift_cards_auth"    ON gift_cards             FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "subscriptions_own"  ON customer_subscriptions FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "notifs_own"         ON push_notifications     FOR SELECT USING (user_id = auth.uid());
