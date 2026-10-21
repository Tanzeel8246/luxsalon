import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const email = 'customer@luxsalon.com'
  const password = 'password123'
  
  console.log(`Creating test customer: ${email}`)

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'Test Customer', role: 'customer' }
  })

  if (authError && authError.message !== 'User already registered') {
    throw authError
  }

  let user = authData?.user
  if (!user) {
    const { data: { users } } = await supabase.auth.admin.listUsers()
    user = users.find(u => u.email === email)
  }

  if (user) {
    await supabase.from('customers').upsert({
      user_id: user.id,
      name: 'Test Customer',
      email: email,
      phone: '1234567890'
    }, { onConflict: 'user_id' })
    console.log('Customer created/verified successfully!')
  }
}

run()
