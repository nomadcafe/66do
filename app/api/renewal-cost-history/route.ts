import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../src/lib/supabase';
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors';

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  
  try {
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get('domain_id');

    if (!domainId) {
      return NextResponse.json(
        { error: 'Domain ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 验证用户身份
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    // 验证域名是否属于当前用户
    const { data: domain, error: domainError } = await supabase
      .from('domains')
      .select('id, user_id')
      .eq('id', domainId)
      .eq('user_id', session.user.id)
      .single();

    if (domainError || !domain) {
      return NextResponse.json(
        { error: 'Domain not found or access denied' },
        { status: 403, headers: corsHeaders }
      );
    }

    // 获取续费成本历史（通过RLS策略自动过滤）
    const { data: renewalHistory, error } = await supabase
      .from('renewal_cost_history')
      .select('*')
      .eq('domain_id', domainId)
      .order('renewal_date', { ascending: false });

    if (error) {
      console.error('Error fetching renewal cost history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch renewal cost history' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { 
        success: true, 
        data: renewalHistory || [] 
      },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in renewal cost history API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: getCorsHeadersForError() }
    );
  }
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  
  try {
    const body = await request.json();
    const { domain_id, renewal_date, renewal_cost, currency, exchange_rate, base_amount, renewal_cycle, registrar, notes } = body;

    if (!domain_id || !renewal_date || !renewal_cost) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 验证用户身份
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    // 验证域名是否属于当前用户
    const { data: domain, error: domainError } = await supabase
      .from('domains')
      .select('id, user_id')
      .eq('id', domain_id)
      .eq('user_id', session.user.id)
      .single();

    if (domainError || !domain) {
      return NextResponse.json(
        { error: 'Domain not found or access denied' },
        { status: 403, headers: corsHeaders }
      );
    }

    // 创建续费成本历史记录
    const { data, error } = await supabase
      .from('renewal_cost_history')
      .insert({
        domain_id,
        renewal_date,
        renewal_cost,
        currency: currency || 'USD',
        exchange_rate: exchange_rate || 1,
        base_amount: base_amount || renewal_cost,
        renewal_cycle: renewal_cycle || 1,
        registrar: registrar || null,
        notes: notes || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating renewal cost history:', error);
      return NextResponse.json(
        { error: 'Failed to create renewal cost history' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { 
        success: true, 
        data 
      },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error in renewal cost history POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: getCorsHeadersForError() }
    );
  }
}
