const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createPasswordResetTokensTable() {
  try {
    console.log('Creating password_reset_tokens table...')
    
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- 创建密码重置令牌表
        CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL,
            token TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            used_at TIMESTAMP WITH TIME ZONE NULL
        );

        -- 创建索引以提高查询性能
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON public.password_reset_tokens(email);
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

        -- 添加行级安全策略
        ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

        -- 创建策略：允许插入和查询重置令牌
        DROP POLICY IF EXISTS "Users can insert their own reset tokens" ON public.password_reset_tokens;
        CREATE POLICY "Users can insert their own reset tokens" ON public.password_reset_tokens
            FOR INSERT WITH CHECK (true);

        DROP POLICY IF EXISTS "Users can view their own reset tokens" ON public.password_reset_tokens;
        CREATE POLICY "Users can view their own reset tokens" ON public.password_reset_tokens
            FOR SELECT USING (true);

        -- 创建清理过期令牌的函数
        CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
        RETURNS void AS $$
        BEGIN
            DELETE FROM public.password_reset_tokens 
            WHERE expires_at < NOW();
        END;
        $$ LANGUAGE plpgsql;
      `
    })

    if (error) {
      console.error('Error creating table:', error)
      return false
    }

    console.log('✅ password_reset_tokens table created successfully!')
    return true
  } catch (error) {
    console.error('Error:', error)
    return false
  }
}

async function main() {
  console.log('Setting up password reset functionality...')
  
  const success = await createPasswordResetTokensTable()
  
  if (success) {
    console.log('🎉 Password reset table setup completed!')
    console.log('You can now use the password reset functionality.')
  } else {
    console.log('❌ Failed to setup password reset table')
    console.log('Please run the SQL manually in your Supabase Dashboard:')
    console.log('1. Go to SQL Editor in Supabase Dashboard')
    console.log('2. Copy and paste the SQL from supabase-migrations/001_create_password_reset_tokens.sql')
    console.log('3. Execute the SQL')
  }
}

main()
