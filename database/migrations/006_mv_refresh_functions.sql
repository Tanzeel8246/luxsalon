-- ============================================================
-- Migration: 006_mv_refresh_functions
-- Fixes materialized views that were never being refreshed.
-- Adds proper refresh functions called by scheduler.
-- ============================================================

-- ── Refresh functions called by lib/scheduler.ts ──────────────────────────────

CREATE OR REPLACE FUNCTION refresh_mv_daily_revenue()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_revenue;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't fail — non-critical
  RAISE NOTICE 'mv_daily_revenue refresh failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_mv_service_profitability()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_profitability;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'mv_service_profitability refresh failed: %', SQLERRM;
END;
$$;

-- ── Fix: mv_daily_revenue — ensure UNIQUE index exists for CONCURRENTLY ────────
-- Without this, REFRESH MATERIALIZED VIEW CONCURRENTLY fails
DO $$
BEGIN
  -- Only create if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'mv_daily_revenue' AND indexname = 'mv_daily_revenue_day_idx'
  ) THEN
    CREATE UNIQUE INDEX mv_daily_revenue_day_idx ON mv_daily_revenue(day);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'mv_service_profitability' AND indexname = 'mv_service_profitability_id_idx'
  ) THEN
    CREATE UNIQUE INDEX mv_service_profitability_id_idx ON mv_service_profitability(id);
  END IF;
END;
$$;

-- ── Customer LTV view (fix — was function, now MV for performance) ────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_customer_ltv AS
SELECT
  c.id                                              AS customer_id,
  c.name,
  c.tier,
  COALESCE(SUM(a.total_price), 0)                  AS total_spent,
  COUNT(a.id)                                       AS total_visits,
  COALESCE(AVG(a.total_price), 0)                  AS avg_order_value,
  CASE
    WHEN COUNT(a.id) > 1 THEN
      EXTRACT(EPOCH FROM (MAX(a.start_time) - MIN(a.start_time))) / 86400 / (COUNT(a.id) - 1)
    ELSE NULL
  END                                               AS avg_days_between_visits,
  CASE
    WHEN COUNT(a.id) >= 10 AND SUM(a.total_price) >= 1000 THEN 'champion'
    WHEN COUNT(a.id) >= 5                                  THEN 'loyal'
    WHEN EXTRACT(EPOCH FROM (NOW() - MAX(a.start_time))) / 86400 > 60 THEN 'at_risk'
    WHEN COUNT(a.id) = 0                                   THEN 'lost'
    ELSE 'new'
  END                                               AS clv_segment,
  MAX(a.start_time)                                 AS last_visit,
  NOW()                                             AS calculated_at
FROM customers c
LEFT JOIN appointments a ON a.customer_id = c.id AND a.status = 'completed'
GROUP BY c.id, c.name, c.tier
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_customer_ltv_cust_idx ON mv_customer_ltv(customer_id);

CREATE OR REPLACE FUNCTION refresh_mv_customer_ltv()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_ltv;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'mv_customer_ltv refresh failed: %', SQLERRM;
END;
$$;

-- ── Hourly revenue snapshot trigger ──────────────────────────────────────────
-- Insert/update revenue_snapshots every time an appointment is completed
CREATE OR REPLACE FUNCTION fn_update_revenue_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_hour INTEGER;
  v_date DATE;
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    v_date := DATE(NEW.start_time);
    v_hour := EXTRACT(HOUR FROM NEW.start_time)::INTEGER;

    INSERT INTO revenue_snapshots (
      snapshot_date, snapshot_hour, total_revenue, appointments, branch_id
    ) VALUES (
      v_date, v_hour, NEW.total_price, 1, NEW.branch_id
    )
    ON CONFLICT (snapshot_date, snapshot_hour, branch_id) DO UPDATE SET
      total_revenue  = revenue_snapshots.total_revenue + NEW.total_price,
      appointments   = revenue_snapshots.appointments + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revenue_snapshot ON appointments;
CREATE TRIGGER trg_revenue_snapshot
AFTER UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION fn_update_revenue_snapshot();

-- ── Grant execute on refresh functions ───────────────────────────────────────
-- Supabase service role can call these
GRANT EXECUTE ON FUNCTION refresh_mv_daily_revenue()        TO service_role;
GRANT EXECUTE ON FUNCTION refresh_mv_service_profitability() TO service_role;
GRANT EXECUTE ON FUNCTION refresh_mv_customer_ltv()          TO service_role;
