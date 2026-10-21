import { getSupabaseClient } from '@/lib/supabase'
import { subDays, addDays, format, parseISO, getDay } from 'date-fns'
import type { ApiResponse } from '@/types'
import { getGeminiClient } from '@/lib/gemini'

export const aiService = {

  // ── Demand Forecasting ───────────────────────────────────────
  async forecastDemand(daysAhead = 7): Promise<ApiResponse<any[]>> {
    const supabase = getSupabaseClient()
    const { data: history } = await (supabase as any)
      .from('appointments')
      .select('start_time, total_price')
      .gte('start_time', subDays(new Date(), 90).toISOString())
      .in('status', ['completed', 'confirmed'])

    if (!history) return { data: [], error: null }

    const dailyMap: Record<string, { count: number; revenue: number }> = {}
    history.forEach((a: any) => {
      const day = format(parseISO(a.start_time), 'yyyy-MM-dd')
      if (!dailyMap[day]) dailyMap[day] = { count: 0, revenue: 0 }
      dailyMap[day].count++
      dailyMap[day].revenue += a.total_price
    })

    const gemini = await getGeminiClient()
    const today = new Date()
    const forecasts: any[] = []

    if (gemini) {
      try {
        const prompt = `Analyze this daily salon appointment data (last 90 days): ${JSON.stringify(dailyMap)}. Predict the next ${daysAhead} days of customer counts and revenue. Output strictly as JSON array of objects with keys: "forecast_date" (YYYY-MM-DD), "predicted_customers" (number), "predicted_revenue" (number), "confidence_score" (0.0 to 1.0). Start from ${format(addDays(today, 1), 'yyyy-MM-dd')}.`
        
        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        })
        
        let jsonStr = response.text || '[]'
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim()
        const aiResults = JSON.parse(jsonStr)

        for (const res of aiResults) {
          const dateStr = res.forecast_date
          forecasts.push({
            id:                  crypto.randomUUID(),
            forecast_date:       dateStr,
            day_of_week:         getDay(parseISO(dateStr)),
            predicted_customers: res.predicted_customers,
            predicted_revenue:   res.predicted_revenue,
            confidence_score:    res.confidence_score,
            model_version:       'gemini-v1',
            actual_customers:    null,
            actual_revenue:      null,
            created_at:          new Date().toISOString(),
          })
        }
      } catch (err) {
        console.error('Gemini prediction failed, falling back to math', err)
      }
    }

    if (forecasts.length === 0) {
      // Fallback Math
      const byDow: Record<number, { count: number[]; revenue: number[] }> = {}
      for (let d = 0; d < 7; d++) byDow[d] = { count: [], revenue: [] }

      Object.entries(dailyMap).forEach(([day, v]) => {
        const dow = getDay(parseISO(day))
        byDow[dow].count.push(v.count)
        byDow[dow].revenue.push(v.revenue)
      })

      const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
      const stddev = (arr: number[]) => {
        const m = avg(arr)
        return arr.length > 1 ? Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length) : 0
      }

      for (let i = 1; i <= daysAhead; i++) {
        const date  = addDays(today, i)
        const dow   = getDay(date)
        const dowData = byDow[dow]
        const avgCount   = avg(dowData.count)
        const avgRevenue = avg(dowData.revenue)
        const sd = stddev(dowData.count)
        const confidence = Math.max(0.5, 1 - (sd / Math.max(avgCount, 1)) * 0.5)

        const isWeekend = dow === 0 || dow === 6
        const multiplier = isWeekend ? 1.2 : 1.0

        forecasts.push({
          id:                  crypto.randomUUID(),
          forecast_date:       format(date, 'yyyy-MM-dd'),
          day_of_week:         dow,
          predicted_customers: Math.round(avgCount * multiplier),
          predicted_revenue:   Math.round(avgRevenue * multiplier * 100) / 100,
          confidence_score:    Math.round(confidence * 1000) / 1000,
          model_version:       'math-v1',
          actual_customers:    null,
          actual_revenue:      null,
          created_at:          new Date().toISOString(),
        })
      }
    }

    await (supabase as any).from('demand_forecasts').upsert(
      forecasts.map(f => ({
        forecast_date:       f.forecast_date,
        day_of_week:         f.day_of_week,
        predicted_customers: f.predicted_customers,
        predicted_revenue:   f.predicted_revenue,
        confidence_score:    f.confidence_score,
        model_version:       f.model_version,
      })),
      { onConflict: 'forecast_date' }
    )

    return { data: forecasts, error: null }
  },

  async getForecasts(days = 7): Promise<ApiResponse<any[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await (supabase as any)
      .from('demand_forecasts')
      .select('*')
      .gte('forecast_date', format(new Date(), 'yyyy-MM-dd'))
      .order('forecast_date', { ascending: true })
      .limit(days)

    if (error) return { data: null, error: error.message }
    if (!data || data.length === 0) return await this.forecastDemand(days)
    return { data, error: null }
  },

  // ── Churn Detection ──────────────────────────────────────────
  async detectChurningCustomers(limit = 50): Promise<ApiResponse<any[]>> {
    const supabase = getSupabaseClient()

    const { data: customers } = await (supabase as any)
      .from('customers')
      .select('id')
      .limit(200)

    if (!customers) return { data: [], error: null }

    const customerDataForAI: any[] = []

    await Promise.all(
      customers.map(async (c: any) => {
        const { data: appts } = await (supabase as any)
          .from('appointments')
          .select('start_time, total_price')
          .eq('customer_id', c.id)
          .in('status', ['completed'])
          .order('start_time', { ascending: false })

        if (!appts || appts.length === 0) return

        const daysSince = Math.floor((Date.now() - parseISO(appts[0].start_time).getTime()) / 86400000)
        let totalSpend = 0
        appts.forEach((a: any) => totalSpend += a.total_price)
        
        customerDataForAI.push({
          id: c.id,
          visits: appts.length,
          days_since_last_visit: daysSince,
          total_spend: totalSpend
        })
      })
    )

    let aiResults: any[] = []
    const gemini = await getGeminiClient()
    if (gemini && customerDataForAI.length > 0) {
      try {
        const prompt = `Analyze this customer data: ${JSON.stringify(customerDataForAI)}. For each customer, predict churn risk based on days since last visit and total visits. Output strictly as JSON array of objects: "id", "churn_score" (0.0 to 1.0), "risk_level" ("low", "medium", "high", "critical").`
        
        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        })
        let jsonStr = response.text || '[]'
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim()
        aiResults = JSON.parse(jsonStr)
      } catch (err) {
        console.error('Gemini churn prediction failed', err)
      }
    }

    const predictions: any[] = []

    if (aiResults.length > 0) {
      aiResults.forEach((res: any) => {
        const cData = customerDataForAI.find((c: any) => c.id === res.id)
        if (cData && res.churn_score >= 0.3) {
          predictions.push({
            id:              crypto.randomUUID(),
            customer_id:     res.id,
            churn_score:     res.churn_score,
            risk_level:      res.risk_level,
            days_since_visit: cData.days_since_last_visit,
            avg_visit_gap:   0,
            predicted_at:    new Date().toISOString(),
            action_taken:    false,
            action_type:     null,
            resolved_at:     null,
          })
        }
      })
    } else {
      // Fallback
      customerDataForAI.forEach((c: any) => {
         const score = Math.min(1, c.days_since_last_visit / 90)
         if (score >= 0.3) {
            predictions.push({
              id:              crypto.randomUUID(),
              customer_id:     c.id,
              churn_score:     score,
              risk_level:      score >= 0.8 ? 'critical' : score >= 0.6 ? 'high' : score >= 0.4 ? 'medium' : 'low',
              days_since_visit: c.days_since_last_visit,
              avg_visit_gap:   0,
              predicted_at:    new Date().toISOString(),
              action_taken:    false,
              action_type:     null,
              resolved_at:     null,
            })
         }
      })
    }

    const sorted = predictions.sort((a: any, b: any) => b.churn_score - a.churn_score).slice(0, limit)

    if (sorted.length > 0) {
      await (supabase as any).from('churn_predictions').upsert(
        sorted.map((p: any) => ({
          customer_id:      p.customer_id,
          churn_score:      p.churn_score,
          risk_level:       p.risk_level,
          days_since_visit: p.days_since_visit,
          avg_visit_gap:    p.avg_visit_gap,
        })),
        { onConflict: 'customer_id' }
      )
    }

    return { data: sorted, error: null }
  },

  async getChurnPredictions(riskLevel?: 'low' | 'medium' | 'high'): Promise<ApiResponse<any[]>> {
    const supabase = getSupabaseClient()
    let query = (supabase as any)
      .from('churn_predictions')
      .select('*, customer:customers(name, phone, email, total_spent)')
      .eq('action_taken', false)
      .order('churn_score', { ascending: false })
      .limit(50)

    if (riskLevel) query = query.eq('risk_level', riskLevel)

    const { data, error } = await query
    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async markChurnActionTaken(predictionId: string, actionType: string): Promise<ApiResponse<void>> {
    const supabase = getSupabaseClient()
    const { error } = await (supabase as any)
      .from('churn_predictions')
      .update({ action_taken: true, action_type: actionType, resolved_at: new Date().toISOString() })
      .eq('id', predictionId)

    if (error) return { data: null, error: error.message }
    return { data: undefined, error: null }
  },

  // ── Smart Schedule Optimizer ─────────────────────────────────
  async getScheduleSuggestions(staffId: string, date: string): Promise<ApiResponse<unknown>> {
    const supabase = getSupabaseClient()

    const { data: todayAppts } = await supabase
      .from('appointments')
      .select('start_time, end_time, service(duration)')
      .eq('staff_id', staffId)
      .gte('start_time', `${date}T00:00:00`)
      .lte('start_time', `${date}T23:59:59`)
      .in('status', ['confirmed', 'in_progress'])
      .order('start_time')

    const totalMinutes = (todayAppts ?? []).reduce((s: number, a: { service?: { duration?: number } }) => {
      return s + ((a.service as any)?.duration ?? 0)
    }, 0)

    const fatigueScore = Math.min(1, totalMinutes / 480)

    const suggestion = {
      staff_id:        staffId,
      date,
      fatigue_score:   fatigueScore,
      recommended_break_at: fatigueScore > 0.6 ? '14:00' : '13:00',
      max_appointments:     fatigueScore > 0.7 ? 6 : 8,
      reasons: [
        fatigueScore > 0.7 ? 'High workload today — recommend reducing by 2 appointments' : null,
        totalMinutes > 360 ? 'Over 6 hours of service time — mandatory break recommended' : null,
      ].filter(Boolean),
    }

    return { data: suggestion, error: null }
  },

  // ── AI Chat Handler ──────────────────────────────────────────
  async processChat(message: string, history: import('@/types/modules').ChatMessage[]): Promise<ApiResponse<string>> {
    const gemini = await getGeminiClient()
    
    if (gemini) {
      try {
        const historyContext = history.map(h => `${h.role}: ${h.content}`).join('\n')
        const prompt = `You are a helpful AI assistant for LuxSalon. 
Salon Info: Open Mon-Sat 9AM-8PM. Services start from $25. Loyalty program: 1 point per $1. Gold+ members get 10% off.
Chat History:
${historyContext}
User: ${message}
Respond in a friendly, concise, and helpful tone:`
        
        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        })
        return { data: response.text || 'Sorry, I could not understand.', error: null }
      } catch (err: any) {
        return { data: null, error: err.message }
      }
    }

    // Fallback logic if no Gemini key
    const lower = message.toLowerCase()
    const intents: Record<string, RegExp> = {
      booking:     /book|appoint|schedule|reserve/i,
      cancel:      /cancel|reschedule|change/i,
      price:       /price|cost|how much|charges/i,
      queue:       /queue|wait|how long|position/i,
      hours:       /open|close|hours|timing/i,
      services:    /service|offer|what do|available/i,
      loyalty:     /points|loyalty|tier|reward/i,
    }

    let detectedIntent = 'general'
    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(lower)) { detectedIntent = intent; break }
    }

    const responses: Record<string, string> = {
      booking:  'I\'d be happy to help you book an appointment! Please tell me: 1) Which service? 2) Preferred date & time? 3) Any staff preference?',
      cancel:   'To cancel or reschedule your appointment, I\'ll need your booking reference or the date of your appointment. Can you provide that?',
      price:    'Our services start from $25. Prices vary based on service, time of day, and your loyalty tier. Gold/Platinum members get 10% off. Would you like a specific service quote?',
      queue:    'I can check the current queue for you. Right now we have 8 customers waiting with an estimated wait of ~35 minutes. Would you like to join the digital queue?',
      hours:    'We\'re open Monday–Saturday 9AM–8PM, Sunday 10AM–6PM. Holiday hours may vary.',
      services: 'We offer: Hair Cutting & Styling, Color & Balayage, Beard Grooming, Facials & Skin Care, Nail Art, Spa Treatments, and Premium Packages. Which interests you?',
      loyalty:  'You earn 1 point per $1 spent. Bronze (0pts) → Silver (500) → Gold (2000) → Platinum (5000). Gold+ members get 10% off every visit!',
      general:  'I\'m your LuxSalon AI assistant. I can help you book appointments, check prices, view the queue, or answer any questions about our services. How can I help you today?',
    }

    return { data: responses[detectedIntent] ?? responses.general, error: null }
  },
}
