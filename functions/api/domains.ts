import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest) {
  try {
    const { action, userId, domain, domains } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    switch (action) {
      case 'getDomains':
        return await getDomains(userId);
      
      case 'addDomain':
        if (!domain) {
          return NextResponse.json({ error: 'Domain data is required' }, { status: 400 });
        }
        return await addDomain(userId, domain);
      
      case 'updateDomain':
        if (!domain) {
          return NextResponse.json({ error: 'Domain data is required' }, { status: 400 });
        }
        return await updateDomain(userId, domain);
      
      case 'deleteDomain':
        if (!domain?.id) {
          return NextResponse.json({ error: 'Domain ID is required' }, { status: 400 });
        }
        return await deleteDomain(userId, domain.id);
      
      case 'bulkUpdate':
        if (!domains) {
          return NextResponse.json({ error: 'Domains data is required' }, { status: 400 });
        }
        return await bulkUpdateDomains(userId, domains);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Domain API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getDomains(userId: string) {
  try {
    const result = await (globalThis as any).env.DB.prepare(
      'SELECT * FROM domains WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();

    return NextResponse.json({ 
      success: true, 
      domains: result.results || [] 
    });
  } catch (error) {
    console.error('Error getting domains:', error);
    return NextResponse.json({ error: 'Failed to get domains' }, { status: 500 });
  }
}

async function addDomain(userId: string, domain: Omit<Domain, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const result = await (globalThis as any).env.DB.prepare(`
      INSERT INTO domains (
        id, user_id, domain_name, registrar, purchase_date, purchase_cost,
        renewal_cost, renewal_cycle, renewal_count, next_renewal_date,
        expiry_date, status, estimated_value, sale_date, sale_price,
        platform_fee, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, userId, domain.domain_name, domain.registrar, domain.purchase_date,
      domain.purchase_cost, domain.renewal_cost, domain.renewal_cycle,
      domain.renewal_count, domain.next_renewal_date || null,
      domain.expiry_date || null, domain.status, domain.estimated_value,
      domain.sale_date || null, domain.sale_price || null,
      domain.platform_fee || null, JSON.stringify(domain.tags),
      now, now
    ).run();

    return NextResponse.json({ 
      success: true, 
      domain: { ...domain, id, user_id: userId, created_at: now, updated_at: now }
    });
  } catch (error) {
    console.error('Error adding domain:', error);
    return NextResponse.json({ error: 'Failed to add domain' }, { status: 500 });
  }
}

async function updateDomain(userId: string, domain: Domain) {
  try {
    const now = new Date().toISOString();
    
    const result = await (globalThis as any).env.DB.prepare(`
      UPDATE domains SET
        domain_name = ?, registrar = ?, purchase_date = ?, purchase_cost = ?,
        renewal_cost = ?, renewal_cycle = ?, renewal_count = ?, next_renewal_date = ?,
        expiry_date = ?, status = ?, estimated_value = ?, sale_date = ?,
        sale_price = ?, platform_fee = ?, tags = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(
      domain.domain_name, domain.registrar, domain.purchase_date, domain.purchase_cost,
      domain.renewal_cost, domain.renewal_cycle, domain.renewal_count,
      domain.next_renewal_date || null, domain.expiry_date || null,
      domain.status, domain.estimated_value, domain.sale_date || null,
      domain.sale_price || null, domain.platform_fee || null,
      JSON.stringify(domain.tags), now, domain.id, userId
    ).run();

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Domain not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      domain: { ...domain, updated_at: now }
    });
  } catch (error) {
    console.error('Error updating domain:', error);
    return NextResponse.json({ error: 'Failed to update domain' }, { status: 500 });
  }
}

async function deleteDomain(userId: string, domainId: string) {
  try {
    const result = await (globalThis as any).env.DB.prepare(
      'DELETE FROM domains WHERE id = ? AND user_id = ?'
    ).bind(domainId, userId).run();

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Domain not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting domain:', error);
    return NextResponse.json({ error: 'Failed to delete domain' }, { status: 500 });
  }
}

async function bulkUpdateDomains(userId: string, domains: Domain[]) {
  try {
    const now = new Date().toISOString();
    
    // 使用事务来确保数据一致性
    const statements = domains.map(domain => 
      (globalThis as any).env.DB.prepare(`
        UPDATE domains SET
          domain_name = ?, registrar = ?, purchase_date = ?, purchase_cost = ?,
          renewal_cost = ?, renewal_cycle = ?, renewal_count = ?, next_renewal_date = ?,
          expiry_date = ?, status = ?, estimated_value = ?, sale_date = ?,
          sale_price = ?, platform_fee = ?, tags = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(
        domain.domain_name, domain.registrar, domain.purchase_date, domain.purchase_cost,
        domain.renewal_cost, domain.renewal_cycle, domain.renewal_count,
        domain.next_renewal_date || null, domain.expiry_date || null,
        domain.status, domain.estimated_value, domain.sale_date || null,
        domain.sale_price || null, domain.platform_fee || null,
        JSON.stringify(domain.tags), now, domain.id, userId
      )
    );

    await (globalThis as any).env.DB.batch(statements);

    return NextResponse.json({ 
      success: true, 
      domains: domains.map(d => ({ ...d, updated_at: now }))
    });
  } catch (error) {
    console.error('Error bulk updating domains:', error);
    return NextResponse.json({ error: 'Failed to bulk update domains' }, { status: 500 });
  }
}