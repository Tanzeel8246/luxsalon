export * from './database'

export interface StaffScore {
  staff:        import('./database').Staff
  score:        number
  availability: number
  workload:     number
}

export interface BookingSlot {
  start_time:    string
  end_time:      string
  is_available:  boolean
  staff_options: StaffScore[]
}

export interface BookingFormData {
  service_id:  string
  package_id?: string
  staff_id:    string
  date:        string
  time:        string
  notes?:      string
  promo_code?: string
}

export interface PriceBreakdown {
  base_price:      number
  peak_surcharge:  number
  demand_surcharge: number
  loyalty_discount: number
  promo_discount:  number
  total:           number
  multiplier:      number
}

export interface RecommendationResult {
  service:   import('./database').Service
  score:     number
  reason:    string
  last_used: string | null
}

export interface QueueStats {
  queue_length:   number
  active_staff:   number
  avg_duration:   number
  estimated_wait: number
}

export interface DashboardStats {
  total_revenue:      number
  today_appointments: number
  active_staff:       number
  queue_count:        number
  revenue_growth:     number
  avg_rating:         number
}

export interface RevenueDataPoint {
  date:    string
  revenue: number
  count:   number
}

export interface StaffPerformanceData {
  staff:              import('./database').Staff
  appointments_today: number
  revenue_today:      number
  avg_rating:         number
  completion_rate:    number
}

export interface PeakHourData {
  hour:         number
  appointment_count: number
  revenue:      number
}

export interface InventoryAlert {
  item:     import('./database').InventoryItem
  severity: 'critical' | 'warning'
  deficit:  number
}

export interface AuthUser {
  id:    string
  email: string
  role:  import('./database').UserRole
  profile: import('./database').Staff | import('./database').Customer | null
}

export type ApiResponse<T> =
  | { data: T;    error: null }
  | { data: null; error: string }

export type SortDirection = 'asc' | 'desc'

export interface PaginationParams {
  page:     number
  per_page: number
}

export interface PaginatedResponse<T> {
  data:        T[]
  total:       number
  page:        number
  per_page:    number
  total_pages: number
}
