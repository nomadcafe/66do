// 测试Supabase查询
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQueries() {
  const userId = '46302c05-6666-410f-853d-dcc1382492d9';
  
  console.log('Testing queries for user:', userId);
  
  // 测试1: 基本查询
  console.log('\n1. Testing basic domains query...');
  const { data: domains1, error: error1 } = await supabase
    .from('domains')
    .select('*')
    .eq('owner_user_id', userId);
  
  console.log('Result:', error1 ? 'Error' : 'Success');
  if (error1) console.log('Error:', error1);
  if (domains1) console.log('Count:', domains1.length);
  
  // 测试2: 带排序的查询
  console.log('\n2. Testing domains query with order...');
  const { data: domains2, error: error2 } = await supabase
    .from('domains')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false });
  
  console.log('Result:', error2 ? 'Error' : 'Success');
  if (error2) console.log('Error:', error2);
  if (domains2) console.log('Count:', domains2.length);
  
  // 测试3: 交易查询
  console.log('\n3. Testing transactions query...');
  const { data: transactions, error: error3 } = await supabase
    .from('domain_transactions')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false });
  
  console.log('Result:', error3 ? 'Error' : 'Success');
  if (error3) console.log('Error:', error3);
  if (transactions) console.log('Count:', transactions.length);
  
  // 测试4: 检查表结构
  console.log('\n4. Testing table structure...');
  const { data: tableInfo, error: tableError } = await supabase
    .from('domains')
    .select('*')
    .limit(0);
  
  console.log('Table accessible:', tableError ? 'No' : 'Yes');
  if (tableError) console.log('Table error:', tableError);
}

testQueries().catch(console.error);
