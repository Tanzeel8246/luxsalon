-- ============================================================
-- LuxSalon — Seed Data for Fresh Installation
-- Run AFTER all migrations have been applied.
-- ============================================================

-- ── Default Tenant ────────────────────────────────────────────────────────────
INSERT INTO tenants (name, slug, plan, status, owner_email, timezone, currency, tax_rate)
VALUES (
  'LuxSalon Main',
  'luxsalon-main',
  'professional',
  'active',
  'admin@luxsalon.com',
  'Asia/Karachi',
  'PKR',
  0.17
) ON CONFLICT (slug) DO NOTHING;

-- ── Service Categories & Services ────────────────────────────────────────────
DO $$
DECLARE v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'luxsalon-main';

  -- Hair Services
  INSERT INTO services (name, description, duration, base_price, category, required_skills, popularity, tenant_id)
  VALUES
    ('Premium Haircut & Style',    'Full haircut with styling and blow-dry',      45,  2500, 'Hair',   ARRAY['cutting','styling'],        100, v_tenant_id),
    ('Buzz Cut',                   'Short precision buzz cut',                    20,  800,  'Hair',   ARRAY['cutting'],                  80,  v_tenant_id),
    ('Crew Cut & Fade',            'Classic crew cut with gradient fade',         35,  1800, 'Hair',   ARRAY['cutting','fading'],         90,  v_tenant_id),
    ('Balayage Color',             'Hand-painted highlights for a natural look',  120, 8000, 'Color',  ARRAY['coloring','balayage'],      60,  v_tenant_id),
    ('Full Color Treatment',       'All-over hair color with developer',          90,  5000, 'Color',  ARRAY['coloring'],                 70,  v_tenant_id),
    ('Keratin Smoothing',          'Keratin treatment for frizz-free hair',       90,  9500, 'Treatment', ARRAY['coloring','treatment'], 50,  v_tenant_id),

    -- Beard Services
    ('Beard Trim & Shape',         'Precision beard trim and shaping',            25,  800,  'Beard',  ARRAY['beard'],                    95,  v_tenant_id),
    ('Royal Shave',                'Hot towel shave with razor finish',           40,  1500, 'Beard',  ARRAY['beard','shave'],            75,  v_tenant_id),
    ('Beard Oil Treatment',        'Deep conditioning beard oil massage',         20,  600,  'Beard',  ARRAY['beard'],                    65,  v_tenant_id),

    -- Skin & Facial Services
    ('Gold Facial Spa',            '24K gold facial with massage',                60,  4500, 'Facial', ARRAY['skincare'],                 55,  v_tenant_id),
    ('Deep Cleansing Facial',      'Pore cleansing and exfoliation treatment',    45,  2800, 'Facial', ARRAY['skincare'],                 60,  v_tenant_id),
    ('Scalp Detox Treatment',      'Scalp massage with detoxifying serum',        45,  2200, 'Scalp',  ARRAY['treatment','scalp'],        40,  v_tenant_id),

    -- Nail Services
    ('Manicure',                   'Classic manicure with polish',                45,  1200, 'Nails',  ARRAY['nails'],                    70,  v_tenant_id),
    ('Pedicure',                   'Classic pedicure with foot massage',          60,  1500, 'Nails',  ARRAY['nails'],                    65,  v_tenant_id),
    ('Nail Art',                   'Custom nail art designs',                     60,  2000, 'Nails',  ARRAY['nails','art'],              50,  v_tenant_id)
  ON CONFLICT DO NOTHING;

  -- Packages
  INSERT INTO packages (name, description, service_ids, discount_percentage, total_price, tenant_id)
  SELECT
    'The Works Package',
    'Haircut + Beard + Facial — Complete grooming experience',
    ARRAY(SELECT id FROM services WHERE name IN ('Premium Haircut & Style','Beard Trim & Shape','Deep Cleansing Facial') AND tenant_id = v_tenant_id LIMIT 3),
    15,
    6375,
    v_tenant_id
  WHERE NOT EXISTS (SELECT 1 FROM packages WHERE name = 'The Works Package' AND tenant_id = v_tenant_id);

  INSERT INTO packages (name, description, service_ids, discount_percentage, total_price, tenant_id)
  SELECT
    'Bridal Groom Package',
    'Full groom package for special occasions',
    ARRAY(SELECT id FROM services WHERE name IN ('Premium Haircut & Style','Royal Shave','Gold Facial Spa') AND tenant_id = v_tenant_id LIMIT 3),
    10,
    14850,
    v_tenant_id
  WHERE NOT EXISTS (SELECT 1 FROM packages WHERE name = 'Bridal Groom Package' AND tenant_id = v_tenant_id);

END;
$$;

-- ── Default Pricing Rules ─────────────────────────────────────────────────────
INSERT INTO pricing_rules (name, rule_type, multiplier, conditions, is_active)
VALUES
  ('Peak Hours Surcharge',  'peak_hours', 1.25, '{"hours": [10,11,12,17,18,19]}'::jsonb, true),
  ('High Demand Boost',     'demand',     1.15, '{"min_queue": 10}'::jsonb,               false),
  ('Weekend Premium',       'seasonal',   1.10, '{"days": [0,6]}'::jsonb,                 false),
  ('Gold Member Discount',  'loyalty',    0.90, '{"tiers": ["gold","platinum"]}'::jsonb,  true)
ON CONFLICT DO NOTHING;

-- ── Default Commission Rules ──────────────────────────────────────────────────
INSERT INTO commission_rules (rule_type, rate, priority, notes)
VALUES ('percentage', 0.30, 0, 'Global default — 30% commission on all services')
ON CONFLICT DO NOTHING;

-- ── Default Inventory Items ───────────────────────────────────────────────────
DO $$
DECLARE v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'luxsalon-main';

  INSERT INTO inventory (name, sku, category, quantity, unit, min_threshold, cost_per_unit, supplier, tenant_id)
  VALUES
    ('Moroccan Argan Oil',     'OIL-001', 'Oils',       500,  'ml',    100,  4.50,  'BeautyPro Supplies',  v_tenant_id),
    ('Keratin Treatment Pro',  'KER-001', 'Treatments', 300,  'ml',    80,   12.00, 'Salon Essentials',    v_tenant_id),
    ('Hair Color Developer',   'COL-001', 'Color',      2000, 'ml',    200,  2.10,  'ColorWorld Pakistan', v_tenant_id),
    ('Pomade Wax',             'WAX-001', 'Styling',    50,   'units', 20,   6.20,  'BeautyPro Supplies',  v_tenant_id),
    ('Beard Oil Classic',      'BOI-001', 'Beard',      200,  'ml',    50,   3.80,  'BeautyPro Supplies',  v_tenant_id),
    ('Shaving Cream Premium',  'SHA-001', 'Beard',      10,   'units', 5,    8.50,  'Salon Essentials',    v_tenant_id),
    ('Disposable Towels',      'TOW-001', 'Consumables',1000, 'pcs',   200,  0.15,  'Consumables Direct',  v_tenant_id),
    ('Disposable Gloves',      'GLV-001', 'Safety',     500,  'pairs', 100,  0.20,  'Consumables Direct',  v_tenant_id),
    ('Facial Mask Gold',       'MSK-001', 'Skincare',   50,   'units', 15,   15.00, 'BeautyPro Supplies',  v_tenant_id),
    ('Nail Polish (Set)',       'NAL-001', 'Nails',      20,   'sets',  5,    12.00, 'Salon Essentials',    v_tenant_id)
  ON CONFLICT (sku) DO NOTHING;

END;
$$;

-- ── Default Checklists ────────────────────────────────────────────────────────
DO $$
DECLARE
  v_opening_id UUID;
  v_closing_id UUID;
  v_service_id UUID;
  v_tenant_id  UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'luxsalon-main';

  INSERT INTO checklists (name, type, is_active, frequency, tenant_id)
  VALUES ('Morning Opening Checklist', 'opening', true, 'daily', v_tenant_id)
  RETURNING id INTO v_opening_id;

  IF v_opening_id IS NOT NULL THEN
    INSERT INTO checklist_items (checklist_id, item, order_index, is_critical)
    VALUES
      (v_opening_id, 'Unlock salon and disable alarm',            1, true),
      (v_opening_id, 'Switch on all lights and A/C',              2, false),
      (v_opening_id, 'Check and restock towels and capes',        3, false),
      (v_opening_id, 'Sanitize all styling chairs and tools',     4, true),
      (v_opening_id, 'Check product inventory and flag low items',5, false),
      (v_opening_id, 'Turn on POS system and verify cash float',  6, true),
      (v_opening_id, 'Review today''s appointment schedule',      7, false),
      (v_opening_id, 'Brief staff on any special requirements',   8, false);
  END IF;

  INSERT INTO checklists (name, type, is_active, frequency, tenant_id)
  VALUES ('Evening Closing Checklist', 'closing', true, 'daily', v_tenant_id)
  RETURNING id INTO v_closing_id;

  IF v_closing_id IS NOT NULL THEN
    INSERT INTO checklist_items (checklist_id, item, order_index, is_critical)
    VALUES
      (v_closing_id, 'Process end-of-day POS report',            1, true),
      (v_closing_id, 'Count and reconcile cash drawer',           2, true),
      (v_closing_id, 'Clean and sanitize all work stations',      3, false),
      (v_closing_id, 'Dispose of single-use items',               4, false),
      (v_closing_id, 'Store all chemicals and products safely',   5, true),
      (v_closing_id, 'Check all electrical equipment is off',     6, true),
      (v_closing_id, 'Lock all cabinets and storage areas',       7, false),
      (v_closing_id, 'Set alarm and lock up',                     8, true);
  END IF;

END;
$$;

-- ── Default Cancellation Policy ───────────────────────────────────────────────
DO $$
DECLARE v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'luxsalon-main';
  INSERT INTO cancellation_policies (tenant_id, name, notice_hours, fee_percentage, no_show_fee_pct, deposit_required)
  VALUES (v_tenant_id, 'Standard Policy', 24, 50, 100, false)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── Default WhatsApp Templates ────────────────────────────────────────────────
INSERT INTO whatsapp_templates (name, category, template, variables, is_approved, language)
VALUES
  ('booking_confirmation', 'booking',
   'Hello {{1}}, your {{2}} is confirmed for {{3}} at {{4}} with {{5}}. Total: {{6}}. Booking ID: {{7}}',
   ARRAY['name','service','date','time','staff','amount','booking_id'], false, 'en'),
  ('appointment_reminder', 'reminder',
   'Reminder: Hi {{1}}, your {{2}} appointment is tomorrow {{3}} at {{4}} with {{5}} at {{6}}. Reply CANCEL to cancel.',
   ARRAY['name','service','date','time','staff','salon'], false, 'en'),
  ('queue_ready', 'queue',
   'Your turn is coming! Hi {{1}}, you are #{{2}} in queue at {{3}}. Please come to the desk within 5 minutes.',
   ARRAY['name','position','salon'], false, 'en'),
  ('payment_receipt', 'booking',
   'Payment confirmed! Hi {{1}}, we received {{2}} for {{3}}. Receipt #{{4}} dated {{5}}. Thank you!',
   ARRAY['name','amount','service','receipt_no','date'], false, 'en'),
  ('churn_winback', 'promotion',
   'We miss you! Hi {{1}}, enjoy {{2}} OFF your next visit. Code: {{3}} (valid until {{4}}). Book now!',
   ARRAY['name','discount','code','expiry'], false, 'en')
ON CONFLICT (name) DO NOTHING;

-- ── Default KPI Targets ───────────────────────────────────────────────────────
INSERT INTO kpi_targets (metric_name, target_value, period)
VALUES
  ('daily_revenue',      50000, 'daily'),
  ('daily_appointments', 40,    'daily'),
  ('avg_ticket',         1250,  'daily'),
  ('new_customers',      5,     'daily')
ON CONFLICT DO NOTHING;

-- ── Default Training Modules ──────────────────────────────────────────────────
INSERT INTO training_modules (title, description, category, content_type, duration_mins, passing_score, is_mandatory, order_index)
VALUES
  ('Staff Onboarding',         'Welcome to LuxSalon! Policies, culture, and systems.',  'onboarding',       'mixed',    60,  70, true, 1),
  ('Chemical Safety & COSHH',  'Safe handling of salon chemicals and products.',         'safety',           'document', 45,  80, true, 2),
  ('Customer Service Excellence', 'Creating the luxury client experience.',               'customer_service', 'video',    30,  75, true, 3),
  ('Advanced Cutting Techniques', 'Modern haircut methods and tools.',                    'skills',           'practical',90,  70, false, 4),
  ('Color Theory & Application',  'Color wheel, developers, and application.',            'skills',           'mixed',    120, 70, false, 5),
  ('POS System Training',      'Using the LuxSalon POS terminal.',                      'compliance',       'video',    20,  90, true, 6),
  ('GDPR & Data Privacy',      'Customer data protection and compliance.',               'compliance',       'document', 30,  80, true, 7),
  ('Product Knowledge',        'Retail products we sell and their benefits.',            'product',          'video',    25,  70, false, 8)
ON CONFLICT DO NOTHING;

-- ── Confirm seed completed ────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ LuxSalon seed data applied successfully';
  RAISE NOTICE 'Services: %',   (SELECT COUNT(*) FROM services);
  RAISE NOTICE 'Packages: %',   (SELECT COUNT(*) FROM packages);
  RAISE NOTICE 'Inventory: %',  (SELECT COUNT(*) FROM inventory);
  RAISE NOTICE 'Templates: %',  (SELECT COUNT(*) FROM whatsapp_templates);
  RAISE NOTICE 'Training: %',   (SELECT COUNT(*) FROM training_modules);
END;
$$;
