-- ============================================================
-- LuxSalon V3 — Schema Extension (Modules 6-10)
-- ============================================================

-- ─────────────────────────────────────────
-- MODULE 6: CUSTOMER EXPERIENCE
-- ─────────────────────────────────────────

CREATE TABLE waitlist (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id    UUID REFERENCES customers(id) ON DELETE CASCADE,
  service_id     UUID REFERENCES services(id) ON DELETE CASCADE,
  preferred_date DATE,
  preferred_time_start TIME,
  preferred_time_end   TIME,
  staff_id       UUID REFERENCES staff(id) ON DELETE SET NULL,
  status         VARCHAR(15) DEFAULT 'waiting' CHECK (status IN ('waiting','notified','booked','expired','cancelled')),
  notify_via     VARCHAR(20) DEFAULT 'whatsapp' CHECK (notify_via IN ('whatsapp','sms','email','push')),
  notified_at    TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE virtual_tryon_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  UUID REFERENCES customers(id) ON DELETE CASCADE,
  image_url    TEXT,
  style_applied VARCHAR(100),
  color_applied VARCHAR(100),
  result_url   TEXT,
  saved        BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public_booking_links (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug         VARCHAR(100) UNIQUE NOT NULL,
  salon_name   VARCHAR(255),
  branch_id    UUID,
  is_active    BOOLEAN DEFAULT true,
  custom_css   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kiosk_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  queue_position INTEGER,
  screen_language VARCHAR(5) DEFAULT 'en',
  completed    BOOLEAN DEFAULT false
);

-- ─────────────────────────────────────────
-- MODULE 7: MULTI-BRANCH MANAGEMENT
-- ─────────────────────────────────────────

CREATE TABLE branches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  address       TEXT,
  city          VARCHAR(100),
  phone         VARCHAR(30),
  email         VARCHAR(255),
  manager_id    UUID REFERENCES staff(id) ON DELETE SET NULL,
  timezone      VARCHAR(50) DEFAULT 'UTC',
  open_time     TIME DEFAULT '09:00',
  close_time    TIME DEFAULT '20:00',
  is_active     BOOLEAN DEFAULT true,
  is_franchise  BOOLEAN DEFAULT false,
  royalty_rate  DECIMAL(5,3) DEFAULT 0,
  logo_url      TEXT,
  lat           DECIMAL(10,7),
  lng           DECIMAL(10,7),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE branch_staff (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID REFERENCES branches(id) ON DELETE CASCADE,
  staff_id    UUID REFERENCES staff(id) ON DELETE CASCADE,
  is_primary  BOOLEAN DEFAULT true,
  start_date  DATE DEFAULT CURRENT_DATE,
  end_date    DATE,
  UNIQUE (branch_id, staff_id)
);

CREATE TABLE inventory_transfers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_branch_id  UUID REFERENCES branches(id) ON DELETE CASCADE,
  to_branch_id    UUID REFERENCES branches(id) ON DELETE CASCADE,
  inventory_id    UUID REFERENCES inventory(id) ON DELETE CASCADE,
  quantity        DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  status          VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending','approved','in_transit','completed','cancelled')),
  requested_by    UUID REFERENCES staff(id) ON DELETE SET NULL,
  approved_by     UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE franchise_royalties (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id    UUID REFERENCES branches(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  gross_revenue DECIMAL(12,2) NOT NULL,
  royalty_rate  DECIMAL(5,3) NOT NULL,
  royalty_amount DECIMAL(10,2) NOT NULL,
  status        VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending','invoiced','paid')),
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE staff        ADD COLUMN IF NOT EXISTS primary_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE inventory    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────
-- MODULE 8: SECURITY & COMPLIANCE
-- ─────────────────────────────────────────

CREATE TABLE two_factor_auth (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  method       VARCHAR(10) CHECK (method IN ('totp','sms','email')),
  secret       TEXT,
  backup_codes TEXT[],
  is_enabled   BOOLEAN DEFAULT false,
  last_used    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action       VARCHAR(100) NOT NULL,
  resource     VARCHAR(100),
  resource_id  UUID,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   INET,
  user_agent   TEXT,
  branch_id    UUID,
  severity     VARCHAR(10) DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gdpr_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  UUID REFERENCES customers(id) ON DELETE CASCADE,
  request_type VARCHAR(20) CHECK (request_type IN ('export','delete','rectify','restrict')),
  status       VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected')),
  notes        TEXT,
  processed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ip_whitelist (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address   INET NOT NULL UNIQUE,
  label        VARCHAR(100),
  added_by     UUID REFERENCES staff(id) ON DELETE SET NULL,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE suspicious_activities (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address   INET,
  activity     VARCHAR(100) NOT NULL,
  risk_score   DECIMAL(3,2) DEFAULT 0,
  is_blocked   BOOLEAN DEFAULT false,
  details      JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  ip_address   INET,
  user_agent   TEXT,
  last_active  TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  is_revoked   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto audit trigger function
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_logs(action, resource, resource_id, old_data, new_data, severity)
  VALUES (
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) END,
    CASE WHEN TG_OP = 'DELETE' THEN 'warning' ELSE 'info' END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply audit to sensitive tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['appointments','customers','staff','inventory','pricing_rules','staff_payroll']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION fn_audit_log()',
      t, t
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────
-- MODULE 9: ADVANCED SCHEDULING
-- ─────────────────────────────────────────

CREATE TABLE recurring_appointments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id    UUID REFERENCES customers(id) ON DELETE CASCADE,
  service_id     UUID REFERENCES services(id) ON DELETE CASCADE,
  staff_id       UUID REFERENCES staff(id) ON DELETE SET NULL,
  frequency      VARCHAR(15) CHECK (frequency IN ('weekly','biweekly','monthly','custom')),
  interval_days  INTEGER,
  day_of_week    INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  preferred_time TIME,
  start_date     DATE NOT NULL,
  end_date       DATE,
  occurrences    INTEGER,
  completed_count INTEGER DEFAULT 0,
  is_active      BOOLEAN DEFAULT true,
  last_created   DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE group_bookings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id   UUID REFERENCES customers(id) ON DELETE CASCADE,
  service_id     UUID REFERENCES services(id) ON DELETE CASCADE,
  package_id     UUID REFERENCES packages(id) ON DELETE SET NULL,
  name           VARCHAR(255),
  event_type     VARCHAR(50) DEFAULT 'group' CHECK (event_type IN ('group','bridal','corporate','birthday','event')),
  date           DATE NOT NULL,
  time           TIME NOT NULL,
  guest_count    INTEGER NOT NULL CHECK (guest_count > 0),
  status         VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled')),
  total_price    DECIMAL(10,2),
  deposit_paid   DECIMAL(10,2) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE group_booking_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_booking_id UUID REFERENCES group_bookings(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  guest_name      VARCHAR(255),
  service_id      UUID REFERENCES services(id) ON DELETE CASCADE,
  staff_id        UUID REFERENCES staff(id) ON DELETE SET NULL,
  status          VARCHAR(15) DEFAULT 'pending'
);

CREATE TABLE resources (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id    UUID REFERENCES branches(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  type         VARCHAR(30) CHECK (type IN ('chair','basin','room','station','equipment')),
  capacity     INTEGER DEFAULT 1,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resource_bookings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id  UUID REFERENCES resources(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  EXCLUDE USING gist(
    resource_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
);

CREATE TABLE staff_leaves (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id     UUID REFERENCES staff(id) ON DELETE CASCADE,
  leave_type   VARCHAR(20) CHECK (leave_type IN ('annual','sick','emergency','unpaid','maternity','paternity')),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  reason       TEXT,
  status       VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by  UUID REFERENCES staff(id) ON DELETE SET NULL,
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_shifts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id     UUID REFERENCES staff(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES branches(id) ON DELETE SET NULL,
  date         DATE NOT NULL,
  shift_type   VARCHAR(10) CHECK (shift_type IN ('morning','evening','full','off')),
  start_time   TIME,
  end_time     TIME,
  swap_with    UUID REFERENCES staff(id) ON DELETE SET NULL,
  swap_status  VARCHAR(10) DEFAULT 'none' CHECK (swap_status IN ('none','requested','approved','rejected')),
  overtime_hours DECIMAL(4,2) DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, date)
);

CREATE TABLE holiday_calendar (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(255) NOT NULL,
  date         DATE NOT NULL,
  branch_id    UUID REFERENCES branches(id) ON DELETE CASCADE,
  is_closed    BOOLEAN DEFAULT true,
  custom_hours JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- MODULE 10: ADVANCED INVENTORY
-- ─────────────────────────────────────────

CREATE TABLE suppliers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(255) NOT NULL,
  contact_name   VARCHAR(255),
  email          VARCHAR(255),
  phone          VARCHAR(30),
  address        TEXT,
  payment_terms  VARCHAR(50),
  rating         DECIMAL(3,2) DEFAULT 5.0,
  total_orders   INTEGER DEFAULT 0,
  is_active      BOOLEAN DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS barcode    VARCHAR(100) UNIQUE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS reorder_point DECIMAL(10,2);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS max_stock DECIMAL(10,2);

CREATE TABLE purchase_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number       VARCHAR(50) UNIQUE NOT NULL,
  supplier_id     UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  branch_id       UUID REFERENCES branches(id) ON DELETE SET NULL,
  status          VARCHAR(15) DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','partial','received','cancelled')),
  order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date   DATE,
  received_date   DATE,
  subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_status  VARCHAR(15) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  notes           TEXT,
  created_by      UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id           UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_id    UUID REFERENCES inventory(id) ON DELETE CASCADE,
  quantity_ordered DECIMAL(10,2) NOT NULL,
  quantity_received DECIMAL(10,2) DEFAULT 0,
  unit_price      DECIMAL(10,2) NOT NULL,
  total           DECIMAL(10,2) NOT NULL
);

CREATE TABLE inventory_expiry (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id    UUID REFERENCES inventory(id) ON DELETE CASCADE,
  batch_number    VARCHAR(100),
  quantity        DECIMAL(10,2) NOT NULL,
  expiry_date     DATE NOT NULL,
  status          VARCHAR(15) DEFAULT 'active' CHECK (status IN ('active','expiring_soon','expired','disposed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_wastage (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  staff_id     UUID REFERENCES staff(id) ON DELETE SET NULL,
  quantity     DECIMAL(10,2) NOT NULL,
  reason       VARCHAR(100) CHECK (reason IN ('spilled','expired','damaged','over_use','other')),
  notes        TEXT,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE retail_products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  retail_price DECIMAL(10,2) NOT NULL,
  cost_price   DECIMAL(10,2) NOT NULL,
  margin_pct   DECIMAL(5,2) GENERATED ALWAYS AS
               (ROUND(((retail_price - cost_price) / NULLIF(retail_price,0) * 100)::NUMERIC, 2)) STORED,
  barcode      VARCHAR(100) UNIQUE,
  image_url    TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE retail_sales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID REFERENCES retail_products(id) ON DELETE CASCADE,
  transaction_id  UUID REFERENCES pos_transactions(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  staff_id        UUID REFERENCES staff(id) ON DELETE SET NULL,
  quantity        DECIMAL(10,2) NOT NULL,
  unit_price      DECIMAL(10,2) NOT NULL,
  total           DECIMAL(10,2) NOT NULL,
  commission_pct  DECIMAL(5,2) DEFAULT 10,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE barcode_scans (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode      VARCHAR(100) NOT NULL,
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  action       VARCHAR(20) CHECK (action IN ('restock','deduct','check','sale')),
  quantity     DECIMAL(10,2),
  scanned_by   UUID REFERENCES staff(id) ON DELETE SET NULL,
  scanned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PO number sequence
CREATE SEQUENCE IF NOT EXISTS po_seq START 1;
CREATE OR REPLACE FUNCTION fn_generate_po_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := 'PO-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(NEXTVAL('po_seq')::TEXT,5,'0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_po_number BEFORE INSERT ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION fn_generate_po_number();

-- Auto purchase order when stock hits reorder point
CREATE OR REPLACE FUNCTION fn_auto_purchase_order()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quantity <= COALESCE(NEW.reorder_point, NEW.min_threshold)
     AND (OLD.quantity > COALESCE(OLD.reorder_point, OLD.min_threshold) OR OLD.quantity IS NULL)
     AND NEW.supplier_id IS NOT NULL THEN
    INSERT INTO purchase_orders(supplier_id, branch_id, status, order_date,
                                 expected_date, subtotal, tax_amount, total)
    VALUES (NEW.supplier_id, NEW.branch_id, 'draft', CURRENT_DATE,
            CURRENT_DATE + INTERVAL '7 days', 0, 0, 0);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_auto_po
AFTER UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION fn_auto_purchase_order();

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX idx_branches_slug       ON branches(slug);
CREATE INDEX idx_branch_staff        ON branch_staff(branch_id, staff_id);
CREATE INDEX idx_audit_user          ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_resource      ON audit_logs(resource, resource_id);
CREATE INDEX idx_audit_severity      ON audit_logs(severity);
CREATE INDEX idx_recurring_customer  ON recurring_appointments(customer_id);
CREATE INDEX idx_group_booking_date  ON group_bookings(date);
CREATE INDEX idx_staff_leaves        ON staff_leaves(staff_id, start_date);
CREATE INDEX idx_staff_shifts        ON staff_shifts(staff_id, date);
CREATE INDEX idx_holiday             ON holiday_calendar(date, branch_id);
CREATE INDEX idx_suppliers_name      ON suppliers(name);
CREATE INDEX idx_po_status           ON purchase_orders(status);
CREATE INDEX idx_po_supplier         ON purchase_orders(supplier_id);
CREATE INDEX idx_expiry_date         ON inventory_expiry(expiry_date);
CREATE INDEX idx_wastage_staff       ON inventory_wastage(staff_id);
CREATE INDEX idx_retail_product      ON retail_products(inventory_id);
CREATE INDEX idx_waitlist_service    ON waitlist(service_id, status);
CREATE INDEX idx_barcode             ON inventory(barcode);

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────
ALTER TABLE branches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_staff          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leaves          ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_shifts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist              ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_public"       ON branches          FOR SELECT USING (is_active = true);
CREATE POLICY "audit_admin"           ON audit_logs        FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "gdpr_own"              ON gdpr_requests     FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "recurring_own"         ON recurring_appointments FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "group_own"             ON group_bookings    FOR SELECT USING (organizer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "leaves_own"            ON staff_leaves      FOR ALL USING (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));
CREATE POLICY "shifts_own"            ON staff_shifts      FOR SELECT USING (staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));
CREATE POLICY "po_staff"              ON purchase_orders   FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin','staff')));
CREATE POLICY "suppliers_staff"       ON suppliers         FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin','staff')));
CREATE POLICY "retail_public"         ON retail_products   FOR SELECT USING (is_active = true);
CREATE POLICY "waitlist_own"          ON waitlist          FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
