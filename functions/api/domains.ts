// Cloudflare Pages API Route for Domains using D1 Database
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
      // Get all domains from D1 database
      const domains = await env.DB.prepare(
        "SELECT * FROM domains ORDER BY created_at DESC"
      ).all();
      
      return new Response(JSON.stringify(domains), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
    
    if (request.method === 'POST') {
      const data = await request.json();
      
      // Insert new domain into D1 database
      const result = await env.DB.prepare(
        "INSERT INTO domains (domain_name, registrar, purchase_date, purchase_cost, renewal_cost, status, estimated_value, tags, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        data.domain_name,
        data.registrar || '',
        data.purchase_date || new Date().toISOString().split('T')[0],
        data.purchase_cost || 0,
        data.renewal_cost || 0,
        data.status || 'active',
        data.estimated_value || 0,
        JSON.stringify(data.tags || []),
        data.owner_user_id || '1' // Mock user ID for demo
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
    
    if (request.method === 'PUT') {
      const data = await request.json();
      
      // Update domain in D1 database
      const result = await env.DB.prepare(
        "UPDATE domains SET domain_name = ?, registrar = ?, purchase_date = ?, purchase_cost = ?, renewal_cost = ?, status = ?, estimated_value = ?, tags = ? WHERE id = ?"
      ).bind(
        data.domain_name,
        data.registrar,
        data.purchase_date,
        data.purchase_cost,
        data.renewal_cost,
        data.status,
        data.estimated_value,
        JSON.stringify(data.tags || []),
        data.id
      ).run();
      
      return new Response(JSON.stringify({ 
        success: true, 
        changes: result.meta.changes 
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
    
    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const domainId = url.searchParams.get('id');
      
      if (!domainId) {
        return new Response(JSON.stringify({ error: 'Domain ID required' }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }
      
      // Delete domain from D1 database
      const result = await env.DB.prepare(
        "DELETE FROM domains WHERE id = ?"
      ).bind(domainId).run();
      
      return new Response(JSON.stringify({ 
        success: true, 
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