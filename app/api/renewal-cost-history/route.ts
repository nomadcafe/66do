import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, getCorsHeadersForError } from '../../../src/lib/cors';
import { getAuthInfoFromRequest } from '../../../src/lib/auth-helper';
import { createAuthenticatedSupabaseClient } from '../../../src/lib/supabaseAuthClient';
import { CONSTANTS } from '../../../src/lib/constants';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EXCHANGE_RATE = 1000;
const MIN_EXCHANGE_RATE = 0.0001;

function clampNumber(value: unknown, max: number, min = 0): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function clampString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

type SanitizedRenewalPayload = {
  renewal_date: string;
  renewal_cost: number;
  currency: string;
  exchange_rate: number;
  base_amount: number;
  renewal_cycle: number;
  registrar: string | null;
  notes: string | null;
};

function sanitizeRenewalCostPayload(body: Record<string, unknown>): SanitizedRenewalPayload | null {
  const renewalDate = typeof body.renewal_date === 'string' ? body.renewal_date.trim().slice(0, 10) : '';
  if (!DATE_REGEX.test(renewalDate)) return null;

  const renewalCost = clampNumber(body.renewal_cost, CONSTANTS.VALIDATION.MAX_RENEWAL_COST);
  if (renewalCost === null) return null;

  const exchangeRate =
    clampNumber(body.exchange_rate, MAX_EXCHANGE_RATE, MIN_EXCHANGE_RATE) ?? 1;
  const baseAmount =
    clampNumber(body.base_amount, CONSTANTS.VALIDATION.MAX_RENEWAL_COST) ?? renewalCost;
  const renewalCycle =
    Math.max(1, Math.min(CONSTANTS.VALIDATION.MAX_RENEWAL_CYCLE, Math.floor(Number(body.renewal_cycle) || 1)));

  const rawCurrency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';
  const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'USD';

  return {
    renewal_date: renewalDate,
    renewal_cost: renewalCost,
    currency,
    exchange_rate: exchangeRate,
    base_amount: baseAmount,
    renewal_cycle: renewalCycle,
    registrar: clampString(body.registrar, CONSTANTS.VALIDATION.MAX_REGISTRAR_LENGTH),
    notes: clampString(body.notes, CONSTANTS.VALIDATION.MAX_NOTES_LENGTH),
  };
}

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
    const domainId = typeof body?.domain_id === 'string' ? body.domain_id.trim() : '';
    if (!domainId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400, headers: corsHeaders }
      );
    }

    const sanitized = sanitizeRenewalCostPayload(body);
    if (!sanitized) {
      return NextResponse.json(
        { error: 'Invalid renewal cost data' },
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
      .eq('id', domainId)
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
        domain_id: domainId,
        ...sanitized,
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
