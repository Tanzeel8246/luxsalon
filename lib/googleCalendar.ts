/**
 * Google Calendar OAuth2 + Sync
 * Replaces the mock `externalId = gcal_${Date.now()}` implementation.
 *
 * Required ENV:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI
 */

import { google, type calendar_v3 } from 'googleapis'
import { createAdminSupabaseClient } from '@/lib/supabaseServer'
import { logger }                    from '@/lib/logger'

const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

// ── OAuth2 Client ─────────────────────────────────────────────────────────────

function makeOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured')
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

// ── Auth Flow ─────────────────────────────────────────────────────────────────

/**
 * Generate OAuth URL — redirect staff to this URL to authorize calendar access.
 */
export function generateAuthUrl(userId: string): string {
  const oAuth2Client = makeOAuthClient()
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',    // Get refresh token
    scope:       SCOPES,
    state:       userId,       // Pass user ID through OAuth flow
    prompt:      'consent',    // Always show consent to get refresh_token
  })
}

/**
 * Exchange authorization code for tokens and save to DB.
 */
export async function handleOAuthCallback(code: string, userId: string): Promise<void> {
  const oAuth2Client = makeOAuthClient()
  const { tokens }   = await oAuth2Client.getToken(code)

  if (!tokens.access_token) {
    throw new Error('Failed to retrieve access token from Google')
  }

  const supabase = createAdminSupabaseClient()
  await (supabase as any).from('integration_configs').upsert({
    provider:      'google_calendar',
    is_enabled:    true,
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at:    tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null,
    config:        { user_id: userId },
    sync_status:   'success',
  }, { onConflict: 'provider' })

  logger.info('Google Calendar connected', { userId })
}

// ── Calendar Operations ───────────────────────────────────────────────────────

async function getAuthorizedClient(): Promise<InstanceType<typeof google.auth.OAuth2> | null> {
  const supabase = createAdminSupabaseClient()
  const { data } = await (supabase as any)
    .from('integration_configs')
    .select('access_token, refresh_token, expires_at')
    .eq('provider', 'google_calendar')
    .eq('is_enabled', true)
    .single()

  if (!data?.access_token) return null

  const client = makeOAuthClient()
  client.setCredentials({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expiry_date:   data.expires_at ? new Date(data.expires_at).getTime() : undefined,
  })

  // Auto-refresh if expired
  client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await (supabase as any).from('integration_configs').update({
        access_token: tokens.access_token,
        expires_at:   tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        sync_status:  'success',
        last_sync:    new Date().toISOString(),
      }).eq('provider', 'google_calendar')
    }
  })

  return client
}

/**
 * Create a Google Calendar event for an appointment.
 * Returns the Google event ID for future updates/deletions.
 */
export async function createCalendarEvent(appointment: {
  id:          string
  start_time:  string
  end_time:    string
  service?:    { name: string }
  staff?:      { name: string }
  customer?:   { name: string; email?: string }
  notes?:      string
  branch?:     { name: string; address?: string }
}): Promise<{ eventId: string; error: null } | { eventId: null; error: string }> {
  const client = await getAuthorizedClient()
  if (!client) return { eventId: null, error: 'Google Calendar not connected' }

  const calendar = google.calendar({ version: 'v3', auth: client })

  const summary     = `${appointment.service?.name ?? 'Appointment'} — ${appointment.customer?.name ?? 'Customer'}`
  const description = [
    `Stylist: ${appointment.staff?.name ?? 'TBD'}`,
    appointment.notes ? `Notes: ${appointment.notes}` : null,
    `Booking ID: ${appointment.id}`,
  ].filter(Boolean).join('\n')

  const event: calendar_v3.Schema$Event = {
    summary,
    description,
    location:  appointment.branch?.address,
    start:     { dateTime: appointment.start_time, timeZone: process.env.DEFAULT_TIMEZONE ?? 'UTC' },
    end:       { dateTime: appointment.end_time,   timeZone: process.env.DEFAULT_TIMEZONE ?? 'UTC' },
    attendees: appointment.customer?.email
      ? [{ email: appointment.customer.email, displayName: appointment.customer.name }]
      : undefined,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup',  minutes: 60 },
        { method: 'email',  minutes: 1440 },   // 24h email reminder
      ],
    },
    colorId:   '11',   // Tomato — matches gold theme somewhat
    extendedProperties: {
      private: {
        luxsalon_appointment_id: appointment.id,
      },
    },
  }

  try {
    const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody: event })

    if (!data.id) throw new Error('No event ID returned')

    // Save sync record
    const supabase = createAdminSupabaseClient()
    await (supabase as any).from('calendar_syncs').upsert({
      appointment_id: appointment.id,
      provider:       'google_calendar',
      external_id:    data.id,
      sync_status:    'success',
      last_synced:    new Date().toISOString(),
    }, { onConflict: 'appointment_id' })

    logger.info('Google Calendar event created', { appointmentId: appointment.id, eventId: data.id })
    return { eventId: data.id, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Calendar error'
    logger.error('Google Calendar create failed', { err: msg })

    await (createAdminSupabaseClient() as any).from('integration_configs').update({
      sync_status: 'error',
      error_msg:   msg,
    }).eq('provider', 'google_calendar')

    return { eventId: null, error: msg }
  }
}

/**
 * Update an existing calendar event.
 */
export async function updateCalendarEvent(
  externalEventId: string,
  updates: Partial<{ start_time: string; end_time: string; status: string }>
): Promise<boolean> {
  const client = await getAuthorizedClient()
  if (!client) return false

  const calendar = google.calendar({ version: 'v3', auth: client })

  try {
    const patch: calendar_v3.Schema$Event = {}

    if (updates.start_time) patch.start = { dateTime: updates.start_time }
    if (updates.end_time)   patch.end   = { dateTime: updates.end_time }
    if (updates.status === 'cancelled') patch.status = 'cancelled'

    await calendar.events.patch({
      calendarId: 'primary',
      eventId:    externalEventId,
      requestBody: patch,
    })

    logger.info('Google Calendar event updated', { eventId: externalEventId })
    return true
  } catch (err) {
    logger.error('Google Calendar update failed', { err })
    return false
  }
}

/**
 * Delete a calendar event when appointment is cancelled.
 */
export async function deleteCalendarEvent(externalEventId: string): Promise<boolean> {
  const client = await getAuthorizedClient()
  if (!client) return false

  const calendar = google.calendar({ version: 'v3', auth: client })

  try {
    await calendar.events.delete({ calendarId: 'primary', eventId: externalEventId })
    logger.info('Google Calendar event deleted', { eventId: externalEventId })
    return true
  } catch (err) {
    logger.error('Google Calendar delete failed', { err })
    return false
  }
}

export function isGoogleCalendarConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}
