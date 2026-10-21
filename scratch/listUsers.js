import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) throw error

  console.log('USERS:')
  for (const u of users) {
    console.log(`- ${u.email} (ID: ${u.id})`)
    
    await supabase.auth.admin.updateUserById(u.id, {
      user_metadata: { ...u.user_metadata, role: 'admin' }
    })
    
    await supabase.from('staff').upsert({
      user_id: u.id,
      name: u.email.split('@')[0],
      role: 'admin',
      is_active: true,
      rating: 5.0
    }, { onConflict: 'user_id' })

    await supabase.from('customers').upsert({
      user_id: u.id,
      name: u.email.split('@')[0],
      email: u.email,
      phone: '0000000000'
    }, { onConflict: 'user_id' })
  }
  console.log('All users have been promoted to Admin and added to staff/customers tables.')
}

run()
