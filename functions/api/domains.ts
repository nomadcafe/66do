// Cloudflare Pages Function for domains API

interface Domain {
  id: string;
  domain_name: string;
  registrar: string;
  purchase_date: string;
  purchase_cost: number;
  renewal_cost: number;
  renewal_cycle: number;
  renewal_count: number;
  next_renewal_date?: string;
  expiry_date?: string;
  status: 'active' | 'for_sale' | 'sold' | 'expired';
  estimated_value: number;
  sale_date?: string;
  sale_price?: number;
  platform_fee?: number;
  tags: string[];
  user_id: string;
  created_at: string;
  updated_at: string;
}

export async function onRequest(context: any) {
  const { request, env } = context;
  
  try {
    const { action, userId, domain, domains } = await request.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get D1 database from environment
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database not available' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'getDomains':
        return await getDomains(db, userId);
      
      case 'addDomain':
        if (!domain) {
          return new Response(JSON.stringify({ error: 'Domain data is required' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await addDomain(db, userId, domain);
      
      case 'updateDomain':
        if (!domain) {
          return new Response(JSON.stringify({ error: 'Domain data is required' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await updateDomain(db, userId, domain);
      
      case 'deleteDomain':
        if (!domain?.id) {
          return new Response(JSON.stringify({ error: 'Domain ID is required' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await deleteDomain(db, userId, domain.id);
      
      case 'bulkUpdateDomains':
        if (!domains || !Array.isArray(domains)) {
          return new Response(JSON.stringify({ error: 'Domains array is required' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await bulkUpdateDomains(db, userId, domains);
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Domain API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function getDomains(db: any, userId: string) {
  try {
    const result = await db.prepare(
      'SELECT * FROM domains WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: result.results 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting domains:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to get domains' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function addDomain(db: any, userId: string, domain: Omit<Domain, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  try {
    const id = Date.now().toString();
    const now = new Date().toISOString();
    
    const result = await db.prepare(`
      INSERT INTO domains (
        id, user_id, domain_name, registrar, purchase_date, purchase_cost,
        renewal_cost, renewal_cycle, renewal_count, next_renewal_date,
        expiry_date, status, estimated_value, sale_date, sale_price,
        platform_fee, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, userId, domain.domain_name, domain.registrar, domain.purchase_date,
      domain.purchase_cost, domain.renewal_cost, domain.renewal_cycle,
      domain.renewal_count, domain.next_renewal_date, domain.expiry_date,
      domain.status, domain.estimated_value, domain.sale_date, domain.sale_price,
      domain.platform_fee, JSON.stringify(domain.tags), now, now
    ).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      id: result.meta.last_row_id 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error adding domain:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to add domain' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function updateDomain(db: any, userId: string, domain: Domain) {
  try {
    const now = new Date().toISOString();
    
    const result = await db.prepare(`
      UPDATE domains SET 
        domain_name = ?, registrar = ?, purchase_date = ?, purchase_cost = ?,
        renewal_cost = ?, renewal_cycle = ?, renewal_count = ?, next_renewal_date = ?,
        expiry_date = ?, status = ?, estimated_value = ?, sale_date = ?,
        sale_price = ?, platform_fee = ?, tags = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(
      domain.domain_name, domain.registrar, domain.purchase_date, domain.purchase_cost,
      domain.renewal_cost, domain.renewal_cycle, domain.renewal_count, domain.next_renewal_date,
      domain.expiry_date, domain.status, domain.estimated_value, domain.sale_date,
      domain.sale_price, domain.platform_fee, JSON.stringify(domain.tags), now,
      domain.id, userId
    ).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      changes: result.meta.changes 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating domain:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to update domain' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function deleteDomain(db: any, userId: string, domainId: string) {
  try {
    const result = await db.prepare(
      'DELETE FROM domains WHERE id = ? AND user_id = ?'
    ).bind(domainId, userId).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      changes: result.meta.changes 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting domain:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to delete domain' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function bulkUpdateDomains(db: any, userId: string, domains: Domain[]) {
  try {
    const now = new Date().toISOString();
    let successCount = 0;
    
    for (const domain of domains) {
      await db.prepare(`
        UPDATE domains SET 
          domain_name = ?, registrar = ?, purchase_date = ?, purchase_cost = ?,
          renewal_cost = ?, renewal_cycle = ?, renewal_count = ?, next_renewal_date = ?,
          expiry_date = ?, status = ?, estimated_value = ?, sale_date = ?,
          sale_price = ?, platform_fee = ?, tags = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(
        domain.domain_name, domain.registrar, domain.purchase_date, domain.purchase_cost,
        domain.renewal_cost, domain.renewal_cycle, domain.renewal_count, domain.next_renewal_date,
        domain.expiry_date, domain.status, domain.estimated_value, domain.sale_date,
        domain.sale_price, domain.platform_fee, JSON.stringify(domain.tags), now,
        domain.id, userId
      ).run();
      successCount++;
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      updated: successCount 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error bulk updating domains:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to bulk update domains' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}