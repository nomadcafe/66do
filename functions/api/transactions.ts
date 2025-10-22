// Cloudflare Pages API Route for Domain Transactions using D1 Database
import { Env } from '../types';

export async function onRequest(context: any) {
  const { request, env }: { request: Request; env: Env } = context;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const domainId = url.searchParams.get('domain_id');
      
      let query: string;
      let params: string[];
      
      if (domainId) {
        // Get transactions for specific domain
        query = "SELECT * FROM domain_transactions WHERE domain_id = ? ORDER BY date DESC";
        params = [domainId];
      } else {
        // Get all transactions
        query = "SELECT * FROM domain_transactions ORDER BY date DESC";
        params = [];
      }
      
      const transactions = await env.DB.prepare(query).bind(...params).all();
      
      return new Response(JSON.stringify(transactions), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
    
    if (request.method === 'POST') {
      const data = await request.json();
      
      // Insert new transaction into D1 database
      const result = await env.DB.prepare(
        "INSERT INTO domain_transactions (domain_id, type, amount, currency, date, notes, platform, transaction_time, gross_amount, fee_percentage, fee_amount, payment_plan, installment_period, installment_fee_percentage, installment_fee_amount, monthly_payment, total_installment_amount, payment_status, paid_installments, remaining_installments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        data.domain_id,
        data.type,
        data.amount,
        data.currency || 'USD',
        data.date,
        data.notes || '',
        data.platform || '',
        data.transaction_time || new Date().toISOString(),
        data.gross_amount || data.amount,
        data.fee_percentage || 0,
        data.fee_amount || 0,
        data.payment_plan || 'lump_sum',
        data.installment_period || 0,
        data.installment_fee_percentage || 0,
        data.installment_fee_amount || 0,
        data.monthly_payment || 0,
        data.total_installment_amount || data.amount,
        data.payment_status || 'completed',
        data.paid_installments || 0,
        data.remaining_installments || 0
      ).run();
      
      return new Response(JSON.stringify({ 
        success: true, 
        id: result.meta.last_row_id,
        changes: result.meta.changes 
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
    
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
    
  } catch (error) {
    console.error('Database error:', error);
    return new Response(JSON.stringify({ 
      error: 'Database operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });
  }
}
