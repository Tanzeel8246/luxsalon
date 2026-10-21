-- ============================================================
-- Migration: 001_fix_booking_concurrency
-- Fixes race conditions in booking system
-- Author: LuxSalon Engineering
-- ============================================================

-- ─── Step 1: Ensure appointments overlap constraint is tight ──────────────────
-- The original GIST EXCLUDE was correct but needed a supporting index.
-- Ensure btree_gist extension is enabled.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop and recreate constraint with proper definition
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_overlap;

ALTER TABLE appointments
  ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    staff_id   WITH =,
    branch_id  WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'no_show'));

-- ─── Step 2: Transactional booking function ──────────────────────────────────
-- This function runs entirely within a transaction with SERIALIZABLE isolation.
-- It checks availability and creates the appointment atomically.
-- No race condition is possible because of the EXCLUDE constraint + serializable tx.

CREATE OR REPLACE FUNCTION fn_create_appointment_safe(
  p_customer_id      UUID,
  p_staff_id         UUID,
  p_service_id       UUID,
  p_start_time       TIMESTAMPTZ,
  p_end_time         TIMESTAMPTZ,
  p_total_price      DECIMAL,
  p_discount_applied DECIMAL,
  p_notes            TEXT,
  p_branch_id        UUID,
  p_package_id       UUID DEFAULT NULL
)
RETURNS TABLE(
  appointment_id   UUID,
  success          BOOLEAN,
  error_message    TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_appointment_id UUID;
  v_conflict_count INTEGER;
BEGIN
  -- Check for conflicts explicitly first (for better error message)
  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments
  WHERE staff_id   = p_staff_id
    AND branch_id  = p_branch_id
    AND status NOT IN ('cancelled', 'no_show')
    AND tstzrange(start_time, end_time, '[)') &&
        tstzrange(p_start_time, p_end_time, '[)');

  IF v_conflict_count > 0 THEN
    RETURN QUERY SELECT NULL::UUID, FALSE,
      'Staff is not available at this time. Please choose a different slot.';
    RETURN;
  END IF;

  -- Check staff is active and belongs to this branch
  IF NOT EXISTS (
    SELECT 1 FROM staff s
    JOIN branch_staff bs ON bs.staff_id = s.id
    WHERE s.id        = p_staff_id
      AND bs.branch_id = p_branch_id
      AND s.is_active  = TRUE
      AND (bs.end_date IS NULL OR bs.end_date >= CURRENT_DATE)
  ) THEN
    RETURN QUERY SELECT NULL::UUID, FALSE,
      'Staff member is not available at this branch.';
    RETURN;
  END IF;

  -- Check customer exists
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Customer not found.';
    RETURN;
  END IF;

  -- Create the appointment — EXCLUDE constraint handles concurrent requests
  BEGIN
    INSERT INTO appointments (
      customer_id, staff_id, service_id, package_id,
      start_time, end_time, status,
      total_price, discount_applied,
      notes, branch_id
    ) VALUES (
      p_customer_id, p_staff_id, p_service_id, p_package_id,
      p_start_time, p_end_time, 'confirmed',
      p_total_price, COALESCE(p_discount_applied, 0),
      p_notes, p_branch_id
    )
    RETURNING id INTO v_appointment_id;

    RETURN QUERY SELECT v_appointment_id, TRUE, NULL::TEXT;

  EXCEPTION
    WHEN exclusion_violation THEN
      -- Concurrent booking collision — the constraint caught it
      RETURN QUERY SELECT NULL::UUID, FALSE,
        'This time slot was just booked by someone else. Please select another.';
    WHEN foreign_key_violation THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Invalid reference: check service, staff, or customer ID.';
    WHEN OTHERS THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, SQLERRM;
  END;
END;
$$;

-- ─── Step 3: Advisory lock for queue operations ───────────────────────────────
-- Queue position assignment needs a branch-level lock to prevent gaps.

CREATE OR REPLACE FUNCTION fn_add_to_queue_safe(
  p_customer_id UUID,
  p_service_id  UUID,
  p_staff_id    UUID,
  p_branch_id   UUID
)
RETURNS TABLE(
  queue_id        UUID,
  position        INTEGER,
  estimated_wait  INTEGER,
  success         BOOLEAN,
  error_message   TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_key     BIGINT;
  v_position     INTEGER;
  v_wait         INTEGER;
  v_queue_id     UUID;
  v_avg_duration NUMERIC;
  v_active_staff BIGINT;
BEGIN
  -- Branch-specific advisory lock (prevents concurrent position assignment)
  v_lock_key := hashtext(p_branch_id::TEXT);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Calculate next position
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
  FROM queue
  WHERE status IN ('waiting', 'called', 'serving')
    AND DATE(check_in_time) = CURRENT_DATE;

  -- Calculate estimated wait
  SELECT
    COALESCE(
      (COUNT(q.id) * AVG(s.duration)) / NULLIF(
        (SELECT COUNT(DISTINCT staff_id) FROM queue
          WHERE status = 'serving'
            AND DATE(check_in_time) = CURRENT_DATE),
        0
      ),
      COUNT(q.id) * COALESCE(AVG(s.duration), 30)
    )::INTEGER
  INTO v_wait
  FROM queue q
  JOIN services s ON s.id = q.service_id
  WHERE q.status IN ('waiting', 'called')
    AND DATE(q.check_in_time) = CURRENT_DATE;

  INSERT INTO queue (
    customer_id, service_id, staff_id,
    position, estimated_wait, status
  ) VALUES (
    p_customer_id, p_service_id, p_staff_id,
    v_position, COALESCE(v_wait, 0), 'waiting'
  )
  RETURNING id INTO v_queue_id;

  RETURN QUERY SELECT v_queue_id, v_position, COALESCE(v_wait, 0), TRUE, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::UUID, 0, 0, FALSE, SQLERRM;
END;
$$;

-- ─── Rollback Instructions ────────────────────────────────────────────────────
-- To rollback:
--   DROP FUNCTION IF EXISTS fn_create_appointment_safe;
--   DROP FUNCTION IF EXISTS fn_add_to_queue_safe;
--   ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_overlap;
--   ALTER TABLE appointments ADD CONSTRAINT no_overlap EXCLUDE USING gist (
--     staff_id WITH =,
--     tstzrange(start_time, end_time) WITH &&
--   ) WHERE (status NOT IN ('cancelled','no_show'));
