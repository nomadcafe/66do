import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors';
import { getAuthInfoFromRequest } from '../../../src/lib/auth-helper';
import { createAuthenticatedSupabaseClient } from '../../../src/lib/supabaseAuthClient';

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

    const authInfo = await getAuthInfoFromRequest(request);
    if (!authInfo?.userId || !authInfo.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = authInfo.userId;
    const refreshToken = request.headers.get('X-Refresh-Token') ?? undefined;
    const client = await createAuthenticatedSupabaseClient(authInfo.accessToken, refreshToken);

    // 验证域名是否属于当前用户（使用带 JWT 的客户端，与 RLS 一致）
    const { data: domain, error: domainError } = await client
      .from('domains')
      .select('id, user_id')
      .eq('id', domainId)
      .eq('user_id', userId)
      .single();

    if (domainError || !domain) {
      return NextResponse.json(
        { error: 'Domain not found or access denied' },
        { status: 403, headers: corsHeaders }
      );
    }

    const { data: renewalHistory, error } = await client
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

    const authInfo = await getAuthInfoFromRequest(request);
    if (!authInfo?.userId || !authInfo.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = authInfo.userId;
    const refreshToken = request.headers.get('X-Refresh-Token') ?? undefined;
    const client = await createAuthenticatedSupabaseClient(authInfo.accessToken, refreshToken);

    const { data: domain, error: domainError } = await client
      .from('domains')
      .select('id, user_id')
      .eq('id', domain_id)
      .eq('user_id', userId)
      .single();

    if (domainError || !domain) {
      return NextResponse.json(
        { error: 'Domain not found or access denied' },
        { status: 403, headers: corsHeaders }
      );
    }

    const { data, error } = await client
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
      } as never)
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

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request),
  });
}
