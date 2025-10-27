// 调试Supabase连接问题
const { createClient } = require('@supabase/supabase-js');

// 检查环境变量
console.log('Environment Variables:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present' : 'Missing');

// 创建Supabase客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 测试连接
async function testConnection() {
  try {
    console.log('\nTesting Supabase connection...');
    
    // 测试基本连接
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth user:', user ? 'Authenticated' : 'Not authenticated');
    if (authError) console.log('Auth error:', authError);
    
    // 测试表访问
    console.log('\nTesting table access...');
    
    // 测试domains表
    const { data: domains, error: domainsError } = await supabase
      .from('domains')
      .select('count')
      .limit(1);
    
    console.log('Domains table access:', domainsError ? 'Error' : 'Success');
    if (domainsError) {
      console.log('Domains error:', domainsError);
    }
    
    // 测试domain_transactions表
    const { data: transactions, error: transactionsError } = await supabase
      .from('domain_transactions')
      .select('count')
      .limit(1);
    
    console.log('Transactions table access:', transactionsError ? 'Error' : 'Success');
    if (transactionsError) {
      console.log('Transactions error:', transactionsError);
    }
    
    // 测试RLS状态
    console.log('\nTesting RLS status...');
    const { data: rlsData, error: rlsError } = await supabase
      .rpc('get_rls_status');
    
    if (rlsError) {
      console.log('RLS status check failed:', rlsError);
    } else {
      console.log('RLS status:', rlsData);
    }
    
  } catch (error) {
    console.error('Connection test failed:', error);
  }
}

testConnection();
