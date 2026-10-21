// ── Module 6: Customer Experience ────────────────────────────
export interface Waitlist {
  id:                  string
  customer_id:         string
  service_id:          string
  preferred_date:      string | null
  preferred_time_start: string | null
  preferred_time_end:   string | null
  staff_id:            string | null
  status:              'waiting' | 'notified' | 'booked' | 'expired' | 'cancelled'
  notify_via:          'whatsapp' | 'sms' | 'email' | 'push'
  notified_at:         string | null
  expires_at:          string
  created_at:          string
  customer?:           import('./database').Customer
  service?:            import('./database').Service
}

export interface VirtualTryonSession {
  id:            string
  customer_id:   string
  image_url:     string | null
  style_applied: string | null
  color_applied: string | null
  result_url:    string | null
  saved:         boolean
  created_at:    string
}

// ── Module 7: Multi-Branch ───────────────────────────────────
export interface Branch {
  id:          string
  name:        string
  slug:        string
  address:     string | null
  city:        string | null
  phone:       string | null
  email:       string | null
  manager_id:  string | null
  timezone:    string
  open_time:   string
  close_time:  string
  is_active:   boolean
  is_franchise: boolean
  royalty_rate: number
  logo_url:    string | null
  lat:         number | null
  lng:         number | null
  created_at:  string
  updated_at:  string
  manager?:    import('./database').Staff
}

export interface BranchStats {
  branch:        Branch
  today_revenue: number
  appointments:  number
  queue_count:   number
  active_staff:  number
  avg_rating:    number
}

export interface InventoryTransfer {
  id:              string
  from_branch_id:  string
  to_branch_id:    string
  inventory_id:    string
  quantity:        number
  status:          'pending' | 'approved' | 'in_transit' | 'completed' | 'cancelled'
  requested_by:    string | null
  approved_by:     string | null
  notes:           string | null
  created_at:      string
  updated_at:      string
}

export interface FranchiseRoyalty {
  id:            string
  branch_id:     string
  period_start:  string
  period_end:    string
  gross_revenue: number
  royalty_rate:  number
  royalty_amount: number
  status:        'pending' | 'invoiced' | 'paid'
  paid_at:       string | null
  created_at:    string
  branch?:       Branch
}

// ── Module 8: Security & Compliance ─────────────────────────
export interface AuditLog {
  id:          string
  user_id:     string | null
  action:      string
  resource:    string | null
  resource_id: string | null
  old_data:    Record<string, unknown> | null
  new_data:    Record<string, unknown> | null
  ip_address:  string | null
  user_agent:  string | null
  branch_id:   string | null
  severity:    'info' | 'warning' | 'critical'
  created_at:  string
}

export interface TwoFactorAuth {
  id:          string
  user_id:     string
  method:      'totp' | 'sms' | 'email'
  secret:      string | null
  backup_codes: string[]
  is_enabled:  boolean
  last_used:   string | null
  created_at:  string
}

export interface GDPRRequest {
  id:           string
  customer_id:  string
  request_type: 'export' | 'delete' | 'rectify' | 'restrict'
  status:       'pending' | 'processing' | 'completed' | 'rejected'
  notes:        string | null
  processed_by: string | null
  processed_at: string | null
  created_at:   string
  customer?:    import('./database').Customer
}

export interface SuspiciousActivity {
  id:          string
  user_id:     string | null
  ip_address:  string | null
  activity:    string
  risk_score:  number
  is_blocked:  boolean
  details:     Record<string, unknown>
  created_at:  string
}

// ── Module 9: Advanced Scheduling ───────────────────────────
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom'

export interface RecurringAppointment {
  id:              string
  customer_id:     string
  service_id:      string
  staff_id:        string | null
  frequency:       RecurringFrequency
  interval_days:   number | null
  day_of_week:     number | null
  preferred_time:  string
  start_date:      string
  end_date:        string | null
  occurrences:     number | null
  completed_count: number
  is_active:       boolean
  last_created:    string | null
  notes:           string | null
  created_at:      string
  customer?:       import('./database').Customer
  service?:        import('./database').Service
  staff?:          import('./database').Staff
}

export interface GroupBooking {
  id:            string
  organizer_id:  string
  service_id:    string
  package_id:    string | null
  name:          string | null
  event_type:    'group' | 'bridal' | 'corporate' | 'birthday' | 'event'
  date:          string
  time:          string
  guest_count:   number
  status:        'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  total_price:   number | null
  deposit_paid:  number
  notes:         string | null
  created_at:    string
  organizer?:    import('./database').Customer
  service?:      import('./database').Service
  members?:      GroupBookingMember[]
}

export interface GroupBookingMember {
  id:               string
  group_booking_id: string
  customer_id:      string | null
  appointment_id:   string | null
  guest_name:       string | null
  service_id:       string
  staff_id:         string | null
  status:           string
}

export interface Resource {
  id:         string
  branch_id:  string | null
  name:       string
  type:       'chair' | 'basin' | 'room' | 'station' | 'equipment'
  capacity:   number
  is_active:  boolean
  created_at: string
}

export interface StaffLeave {
  id:          string
  staff_id:    string
  leave_type:  'annual' | 'sick' | 'emergency' | 'unpaid' | 'maternity' | 'paternity'
  start_date:  string
  end_date:    string
  reason:      string | null
  status:      'pending' | 'approved' | 'rejected' | 'cancelled'
  approved_by: string | null
  approved_at: string | null
  created_at:  string
  staff?:      import('./database').Staff
}

export interface StaffShift {
  id:             string
  staff_id:       string
  branch_id:      string | null
  date:           string
  shift_type:     'morning' | 'evening' | 'full' | 'off'
  start_time:     string | null
  end_time:       string | null
  swap_with:      string | null
  swap_status:    'none' | 'requested' | 'approved' | 'rejected'
  overtime_hours: number
  created_at:     string
  staff?:         import('./database').Staff
}

export interface HolidayCalendar {
  id:           string
  name:         string
  date:         string
  branch_id:    string | null
  is_closed:    boolean
  custom_hours: { open: string; close: string } | null
  created_at:   string
}

// ── Module 10: Advanced Inventory ───────────────────────────
export interface Supplier {
  id:            string
  name:          string
  contact_name:  string | null
  email:         string | null
  phone:         string | null
  address:       string | null
  payment_terms: string | null
  rating:        number
  total_orders:  number
  is_active:     boolean
  notes:         string | null
  created_at:    string
  updated_at:    string
}

export interface PurchaseOrder {
  id:             string
  po_number:      string
  supplier_id:    string | null
  branch_id:      string | null
  status:         'draft' | 'sent' | 'confirmed' | 'partial' | 'received' | 'cancelled'
  order_date:     string
  expected_date:  string | null
  received_date:  string | null
  subtotal:       number
  tax_amount:     number
  total:          number
  payment_status: 'unpaid' | 'partial' | 'paid'
  notes:          string | null
  created_by:     string | null
  created_at:     string
  updated_at:     string
  supplier?:      Supplier
  items?:         PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id:                string
  po_id:             string
  inventory_id:      string
  quantity_ordered:  number
  quantity_received: number
  unit_price:        number
  total:             number
  inventory?:        import('./database').InventoryItem
}

export interface InventoryExpiry {
  id:           string
  inventory_id: string
  batch_number: string | null
  quantity:     number
  expiry_date:  string
  status:       'active' | 'expiring_soon' | 'expired' | 'disposed'
  created_at:   string
  inventory?:   import('./database').InventoryItem
}

export interface InventoryWastage {
  id:           string
  inventory_id: string
  staff_id:     string | null
  quantity:     number
  reason:       'spilled' | 'expired' | 'damaged' | 'over_use' | 'other'
  notes:        string | null
  recorded_at:  string
  inventory?:   import('./database').InventoryItem
  staff?:       import('./database').Staff
}

export interface RetailProduct {
  id:           string
  inventory_id: string
  name:         string
  description:  string | null
  retail_price: number
  cost_price:   number
  margin_pct:   number
  barcode:      string | null
  image_url:    string | null
  is_active:    boolean
  created_at:   string
}

export interface RetailSale {
  id:             string
  product_id:     string
  transaction_id: string | null
  customer_id:    string | null
  staff_id:       string | null
  quantity:       number
  unit_price:     number
  total:          number
  commission_pct: number
  created_at:     string
  product?:       RetailProduct
  staff?:         import('./database').Staff
}
