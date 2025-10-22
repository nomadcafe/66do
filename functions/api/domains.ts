// Cloudflare Pages API Route for Domains
export async function onRequest(context: any) {
  const { request, env } = context;
  
  if (request.method === 'GET') {
    // Get domains from D1 database
    const domains = await env.DB.prepare(
      "SELECT * FROM domains WHERE owner_user_id = ?"
    ).bind(context.user?.id).all();
    
    return new Response(JSON.stringify(domains), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (request.method === 'POST') {
    const data = await request.json();
    
    // Insert domain into D1 database
    const result = await env.DB.prepare(
      "INSERT INTO domains (domain_name, purchase_cost, owner_user_id) VALUES (?, ?, ?)"
    ).bind(data.domain_name, data.purchase_cost, context.user?.id).run();
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Method not allowed', { status: 405 });
}
