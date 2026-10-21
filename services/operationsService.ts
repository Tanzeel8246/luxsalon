import { getSupabaseClient } from '@/lib/supabase'
import { format } from 'date-fns'
import type {
  Task, Checklist, ChecklistCompletion,
  Incident, TrainingModule, TrainingEnrollment,
  Certification, ApiResponse
} from '@/types'

export const operationsService = {
  // ── Tasks (Kanban) ───────────────────────────────────────────
  async getTasks(filters?: { assigned_to?: string; category?: string; branch_id?: string; status?: string }): Promise<ApiResponse<Task[]>> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('tasks')
      .select('*, assignee:staff!assigned_to(*)')
      .not('status', 'eq', 'cancelled')
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true })

    if (filters?.assigned_to) query = query.eq('assigned_to', filters.assigned_to)
    if (filters?.category)    query = query.eq('category', filters.category)
    if (filters?.branch_id)   query = query.eq('branch_id', filters.branch_id)
    if (filters?.status)      query = query.eq('status', filters.status)

    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at' | 'assignee'>): Promise<ApiResponse<Task>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select('*, assignee:staff!assigned_to(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async updateTaskStatus(taskId: string, status: Task['status']): Promise<ApiResponse<Task>> {
    const supabase = getSupabaseClient()
    const updates: Partial<Task> = { status }
    if (status === 'done') updates.completed_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('tasks').update(updates).eq('id', taskId)
      .select('*, assignee:staff!assigned_to(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getTasksByStatus(): Promise<ApiResponse<Record<Task['status'], Task[]>>> {
    const { data, error } = await this.getTasks()
    if (error || !data) return { data: null, error: error ?? 'Error' }

    const grouped: Record<string, Task[]> = { todo: [], in_progress: [], review: [], done: [] }
    data.forEach(t => { if (grouped[t.status]) grouped[t.status].push(t) })
    return { data: grouped as Record<Task['status'], Task[]>, error: null }
  },

  // ── Checklists ───────────────────────────────────────────────
  async getChecklists(type?: string): Promise<ApiResponse<Checklist[]>> {
    const supabase = getSupabaseClient()
    let query = supabase.from('checklists').select('*, items:checklist_items(*)').eq('is_active', true)
    if (type) query = query.eq('type', type)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async submitCompletion(payload: {
    checklist_id:  string
    completed_by:  string
    branch_id?:    string
    items_done:    number
    items_total:   number
    notes?:        string
    photo_urls?:   string[]
  }): Promise<ApiResponse<ChecklistCompletion>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('checklist_completions')
      .insert({
        checklist_id:  payload.checklist_id,
        completed_by:  payload.completed_by,
        branch_id:     payload.branch_id ?? null,
        date:          format(new Date(), 'yyyy-MM-dd'),
        items_done:    payload.items_done,
        items_total:   payload.items_total,
        notes:         payload.notes ?? null,
        photo_urls:    payload.photo_urls ?? [],
      })
      .select('*, checklist:checklists(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getTodayCompletions(branchId?: string): Promise<ApiResponse<ChecklistCompletion[]>> {
    const supabase = getSupabaseClient()
    const today = format(new Date(), 'yyyy-MM-dd')
    let query = supabase
      .from('checklist_completions')
      .select('*, checklist:checklists(*), completer:staff!completed_by(*)')
      .eq('date', today)
    if (branchId) query = query.eq('branch_id', branchId)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  // ── Incidents ────────────────────────────────────────────────
  async reportIncident(incident: Omit<Incident, 'id' | 'status' | 'resolution' | 'resolved_by' | 'resolved_at' | 'created_at' | 'updated_at' | 'reporter' | 'customer'>): Promise<ApiResponse<Incident>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('incidents')
      .insert({ ...incident, status: 'open' })
      .select('*, reporter:staff!reported_by(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async getIncidents(status?: Incident['status'], severity?: Incident['severity']): Promise<ApiResponse<Incident[]>> {
    const supabase = getSupabaseClient()
    let query = supabase
      .from('incidents')
      .select('*, reporter:staff!reported_by(*), customer:customers(*)')
      .order('created_at', { ascending: false })
    if (status)   query = query.eq('status', status)
    if (severity) query = query.eq('severity', severity)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async resolveIncident(incidentId: string, resolvedBy: string, resolution: string): Promise<ApiResponse<Incident>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('incidents')
      .update({ status: 'resolved', resolved_by: resolvedBy, resolution, resolved_at: new Date().toISOString() })
      .eq('id', incidentId)
      .select()
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  // ── Training ─────────────────────────────────────────────────
  async getTrainingModules(category?: string): Promise<ApiResponse<TrainingModule[]>> {
    const supabase = getSupabaseClient()
    let query = supabase.from('training_modules').select('*').eq('is_active', true).order('order_index')
    if (category) query = query.eq('category', category)
    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async enrollStaff(staffId: string, moduleId: string, assignedBy: string, dueDate?: string): Promise<ApiResponse<TrainingEnrollment>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('training_enrollments')
      .upsert({
        staff_id:    staffId,
        module_id:   moduleId,
        status:      'not_started',
        attempts:    0,
        assigned_by: assignedBy,
        due_date:    dueDate ?? null,
      }, { onConflict: 'staff_id,module_id' })
      .select('*, module:training_modules(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async startModule(enrollmentId: string): Promise<ApiResponse<TrainingEnrollment>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('training_enrollments')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', enrollmentId)
      .select('*, module:training_modules(*)')
      .single() as any
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async completeModule(enrollmentId: string, score: number): Promise<ApiResponse<{ enrollment: TrainingEnrollment; certification?: Certification }>> {
    const supabase = getSupabaseClient()
    const { data: enroll } = await supabase
      .from('training_enrollments')
      .select('*, module:training_modules(*)')
      .eq('id', enrollmentId)
      .single() as any

    if (!enroll) return { data: null, error: 'Enrollment not found' }

    const passing = score >= ((enroll.module as TrainingModule)?.passing_score ?? 70)
    const status  = passing ? 'completed' : 'failed'

    const { data: updated } = await supabase
      .from('training_enrollments')
      .update({
        status,
        score,
        attempts:     (enroll.attempts ?? 0) + 1,
        completed_at: passing ? new Date().toISOString() : null,
      })
      .eq('id', enrollmentId)
      .select('*, module:training_modules(*)')
      .single() as any

    let certification: Certification | undefined
    if (passing) {
      const { data: cert } = await supabase
        .from('certifications')
        .insert({
          staff_id:     enroll.staff_id,
          module_id:    enroll.module_id,
          certificate_no: '',
          issued_date:  format(new Date(), 'yyyy-MM-dd'),
          expiry_date:  format(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          score,
          is_valid:     true,
        })
        .select()
        .single() as any
      certification = cert ?? undefined
    }

    return { data: { enrollment: updated!, certification }, error: null }
  },

  async getStaffTrainingProgress(staffId: string): Promise<ApiResponse<{
    total:     number
    completed: number
    in_progress: number
    overdue:   number
    pct:       number
  }>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('training_enrollments')
      .select('status, due_date')
      .eq('staff_id', staffId)
    if (error) return { data: null, error: error.message }

    const enrollments = data ?? []
    const today = new Date()
    const total       = enrollments.length
    const completed   = enrollments.filter(e => e.status === 'completed').length
    const in_progress = enrollments.filter(e => e.status === 'in_progress').length
    const overdue     = enrollments.filter(e => e.due_date && new Date(e.due_date) < today && e.status !== 'completed').length

    return {
      data: {
        total, completed, in_progress, overdue,
        pct: total ? Math.round((completed / total) * 100) : 0,
      },
      error: null,
    }
  },
}
