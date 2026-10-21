// ── Module 11: Operations ─────────────────────────────────────
export interface Task {
  id:           string
  title:        string
  description:  string | null
  assigned_to:  string | null
  created_by:   string | null
  branch_id:    string | null
  category:     'cleaning' | 'maintenance' | 'admin' | 'training' | 'other'
  priority:     'low' | 'medium' | 'high' | 'urgent'
  status:       'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
  due_date:     string | null
  completed_at: string | null
  recurrence:   'none' | 'daily' | 'weekly' | 'monthly' | null
  tags:         string[]
  created_at:   string
  updated_at:   string
  assignee?:    import('./database').Staff
}

export interface Checklist {
  id:        string
  name:      string
  type:      'opening' | 'closing' | 'service' | 'safety' | 'cleaning' | 'maintenance'
  branch_id: string | null
  is_active: boolean
  frequency: 'daily' | 'weekly' | 'per_service' | 'custom'
  created_at: string
  items?:    ChecklistItem[]
}

export interface ChecklistItem {
  id:              string
  checklist_id:    string
  item:            string
  order_index:     number
  is_critical:     boolean
  photo_required:  boolean
}

export interface ChecklistCompletion {
  id:           string
  checklist_id: string
  completed_by: string | null
  branch_id:    string | null
  date:         string
  items_done:   number
  items_total:  number
  pct_complete: number
  notes:        string | null
  photo_urls:   string[]
  created_at:   string
  checklist?:   Checklist
  completer?:   import('./database').Staff
}

export interface Incident {
  id:              string
  type:            'customer_complaint' | 'equipment' | 'staff' | 'safety' | 'theft' | 'other'
  severity:        'low' | 'medium' | 'high' | 'critical'
  title:           string
  description:     string
  reported_by:     string | null
  involved_staff:  string | null
  customer_id:     string | null
  branch_id:       string | null
  status:          'open' | 'investigating' | 'resolved' | 'closed'
  resolution:      string | null
  resolved_by:     string | null
  resolved_at:     string | null
  evidence_urls:   string[]
  created_at:      string
  updated_at:      string
  reporter?:       import('./database').Staff
  customer?:       import('./database').Customer
}

export interface TrainingModule {
  id:             string
  title:          string
  description:    string | null
  category:       'onboarding' | 'skills' | 'safety' | 'compliance' | 'product' | 'customer_service'
  content_type:   'video' | 'document' | 'quiz' | 'practical' | 'mixed'
  duration_mins:  number | null
  passing_score:  number
  is_mandatory:   boolean
  order_index:    number
  content_url:    string | null
  thumbnail_url:  string | null
  is_active:      boolean
  created_at:     string
}

export interface TrainingEnrollment {
  id:           string
  staff_id:     string
  module_id:    string
  status:       'not_started' | 'in_progress' | 'completed' | 'failed'
  score:        number | null
  attempts:     number
  started_at:   string | null
  completed_at: string | null
  due_date:     string | null
  assigned_by:  string | null
  created_at:   string
  module?:      TrainingModule
  staff?:       import('./database').Staff
}

export interface Certification {
  id:              string
  staff_id:        string
  module_id:       string
  certificate_no:  string
  issued_date:     string
  expiry_date:     string | null
  score:           number | null
  is_valid:        boolean
  certificate_url: string | null
  created_at:      string
  staff?:          import('./database').Staff
  module?:         TrainingModule
}

// ── Module 12: Performance & Technical ─────────────────────
export interface ErrorLog {
  id:            string
  level:         'debug' | 'info' | 'warn' | 'error' | 'fatal'
  message:       string
  stack:         string | null
  source:        string | null
  user_id:       string | null
  request_path:  string | null
  request_data:  Record<string, unknown>
  environment:   string
  resolved:      boolean
  created_at:    string
}

export interface PerformanceMetric {
  id:           string
  metric_name:  string
  metric_value: number
  unit:         string | null
  endpoint:     string | null
  method:       string | null
  status_code:  number | null
  duration_ms:  number | null
  memory_mb:    number | null
  branch_id:    string | null
  recorded_at:  string
}

export interface Webhook {
  id:            string
  name:          string
  url:           string
  events:        string[]
  secret:        string | null
  is_active:     boolean
  last_fired:    string | null
  success_count: number
  failure_count: number
  created_at:    string
}

export interface SystemHealth {
  database:    { status: 'healthy' | 'degraded' | 'down'; latency_ms: number; connections: number }
  storage:     { status: 'healthy' | 'degraded' | 'down'; used_gb: number; total_gb: number }
  realtime:    { status: 'healthy' | 'degraded' | 'down'; connected_clients: number }
  api:         { status: 'healthy' | 'degraded' | 'down'; avg_latency_ms: number; error_rate: number }
  cache:       { status: 'healthy' | 'degraded' | 'down'; hit_rate: number; memory_mb: number }
  uptime_pct:  number
  last_checked: string
}

// ── Module 13: Integrations & API ──────────────────────────
export type IntegrationProvider =
  | 'google_calendar' | 'apple_calendar'
  | 'stripe' | 'paypal' | 'razorpay'
  | 'quickbooks' | 'mailchimp' | 'sendgrid' | 'twilio' | 'firebase'
  | 'zapier' | 'google_mybusiness' | 'instagram' | 'facebook' | 'whatsapp_business' | 'gemini'

export interface IntegrationConfig {
  id:            string
  provider:      IntegrationProvider
  is_enabled:    boolean
  config:        Record<string, unknown>
  access_token:  string | null
  refresh_token: string | null
  expires_at:    string | null
  last_sync:     string | null
  sync_status:   'idle' | 'syncing' | 'success' | 'error'
  error_msg:     string | null
  created_at:    string
  updated_at:    string
}

export interface ReportTemplate {
  id:           string
  name:         string
  type:         'revenue' | 'staff' | 'inventory' | 'customers' | 'appointments' | 'custom'
  config:       Record<string, unknown>
  schedule:     'manual' | 'daily' | 'weekly' | 'monthly'
  recipients:   string[]
  last_run:     string | null
  created_by:   string | null
  created_at:   string
}

export interface ExportedReport {
  id:           string
  template_id:  string | null
  format:       'pdf' | 'xlsx' | 'csv' | 'json'
  file_url:     string | null
  file_size:    number | null
  generated_by: string | null
  period_start: string | null
  period_end:   string | null
  created_at:   string
}
