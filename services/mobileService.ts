import { getSupabaseClient } from '@/lib/supabase'
import type { DeviceToken, PushNotification, ApiResponse } from '@/types'

export const mobileService = {
  async registerDevice(
    userId:   string,
    token:    string,
    platform: 'ios' | 'android' | 'web'
  ): Promise<ApiResponse<DeviceToken>> {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('device_tokens')
      .upsert({ user_id: userId, token, platform, is_active: true }, { onConflict: 'user_id,token' })
      .select()
      .single() as any

    if (error) return { data: null, error: error.message }
    return { data, error: null }
  },

  async sendPushNotification(
    userId:  string,
    title:   string,
    body:    string,
    type:    string,
    data:    Record<string, unknown> = {}
  ): Promise<ApiResponse<PushNotification>> {
    const supabase = getSupabaseClient()

    const { data: tokens } = await supabase
      .from('device_tokens')
      .select('token, platform')
      .eq('user_id', userId)
      .eq('is_active', true)

    const { data: notif, error } = await supabase
      .from('push_notifications')
      .insert({ user_id: userId, title, body, type, data, is_read: false, sent_at: new Date().toISOString() })
      .select()
      .single() as any

    if (error) return { data: null, error: error.message }

    // In production: call Firebase FCM or APNs
    // tokens?.forEach(t => sendFCM(t.token, title, body, data))

    return { data: notif, error: null }
  },

  async getUnreadNotifications(userId: string): Promise<ApiResponse<PushNotification[]>> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('push_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    if (error) return { data: null, error: error.message }
    return { data: data ?? [], error: null }
  },

  async markAllRead(userId: string): Promise<void> {
    const supabase = getSupabaseClient()
    await supabase
      .from('push_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
  },

  // PWA manifest data
  getPWAManifest() {
    return {
      name:             'LuxSalon',
      short_name:       'LuxSalon',
      description:      'Smart Salon & Groom Center',
      start_url:        '/',
      display:          'standalone',
      background_color: '#0A0A0A',
      theme_color:      '#D4AF37',
      orientation:      'portrait',
      icons: [
        { src: '/icons/icon-72.png',   sizes: '72x72',   type: 'image/png' },
        { src: '/icons/icon-192.png',  sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png',  sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    }
  },
}
