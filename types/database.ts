export type UserRole = 'admin' | 'staff' | 'customer'
export type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
export type QueueStatus = 'waiting' | 'called' | 'serving' | 'done' | 'cancelled'
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type LoyaltyType = 'earn' | 'redeem'
export type PricingRuleType = 'peak_hours' | 'demand' | 'seasonal' | 'loyalty' | 'promo'

export interface Staff {
  id:            string
  user_id:       string
  name:          string
  email:         string
  phone:         string | null
  role:          'admin' | 'staff'
  skills:        string[]
  rating:        number
  total_reviews: number
  is_active:     boolean
  avatar_url:    string | null
  bio:           string | null
  hire_date:     string | null
  created_at:    string
  updated_at:    string
}

export interface Service {
  id:              string
  name:            string
  description:     string | null
  duration:        number
  base_price:      number
  category:        string
  required_skills: string[]
  image_url:       string | null
  popularity:      number
  is_active:       boolean
  created_at:      string
  updated_at:      string
}

export interface Package {
  id:                  string
  name:                string
  description:         string | null
  service_ids:         string[]
  discount_percentage: number
  total_price:         number
  image_url:           string | null
  is_active:           boolean
  created_at:          string
  updated_at:          string
}

export interface Customer {
  id:             string
  user_id:        string
  name:           string
  email:          string
  phone:          string | null
  date_of_birth:  string | null
  loyalty_points: number
  tier:           LoyaltyTier
  preferences:    Record<string, unknown>
  avatar_url:     string | null
  created_at:     string
  updated_at:     string
}

export interface StaffAvailability {
  id:           string
  staff_id:     string
  day_of_week:  number
  start_time:   string
  end_time:     string
  is_available: boolean
}

export interface Appointment {
  id:               string
  customer_id:      string
  staff_id:         string | null
  service_id:       string
  package_id:       string | null
  start_time:       string
  end_time:         string
  status:           AppointmentStatus
  total_price:      number
  discount_applied: number
  notes:            string | null
  rating:           number | null
  review:           string | null
  created_at:       string
  updated_at:       string
  staff?:           Staff
  service?:         Service
  customer?:        Customer
}

export interface InventoryItem {
  id:             string
  name:           string
  sku:            string
  category:       string | null
  quantity:       number
  unit:           string
  min_threshold:  number
  cost_per_unit:  number
  supplier:       string | null
  last_restocked: string | null
  created_at:     string
  updated_at:     string
}

export interface ServiceInventory {
  id:            string
  service_id:    string
  inventory_id:  string
  quantity_used: number
}

export interface LoyaltyTransaction {
  id:             string
  customer_id:    string
  appointment_id: string | null
  points:         number
  type:           LoyaltyType
  description:    string | null
  created_at:     string
}

export interface QueueEntry {
  id:             string
  customer_id:    string
  service_id:     string
  staff_id:       string | null
  position:       number
  estimated_wait: number | null
  status:         QueueStatus
  check_in_time:  string
  called_at:      string | null
  served_at:      string | null
  done_at:        string | null
  created_at:     string
  updated_at:     string
  customer?:      Customer
  service?:       Service
  staff?:         Staff
}

export interface PricingRule {
  id:          string
  name:        string
  rule_type:   PricingRuleType
  service_id:  string | null
  multiplier:  number
  conditions:  Record<string, unknown>
  is_active:   boolean
  valid_from:  string | null
  valid_until: string | null
  created_at:  string
}

export interface AnalyticsLog {
  id:          string
  event_type:  string
  entity_type: string | null
  entity_id:   string | null
  data:        Record<string, unknown>
  user_id:     string | null
  created_at:  string
}

// Supabase DB type map
export interface Database {
  public: {
    Tables: {
      staff:                { Row: Staff;               Insert: Omit<Staff, 'id'|'created_at'|'updated_at'>; Update: Partial<Omit<Staff,'id'|'created_at'|'updated_at'>> }
      services:             { Row: Service;             Insert: Omit<Service,'id'|'created_at'|'updated_at'>; Update: Partial<Omit<Service,'id'|'created_at'|'updated_at'>> }
      packages:             { Row: Package;             Insert: Omit<Package,'id'|'created_at'|'updated_at'>; Update: Partial<Omit<Package,'id'|'created_at'|'updated_at'>> }
      customers:            { Row: Customer;            Insert: Omit<Customer,'id'|'created_at'|'updated_at'>; Update: Partial<Omit<Customer,'id'|'created_at'|'updated_at'>> }
      appointments:         { Row: Appointment;         Insert: Omit<Appointment,'id'|'created_at'|'updated_at'>; Update: Partial<Omit<Appointment,'id'|'created_at'|'updated_at'>> }
      inventory:            { Row: InventoryItem;       Insert: Omit<InventoryItem,'id'|'created_at'|'updated_at'>; Update: Partial<Omit<InventoryItem,'id'|'created_at'|'updated_at'>> }
      loyalty_transactions: { Row: LoyaltyTransaction;  Insert: Omit<LoyaltyTransaction,'id'|'created_at'>; Update: never }
      queue:                { Row: QueueEntry;          Insert: Omit<QueueEntry,'id'|'created_at'|'updated_at'>; Update: Partial<Omit<QueueEntry,'id'|'created_at'|'updated_at'>> }
      pricing_rules:        { Row: PricingRule;         Insert: Omit<PricingRule,'id'|'created_at'>; Update: Partial<Omit<PricingRule,'id'|'created_at'>> }
      analytics_logs:       { Row: AnalyticsLog;        Insert: Omit<AnalyticsLog,'id'|'created_at'>; Update: never }
    }
    Functions: {
      fn_get_staff_score: {
        Args: { p_staff_id: string; p_service_id: string; p_start_time: string; p_end_time: string }
        Returns: number
      }
      fn_calculate_queue_wait: {
        Args: { p_date?: string }
        Returns: { queue_length: number; active_staff: number; avg_duration: number; estimated_wait: number }[]
      }
    }
  }
}
