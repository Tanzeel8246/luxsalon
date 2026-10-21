-- ============================================================
-- Smart Salon & Groom Center — Full Database Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- STAFF
-- ============================================================
CREATE TABLE staff (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255) UNIQUE NOT NULL,
  phone          VARCHAR(20),
  role           VARCHAR(10)  NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  skills         TEXT[]       NOT NULL DEFAULT '{}',
  rating         DECIMAL(3,2) NOT NULL DEFAULT 5.0 CHECK (rating BETWEEN 0 AND 5),
  total_reviews  INTEGER      NOT NULL DEFAULT 0,
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  avatar_url     TEXT,
  bio            TEXT,
  hire_date      DATE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE services (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255)  NOT NULL,
  description     TEXT,
  duration        INTEGER       NOT NULL CHECK (duration > 0),
  base_price      DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
  category        VARCHAR(100)  NOT NULL,
  required_skills TEXT[]        NOT NULL DEFAULT '{}',
  image_url       TEXT,
  popularity      INTEGER       NOT NULL DEFAULT 0,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PACKAGES
-- ============================================================
CREATE TABLE packages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(255)  NOT NULL,
  description         TEXT,
  service_ids         UUID[]        NOT NULL,
  discount_percentage DECIMAL(5,2)  NOT NULL DEFAULT 0 CHECK (discount_percentage BETWEEN 0 AND 100),
  total_price         DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
  image_url           TEXT,
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255) UNIQUE NOT NULL,
  phone          VARCHAR(20),
  date_of_birth  DATE,
  loyalty_points INTEGER      NOT NULL DEFAULT 0,
  tier           VARCHAR(10)  NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  preferences    JSONB        NOT NULL DEFAULT '{}',
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STAFF AVAILABILITY
-- ============================================================
CREATE TABLE staff_availability (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id     UUID REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME    NOT NULL,
  end_time     TIME    NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (staff_id, day_of_week)
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id      UUID REFERENCES customers(id) ON DELETE CASCADE  NOT NULL,
  staff_id         UUID REFERENCES staff(id)    ON DELETE SET NULL,
  service_id       UUID REFERENCES services(id) ON DELETE CASCADE   NOT NULL,
  package_id       UUID REFERENCES packages(id) ON DELETE SET NULL,
  start_time       TIMESTAMPTZ   NOT NULL,
  end_time         TIMESTAMPTZ   NOT NULL,
  status           VARCHAR(15)   NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled','no_show')),
  total_price      DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
  discount_applied DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  rating           INTEGER       CHECK (rating BETWEEN 1 AND 5),
  review           TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT no_overlap EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status NOT IN ('cancelled','no_show'))
);

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TABLE inventory (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255)  NOT NULL,
  sku             VARCHAR(100)  UNIQUE NOT NULL,
  category        VARCHAR(100),
  quantity        DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit            VARCHAR(50)   NOT NULL,
  min_threshold   DECIMAL(10,2) NOT NULL DEFAULT 10,
  cost_per_unit   DECIMAL(10,2) NOT NULL CHECK (cost_per_unit >= 0),
  supplier        VARCHAR(255),
  last_restocked  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SERVICE → INVENTORY USAGE
-- ============================================================
CREATE TABLE service_inventory (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id     UUID REFERENCES services(id)   ON DELETE CASCADE NOT NULL,
  inventory_id   UUID REFERENCES inventory(id)  ON DELETE CASCADE NOT NULL,
  quantity_used  DECIMAL(10,2) NOT NULL CHECK (quantity_used > 0),
  UNIQUE (service_id, inventory_id)
);

-- ============================================================
-- LOYALTY TRANSACTIONS
-- ============================================================
CREATE TABLE loyalty_transactions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id    UUID REFERENCES customers(id)    ON DELETE CASCADE NOT NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  points         INTEGER     NOT NULL,
  type           VARCHAR(6)  NOT NULL CHECK (type IN ('earn','redeem')),
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- QUEUE
-- ============================================================
CREATE TABLE queue (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id    UUID REFERENCES customers(id) ON DELETE CASCADE  NOT NULL,
  service_id     UUID REFERENCES services(id) ON DELETE CASCADE   NOT NULL,
  staff_id       UUID REFERENCES staff(id)    ON DELETE SET NULL,
  position       INTEGER     NOT NULL,
  estimated_wait INTEGER,
  status         VARCHAR(10) NOT NULL DEFAULT 'waiting'
                   CHECK (status IN ('waiting','called','serving','done','cancelled')),
  check_in_time  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at      TIMESTAMPTZ,
  served_at      TIMESTAMPTZ,
  done_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRICING RULES
-- ============================================================
CREATE TABLE pricing_rules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  rule_type   VARCHAR(20)  NOT NULL CHECK (rule_type IN ('peak_hours','demand','seasonal','loyalty','promo')),
  service_id  UUID REFERENCES services(id) ON DELETE CASCADE,
  multiplier  DECIMAL(4,2) NOT NULL DEFAULT 1.0 CHECK (multiplier > 0),
  conditions  JSONB        NOT NULL DEFAULT '{}',
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ANALYTICS LOGS
-- ============================================================
CREATE TABLE analytics_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type  VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id   UUID,
  data        JSONB        NOT NULL DEFAULT '{}',
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_appointments_customer   ON appointments(customer_id);
CREATE INDEX idx_appointments_staff      ON appointments(staff_id);
CREATE INDEX idx_appointments_start      ON appointments(start_time);
CREATE INDEX idx_appointments_status     ON appointments(status);
CREATE INDEX idx_appointments_range      ON appointments USING gist(tstzrange(start_time, end_time));
CREATE INDEX idx_queue_status            ON queue(status);
CREATE INDEX idx_queue_position          ON queue(position);
CREATE INDEX idx_analytics_event         ON analytics_logs(event_type);
CREATE INDEX idx_analytics_created       ON analytics_logs(created_at);
CREATE INDEX idx_inventory_sku           ON inventory(sku);
CREATE INDEX idx_customers_tier          ON customers(tier);
CREATE INDEX idx_staff_rating            ON staff(rating DESC);

-- ============================================================
-- TRIGGERS — updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['staff','services','packages','customers','appointments','inventory','queue']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ============================================================
-- FUNCTION: reduce_inventory_after_service
-- ============================================================
CREATE OR REPLACE FUNCTION fn_reduce_inventory_after_service()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE inventory i
    SET    quantity = quantity - si.quantity_used,
           updated_at = NOW()
    FROM   service_inventory si
    WHERE  si.service_id = NEW.service_id
      AND  si.inventory_id = i.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reduce_inventory
AFTER UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION fn_reduce_inventory_after_service();

-- ============================================================
-- FUNCTION: award_loyalty_points
-- ============================================================
CREATE OR REPLACE FUNCTION fn_award_loyalty_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE pts INTEGER;
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    pts := FLOOR(NEW.total_price)::INTEGER;
    INSERT INTO loyalty_transactions(customer_id, appointment_id, points, type, description)
    VALUES (NEW.customer_id, NEW.id, pts, 'earn', 'Points earned from appointment');

    UPDATE customers
    SET    loyalty_points = loyalty_points + pts,
           tier = CASE
             WHEN loyalty_points + pts >= 5000 THEN 'platinum'
             WHEN loyalty_points + pts >= 2000 THEN 'gold'
             WHEN loyalty_points + pts >= 500  THEN 'silver'
             ELSE 'bronze'
           END,
           updated_at = NOW()
    WHERE  id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_loyalty
AFTER UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION fn_award_loyalty_points();

-- ============================================================
-- FUNCTION: get_staff_score (Smart Booking Engine)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_get_staff_score(
  p_staff_id      UUID,
  p_service_id    UUID,
  p_start_time    TIMESTAMPTZ,
  p_end_time      TIMESTAMPTZ
)
RETURNS DECIMAL LANGUAGE plpgsql AS $$
DECLARE
  v_rating       DECIMAL;
  v_workload     INTEGER;
  v_availability DECIMAL;
  v_score        DECIMAL;
BEGIN
  SELECT rating INTO v_rating FROM staff WHERE id = p_staff_id;

  SELECT COUNT(*) INTO v_workload
  FROM appointments
  WHERE staff_id = p_staff_id
    AND DATE(start_time) = DATE(p_start_time)
    AND status NOT IN ('cancelled','no_show');

  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM appointments
      WHERE staff_id = p_staff_id
        AND tstzrange(start_time, end_time) && tstzrange(p_start_time, p_end_time)
        AND status NOT IN ('cancelled','no_show')
    ) THEN 0
    ELSE 1
  END INTO v_availability;

  v_score := (v_rating / 5.0 * 0.5)
           + (v_availability * 0.3)
           + (GREATEST(0, 1 - v_workload::DECIMAL / 10) * 0.2);

  RETURN ROUND(v_score, 4);
END;
$$;

-- ============================================================
-- FUNCTION: calculate_queue_wait
-- ============================================================
CREATE OR REPLACE FUNCTION fn_calculate_queue_wait(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  queue_length   BIGINT,
  active_staff   BIGINT,
  avg_duration   NUMERIC,
  estimated_wait NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(q.id)::BIGINT                       AS queue_length,
    COUNT(DISTINCT q.staff_id)::BIGINT        AS active_staff,
    AVG(s.duration)::NUMERIC                  AS avg_duration,
    CASE
      WHEN COUNT(DISTINCT q.staff_id) = 0 THEN 0
      ELSE (COUNT(q.id)::NUMERIC * AVG(s.duration)) / COUNT(DISTINCT q.staff_id)
    END                                       AS estimated_wait
  FROM queue q
  JOIN services s ON s.id = q.service_id
  WHERE q.status IN ('waiting','called','serving')
    AND DATE(q.check_in_time) = p_date;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE staff                ENABLE ROW LEVEL SECURITY;
ALTER TABLE services             ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory            ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue                ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules        ENABLE ROW LEVEL SECURITY;

-- Public read for catalog data
CREATE POLICY "services_public_read"  ON services  FOR SELECT USING (is_active = true);
CREATE POLICY "packages_public_read"  ON packages  FOR SELECT USING (is_active = true);
CREATE POLICY "staff_public_read"     ON staff     FOR SELECT USING (is_active = true);

-- Customers own their data
CREATE POLICY "customers_own_read"   ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "customers_own_update" ON customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "customers_insert"     ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Appointments
CREATE POLICY "appointments_read" ON appointments FOR SELECT
  USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    OR staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );

CREATE POLICY "appointments_insert" ON appointments FOR INSERT
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

CREATE POLICY "appointments_update_staff" ON appointments FOR UPDATE
  USING (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));

-- Queue public for authenticated
CREATE POLICY "queue_auth_read"   ON queue FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "queue_auth_insert" ON queue FOR INSERT  WITH CHECK (auth.role() = 'authenticated');

-- Loyalty
CREATE POLICY "loyalty_own_read" ON loyalty_transactions FOR SELECT
  USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- Admin-only for inventory, analytics, pricing_rules
CREATE POLICY "inventory_admin"       ON inventory       FOR ALL USING (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "analytics_admin"       ON analytics_logs  FOR ALL USING (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "pricing_rules_admin"   ON pricing_rules   FOR ALL USING (
  EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin')
);
