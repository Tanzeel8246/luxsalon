-- ============================================================
-- LuxSalon V4 — Final Schema (Modules 11-13)
-- ============================================================

-- ─────────────────────────────────────────
-- MODULE 11: OPERATIONS MANAGEMENT
-- ─────────────────────────────────────────

CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(255)  NOT NULL,
  description  TEXT,
  assigned_to  UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES staff(id) ON DELETE SET NULL,
  branch_id    UUID REFERENCES branches(id) ON DELETE SET NULL,
  category     VARCHAR(50)  CHECK (category IN ('cleaning','maintenance','admin','training','other')),
  priority     VARCHAR(10)  DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status       VARCHAR(15)  DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done','cancelled')),
  due_date     TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  recurrence   VARCHAR(15)  CHECK (recurrence IN ('none','daily','weekly','monthly')),
  tags         TEXT[]       DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE checklists (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255)  NOT NULL,
  type         VARCHAR(20)  CHECK (type IN ('opening','closing','service','safety','cleaning','maintenance')),
  branch_id    UUID REFERENCES branches(id) ON DELETE SET NULL,
  is_active    BOOLEAN       DEFAULT true,
  frequency    VARCHAR(15)  DEFAULT 'daily' CHECK (frequency IN ('daily','weekly','per_service','custom')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
  item         TEXT         NOT NULL,
  order_index  INTEGER      NOT NULL DEFAULT 0,
  is_critical  BOOLEAN      DEFAULT false,
  photo_required BOOLEAN    DEFAULT false
);

CREATE TABLE checklist_completions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id  UUID REFERENCES checklists(id) ON DELETE CASCADE,
  completed_by  UUID REFERENCES staff(id) ON DELETE SET NULL,
  branch_id     UUID REFERENCES branches(id) ON DELETE SET NULL,
  date          DATE         NOT NULL DEFAULT CURRENT_DATE,
  items_done    INTEGER      NOT NULL DEFAULT 0,
  items_total   INTEGER      NOT NULL DEFAULT 0,
  pct_complete  DECIMAL(5,2) GENERATED ALWAYS AS
                (CASE WHEN items_total > 0 THEN ROUND((items_done::DECIMAL/items_total)*100,2) ELSE 0 END) STORED,
  notes         TEXT,
  photo_urls    TEXT[]       DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE incidents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          VARCHAR(30)  CHECK (type IN ('customer_complaint','equipment','staff','safety','theft','other')),
  severity      VARCHAR(10)  CHECK (severity IN ('low','medium','high','critical')),
  title         VARCHAR(255) NOT NULL,
  description   TEXT         NOT NULL,
  reported_by   UUID REFERENCES staff(id) ON DELETE SET NULL,
  involved_staff UUID REFERENCES staff(id) ON DELETE SET NULL,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  branch_id     UUID REFERENCES branches(id) ON DELETE SET NULL,
  status        VARCHAR(15)  DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','closed')),
  resolution    TEXT,
  resolved_by   UUID REFERENCES staff(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  evidence_urls TEXT[]       DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE training_modules (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  category      VARCHAR(50)  CHECK (category IN ('onboarding','skills','safety','compliance','product','customer_service')),
  content_type  VARCHAR(20)  CHECK (content_type IN ('video','document','quiz','practical','mixed')),
  duration_mins INTEGER,
  passing_score INTEGER      DEFAULT 70 CHECK (passing_score BETWEEN 0 AND 100),
  is_mandatory  BOOLEAN      DEFAULT false,
  order_index   INTEGER      DEFAULT 0,
  content_url   TEXT,
  thumbnail_url TEXT,
  is_active     BOOLEAN      DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE training_enrollments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id        UUID REFERENCES staff(id) ON DELETE CASCADE,
  module_id       UUID REFERENCES training_modules(id) ON DELETE CASCADE,
  status          VARCHAR(15) DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','failed')),
  score           INTEGER,
  attempts        INTEGER      DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  due_date        DATE,
  assigned_by     UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, module_id)
);

CREATE TABLE certifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id        UUID REFERENCES staff(id) ON DELETE CASCADE,
  module_id       UUID REFERENCES training_modules(id) ON DELETE CASCADE,
  certificate_no  VARCHAR(50)  UNIQUE NOT NULL,
  issued_date     DATE         NOT NULL DEFAULT CURRENT_DATE,
  expiry_date     DATE,
  score           INTEGER,
  is_valid        BOOLEAN      DEFAULT true,
  certificate_url TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- MODULE 12: PERFORMANCE & TECHNICAL
-- ─────────────────────────────────────────

CREATE TABLE error_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level        VARCHAR(10)  CHECK (level IN ('debug','info','warn','error','fatal')),
  message      TEXT         NOT NULL,
  stack        TEXT,
  source       VARCHAR(100),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_path TEXT,
  request_data JSONB        DEFAULT '{}',
  environment  VARCHAR(10)  DEFAULT 'production',
  resolved     BOOLEAN      DEFAULT false,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE performance_metrics (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_name  VARCHAR(100) NOT NULL,
  metric_value DECIMAL(12,4) NOT NULL,
  unit         VARCHAR(20),
  endpoint     VARCHAR(255),
  method       VARCHAR(10),
  status_code  INTEGER,
  duration_ms  INTEGER,
  memory_mb    DECIMAL(8,2),
  branch_id    UUID,
  recorded_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE api_rate_limits (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier   VARCHAR(255) NOT NULL,
  endpoint     VARCHAR(255) NOT NULL,
  requests     INTEGER      NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  window_ms    INTEGER      NOT NULL DEFAULT 60000,
  max_requests INTEGER      NOT NULL DEFAULT 100,
  is_blocked   BOOLEAN      DEFAULT false,
  UNIQUE (identifier, endpoint)
);

CREATE TABLE webhooks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(100) NOT NULL,
  url          TEXT         NOT NULL,
  events       TEXT[]       NOT NULL DEFAULT '{}',
  secret       TEXT,
  is_active    BOOLEAN      DEFAULT true,
  last_fired   TIMESTAMPTZ,
  success_count INTEGER     DEFAULT 0,
  failure_count INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id   UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type   VARCHAR(100) NOT NULL,
  payload      JSONB        NOT NULL,
  status_code  INTEGER,
  response     TEXT,
  duration_ms  INTEGER,
  delivered_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE cache_keys (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key          VARCHAR(255) UNIQUE NOT NULL,
  value        JSONB        NOT NULL,
  expires_at   TIMESTAMPTZ  NOT NULL,
  hit_count    INTEGER      DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- MODULE 13: INTEGRATIONS & API
-- ─────────────────────────────────────────

CREATE TABLE integration_configs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider     VARCHAR(50)  NOT NULL CHECK (provider IN (
    'google_calendar','apple_calendar','stripe','paypal','razorpay',
    'quickbooks','mailchimp','sendgrid','twilio','firebase',
    'zapier','google_mybusiness','instagram','facebook','whatsapp_business'
  )),
  is_enabled   BOOLEAN      DEFAULT false,
  config       JSONB        DEFAULT '{}',
  access_token TEXT,
  refresh_token TEXT,
  expires_at   TIMESTAMPTZ,
  last_sync    TIMESTAMPTZ,
  sync_status  VARCHAR(15)  DEFAULT 'idle' CHECK (sync_status IN ('idle','syncing','success','error')),
  error_msg    TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (provider)
);

CREATE TABLE calendar_syncs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID REFERENCES appointments(id) ON DELETE CASCADE,
  provider        VARCHAR(30),
  external_id     TEXT,
  sync_status     VARCHAR(15) DEFAULT 'pending',
  last_synced     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_gateways (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider     VARCHAR(20)  CHECK (provider IN ('stripe','paypal','razorpay','cash','manual')),
  is_active    BOOLEAN      DEFAULT false,
  is_default   BOOLEAN      DEFAULT false,
  public_key   TEXT,
  webhook_secret TEXT,
  config       JSONB        DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pos_id          UUID REFERENCES pos_transactions(id) ON DELETE SET NULL,
  gateway         VARCHAR(20),
  gateway_txn_id  TEXT,
  amount          DECIMAL(10,2),
  currency        VARCHAR(3)   DEFAULT 'USD',
  status          VARCHAR(15)  CHECK (status IN ('pending','authorized','captured','failed','refunded')),
  metadata        JSONB        DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE report_templates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  type         VARCHAR(30)  CHECK (type IN ('revenue','staff','inventory','customers','appointments','custom')),
  config       JSONB        NOT NULL DEFAULT '{}',
  schedule     VARCHAR(15)  CHECK (schedule IN ('manual','daily','weekly','monthly')),
  recipients   TEXT[]       DEFAULT '{}',
  last_run     TIMESTAMPTZ,
  created_by   UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE exported_reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id  UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  format       VARCHAR(10)  CHECK (format IN ('pdf','xlsx','csv','json')),
  file_url     TEXT,
  file_size    INTEGER,
  generated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  period_start DATE,
  period_end   DATE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX idx_tasks_assigned    ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_due         ON tasks(due_date, status);
CREATE INDEX idx_tasks_branch      ON tasks(branch_id, category);
CREATE INDEX idx_checklist_date    ON checklist_completions(date, branch_id);
CREATE INDEX idx_incidents_status  ON incidents(status, severity);
CREATE INDEX idx_training_staff    ON training_enrollments(staff_id, status);
CREATE INDEX idx_error_level       ON error_logs(level, created_at DESC);
CREATE INDEX idx_perf_endpoint     ON performance_metrics(endpoint, recorded_at DESC);
CREATE INDEX idx_perf_name         ON performance_metrics(metric_name, recorded_at DESC);
CREATE INDEX idx_rate_limit        ON api_rate_limits(identifier, window_start);
CREATE INDEX idx_webhook_events    ON webhooks USING gin(events);
CREATE INDEX idx_integration       ON integration_configs(provider);
CREATE INDEX idx_payment_gateway   ON payment_transactions(gateway, created_at);

-- ─────────────────────────────────────────
-- AUTO-PERFORMANCE LOGGING
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_log_performance(
  p_name     TEXT,
  p_value    DECIMAL,
  p_unit     TEXT DEFAULT 'ms',
  p_endpoint TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO performance_metrics(metric_name, metric_value, unit, endpoint, recorded_at)
  VALUES(p_name, p_value, p_unit, p_endpoint, NOW());
END;
$$;

-- Auto-generate certificate numbers
CREATE SEQUENCE IF NOT EXISTS cert_seq START 1;
CREATE OR REPLACE FUNCTION fn_generate_cert_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.certificate_no IS NULL OR NEW.certificate_no = '' THEN
    NEW.certificate_no := 'CERT-' || TO_CHAR(NOW(),'YYYY') || '-' ||
      LPAD(NEXTVAL('cert_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cert_no BEFORE INSERT ON certifications
FOR EACH ROW EXECUTE FUNCTION fn_generate_cert_no();

-- Rate limit check function
CREATE OR REPLACE FUNCTION fn_check_rate_limit(
  p_identifier TEXT,
  p_endpoint   TEXT,
  p_max        INTEGER DEFAULT 100,
  p_window_ms  INTEGER DEFAULT 60000
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_record api_rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ := v_now - (p_window_ms || ' milliseconds')::INTERVAL;
BEGIN
  SELECT * INTO v_record FROM api_rate_limits
  WHERE identifier = p_identifier AND endpoint = p_endpoint;

  IF NOT FOUND THEN
    INSERT INTO api_rate_limits(identifier, endpoint, requests, window_start, window_ms, max_requests)
    VALUES(p_identifier, p_endpoint, 1, v_now, p_window_ms, p_max);
    RETURN TRUE;
  END IF;

  IF v_record.window_start < v_window_start THEN
    UPDATE api_rate_limits SET requests = 1, window_start = v_now, is_blocked = FALSE
    WHERE identifier = p_identifier AND endpoint = p_endpoint;
    RETURN TRUE;
  END IF;

  IF v_record.requests >= p_max THEN
    UPDATE api_rate_limits SET is_blocked = TRUE WHERE identifier = p_identifier AND endpoint = p_endpoint;
    RETURN FALSE;
  END IF;

  UPDATE api_rate_limits SET requests = requests + 1
  WHERE identifier = p_identifier AND endpoint = p_endpoint;
  RETURN TRUE;
END;
$$;

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────
ALTER TABLE tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists            ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_modules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_enrollments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_staff"        ON tasks               FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid()));
CREATE POLICY "checklists_staff"   ON checklists          FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid()));
CREATE POLICY "completions_staff"  ON checklist_completions FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid()));
CREATE POLICY "incidents_staff"    ON incidents           FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid()));
CREATE POLICY "training_all"       ON training_modules    FOR SELECT USING (is_active = true);
CREATE POLICY "enrollments_own"    ON training_enrollments FOR ALL USING (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));
CREATE POLICY "certs_own"          ON certifications      FOR SELECT USING (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));
CREATE POLICY "errors_admin"       ON error_logs          FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "perf_admin"         ON performance_metrics FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "integrations_admin" ON integration_configs FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "reports_staff"      ON report_templates    FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid()));
