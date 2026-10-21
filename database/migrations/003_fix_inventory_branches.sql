-- ============================================================
-- Migration: 003_fix_inventory_branches
-- Fixes multi-branch inventory isolation
-- Adds inventory_movements audit trail
-- ============================================================

-- Ensure all inventory has branch_id (make non-nullable with default)
-- First set a default branch for existing records
DO $$
DECLARE v_default_branch UUID;
BEGIN
  SELECT id INTO v_default_branch FROM branches LIMIT 1;
  IF v_default_branch IS NOT NULL THEN
    UPDATE inventory SET branch_id = v_default_branch WHERE branch_id IS NULL;
  END IF;
END;
$$;

-- ─── Inventory Movements (full audit trail) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id   UUID REFERENCES inventory(id) ON DELETE CASCADE NOT NULL,
  branch_id      UUID REFERENCES branches(id) ON DELETE SET NULL,
  movement_type  VARCHAR(20) NOT NULL CHECK (movement_type IN (
    'restock',        -- received from supplier/transfer
    'service_use',    -- consumed by completed service
    'sale',           -- sold as retail product
    'wastage',        -- recorded as waste
    'adjustment',     -- manual stock correction
    'transfer_out',   -- sent to another branch
    'transfer_in',    -- received from another branch
    'expiry_disposal' -- disposed expired stock
  )),
  quantity_before DECIMAL(10,2) NOT NULL,
  quantity_change DECIMAL(10,2) NOT NULL,   -- negative = reduction
  quantity_after  DECIMAL(10,2) NOT NULL,
  reference_id    UUID,                      -- appointment_id, po_id, transfer_id, etc.
  reference_type  VARCHAR(50),               -- 'appointment', 'purchase_order', 'manual'
  performed_by    UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_movements_inventory ON inventory_movements(inventory_id, created_at DESC);
CREATE INDEX idx_inv_movements_branch    ON inventory_movements(branch_id, created_at DESC);
CREATE INDEX idx_inv_movements_type      ON inventory_movements(movement_type);

-- ─── Fix inventory trigger: branch-aware service deduction ───────────────────
CREATE OR REPLACE FUNCTION fn_reduce_inventory_after_service()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_item inventory%ROWTYPE;
  v_qty_before DECIMAL;
  v_qty_after  DECIMAL;
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN

    FOR v_item IN
      SELECT i.*
      FROM inventory i
      JOIN service_inventory si ON si.inventory_id = i.id
      WHERE si.service_id = NEW.service_id
        AND (
          -- Branch-specific stock first; fallback to unassigned
          i.branch_id = NEW.branch_id
          OR (i.branch_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM inventory i2
            JOIN service_inventory si2 ON si2.inventory_id = i2.id
            WHERE si2.service_id = NEW.service_id
              AND i2.branch_id = NEW.branch_id
          ))
        )
    LOOP
      DECLARE
        v_qty_used DECIMAL;
      BEGIN
        SELECT quantity_used INTO v_qty_used
        FROM service_inventory
        WHERE service_id = NEW.service_id AND inventory_id = v_item.id;

        v_qty_before := v_item.quantity;
        v_qty_after  := GREATEST(0, v_item.quantity - v_qty_used);

        -- Update inventory
        UPDATE inventory
        SET quantity   = v_qty_after,
            updated_at = NOW()
        WHERE id = v_item.id;

        -- Record movement
        INSERT INTO inventory_movements (
          inventory_id, branch_id, movement_type,
          quantity_before, quantity_change, quantity_after,
          reference_id, reference_type, performed_by, notes
        ) VALUES (
          v_item.id, NEW.branch_id, 'service_use',
          v_qty_before, -v_qty_used, v_qty_after,
          NEW.id, 'appointment', NEW.staff_id,
          'Auto-deducted on service completion'
        );
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace old trigger
DROP TRIGGER IF EXISTS trg_reduce_inventory ON appointments;
CREATE TRIGGER trg_reduce_inventory
AFTER UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION fn_reduce_inventory_after_service();

-- ─── Helper: record manual adjustment ────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_adjust_inventory(
  p_inventory_id UUID,
  p_branch_id    UUID,
  p_quantity     DECIMAL,
  p_type         VARCHAR(20),
  p_performed_by UUID,
  p_notes        TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_before DECIMAL;
BEGIN
  SELECT quantity INTO v_before FROM inventory WHERE id = p_inventory_id;

  UPDATE inventory
  SET quantity   = GREATEST(0, quantity + p_quantity),
      updated_at = NOW()
  WHERE id = p_inventory_id;

  INSERT INTO inventory_movements (
    inventory_id, branch_id, movement_type,
    quantity_before, quantity_change, quantity_after,
    reference_id, reference_type, performed_by, notes
  ) VALUES (
    p_inventory_id, p_branch_id, p_type,
    v_before, p_quantity, GREATEST(0, v_before + p_quantity),
    p_reference_id, 'manual', p_performed_by, p_notes
  );
END;
$$;

-- ─── RLS for inventory_movements ─────────────────────────────────────────────
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movements_staff_read" ON inventory_movements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

CREATE POLICY "movements_admin_write" ON inventory_movements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin','staff'))
  );

-- ─── Rollback ─────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS inventory_movements CASCADE;
-- DROP FUNCTION IF EXISTS fn_reduce_inventory_after_service CASCADE;
-- DROP FUNCTION IF EXISTS fn_adjust_inventory CASCADE;
