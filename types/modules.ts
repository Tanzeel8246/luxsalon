// ── Module 1: AI/ML ──────────────────────────────────────────
export interface DemandForecast {
  id:                  string
  forecast_date:       string
  day_of_week:         number
  predicted_customers: number
  predicted_revenue:   number
  confidence_score:    number
  model_version:       string
  actual_customers:    number | null
  actual_revenue:      number | null
  created_at:          string
}

export interface ChurnPrediction {
  id:              string
  customer_id:     string
  churn_score:     number
  risk_level:      'low' | 'medium' | 'high' | 'critical'
  days_since_visit: number
  avg_visit_gap:   number
  predicted_at:    string
  action_taken:    boolean
  action_type:     string | null
  resolved_at:     string | null
  customer?:       import('./database').Customer
}

export interface ChatMessage {
  role:      'user' | 'assistant' | 'system'
  content:   string
  timestamp: string
  intent?:   string
}

export interface ChatbotSession {
  id:          string
  customer_id: string | null
  channel:     'web' | 'whatsapp' | 'sms'
  messages:    ChatMessage[]
  intent:      string | null
  resolved:    boolean
  started_at:  string
  ended_at:    string | null
}

export interface SmartScheduleSuggestion {
  id:              string
  staff_id:        string
  date:            string
  suggested_start: string
  suggested_end:   string
  reason:          string
  fatigue_score:   number
  accepted:        boolean
}

// ── Module 2: Mobile/PWA ─────────────────────────────────────
export interface DeviceToken {
  id:         string
  user_id:    string
  token:      string
  platform:   'ios' | 'android' | 'web'
  is_active:  boolean
  created_at: string
}

export interface PushNotification {
  id:         string
  user_id:    string
  title:      string
  body:       string
  data:       Record<string, unknown>
  type:       string
  is_read:    boolean
  sent_at:    string | null
  created_at: string
}

// ── Module 3: Financial/POS ──────────────────────────────────
export type PaymentMethod = 'cash' | 'card' | 'wallet' | 'split' | 'gift_card'
export type POSStatus = 'pending' | 'completed' | 'refunded' | 'partial_refund'

export interface POSTransaction {
  id:             string
  appointment_id: string | null
  customer_id:    string | null
  cashier_id:     string | null
  subtotal:       number
  tax_amount:     number
  tax_rate:       number
  discount_amount: number
  tip_amount:     number
  total:          number
  payment_method: PaymentMethod
  payment_ref:    string | null
  status:         POSStatus
  notes:          string | null
  receipt_number: string
  created_at:     string
  customer?:      import('./database').Customer
  cashier?:       import('./database').Staff
  splits?:        POSSplit[]
}

export interface POSSplit {
  id:             string
  transaction_id: string
  method:         PaymentMethod
  amount:         number
  ref:            string | null
}

export interface Invoice {
  id:             string
  invoice_number: string
  customer_id:    string | null
  transaction_id: string | null
  issue_date:     string
  due_date:       string | null
  subtotal:       number
  tax_total:      number
  discount_total: number
  grand_total:    number
  status:         'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  notes:          string | null
  pdf_url:        string | null
  created_at:     string
  items?:         InvoiceItem[]
  customer?:      import('./database').Customer
}

export interface InvoiceItem {
  id:          string
  invoice_id:  string
  description: string
  quantity:    number
  unit_price:  number
  total:       number
}

export interface SubscriptionPlan {
  id:                  string
  name:                string
  description:         string | null
  price_monthly:       number
  service_allowances:  Record<string, number>
  unlimited_services:  string[]
  discount_percentage: number
  color:               string
  is_active:           boolean
  created_at:          string
}

export interface CustomerSubscription {
  id:               string
  customer_id:      string
  plan_id:          string
  status:           'active' | 'paused' | 'cancelled' | 'expired'
  start_date:       string
  end_date:         string | null
  next_billing:     string | null
  payment_method:   string | null
  usage_this_month: Record<string, number>
  created_at:       string
  plan?:            SubscriptionPlan
}

export interface StaffPayroll {
  id:               string
  staff_id:         string
  period_start:     string
  period_end:       string
  base_salary:      number
  commission_rate:  number
  commission_earned: number
  tips_earned:      number
  bonuses:          number
  deductions:       number
  gross_total:      number
  tax_deducted:     number
  net_pay:          number
  status:           'pending' | 'approved' | 'paid'
  paid_at:          string | null
  notes:            string | null
  created_at:       string
  staff?:           import('./database').Staff
}

export interface Expense {
  id:          string
  category:    string
  description: string
  amount:      number
  date:        string
  receipt_url: string | null
  approved_by: string | null
  created_at:  string
}

// ── Module 4: Advanced BI ────────────────────────────────────
export interface CustomerLTV {
  id:              string
  customer_id:     string
  total_spent:     number
  total_visits:    number
  avg_order_value: number
  visit_frequency: number | null
  predicted_ltv:   number | null
  clv_segment:     'champion' | 'loyal' | 'at_risk' | 'lost' | 'new'
  calculated_at:   string
  customer?:       import('./database').Customer
}

export interface ServiceProfitability {
  id:                 string
  name:               string
  category:           string
  base_price:         number
  duration:           number
  total_bookings:     number
  total_revenue:      number
  avg_revenue:        number
  avg_rating:         number
  revenue_per_minute: number
}

export interface DailyRevenueSummary {
  day:                 string
  total_appointments:  number
  total_revenue:       number
  avg_ticket:          number
  unique_customers:    number
}

export interface KPITarget {
  id:           string
  metric_name:  string
  target_value: number
  period:       'daily' | 'weekly' | 'monthly' | 'yearly'
  year:         number | null
  month:        number | null
  week:         number | null
}

// ── Module 5: Marketing/CRM ──────────────────────────────────
export interface Campaign {
  id:              string
  name:            string
  type:            'whatsapp' | 'sms' | 'email' | 'push' | 'all'
  status:          'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
  target_segment:  string
  target_tiers:    string[]
  message_template: string
  subject:         string | null
  scheduled_at:    string | null
  sent_count:      number
  delivered_count: number
  opened_count:    number
  clicked_count:   number
  converted_count: number
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

export interface WhatsAppTemplate {
  id:          string
  name:        string
  category:    'booking' | 'reminder' | 'promotion' | 'feedback' | 'queue' | 'loyalty'
  template:    string
  variables:   string[]
  is_approved: boolean
  language:    string
  created_at:  string
}

export interface GiftCard {
  id:              string
  code:            string
  initial_value:   number
  balance:         number
  purchased_by:    string | null
  recipient_name:  string | null
  recipient_email: string | null
  recipient_phone: string | null
  message:         string | null
  status:          'active' | 'used' | 'expired' | 'cancelled'
  expires_at:      string | null
  created_at:      string
}

export interface Referral {
  id:            string
  referrer_id:   string
  referee_id:    string | null
  referral_code: string
  status:        'pending' | 'completed' | 'rewarded' | 'expired'
  reward_points: number
  rewarded_at:   string | null
  created_at:    string
  referrer?:     import('./database').Customer
}

export interface NotificationLog {
  id:          string
  customer_id: string | null
  channel:     'whatsapp' | 'sms' | 'email' | 'push'
  type:        string
  status:      'sent' | 'delivered' | 'failed' | 'read'
  message:     string
  meta:        Record<string, unknown>
  created_at:  string
}
