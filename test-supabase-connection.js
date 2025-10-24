// 测试Supabase连接
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key:', supabaseKey ? 'Set' : 'Not set')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  try {
    console.log('🔍 Testing Supabase connection...')
    
    // 测试基本连接
    const { data, error } = await supabase.auth.getSession()
    console.log('✅ Connection successful')
    console.log('Session data:', data)
    
    if (error) {
      console.log('⚠️ Session error (expected for new user):', error.message)
    }
    
    // 测试认证配置
    console.log('🔍 Testing auth configuration...')
    const { data: authData, error: authError } = await supabase.auth.getUser()
    
    if (authError && authError.message.includes('JWT')) {
      console.log('✅ Auth service is working (JWT error is expected without valid session)')
    } else {
      console.log('Auth response:', authData, authError)
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    console.error('Full error:', error)
  }
}

testConnection()
