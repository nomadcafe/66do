import { NextRequest, NextResponse } from 'next/server'
import { DomainService } from '../../../src/lib/supabaseService'
import { validateDomain, sanitizeDomainData } from '../../../src/lib/validation'
import { supabase } from '../../../src/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, domain, domains } = body

    // 验证用户身份
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const userId = session.user.id;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    switch (action) {
      case 'getDomains':
        const domainList = await DomainService.getDomains(userId)
        return NextResponse.json({ success: true, data: domainList }, { headers: corsHeaders })
      
      case 'addDomain':
        if (!domain) {
          return NextResponse.json({ error: 'Domain data is required' }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        
        // 验证域名数据
        const domainValidation = validateDomain(domain)
        if (!domainValidation.valid) {
          return NextResponse.json({ 
            error: 'Domain validation failed', 
            details: domainValidation.errors 
          }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        
        // 检查域名是否已存在
        const existingDomains = await DomainService.getDomains(userId)
        const domainName = domain.domain_name?.toLowerCase().trim()
        const isDuplicate = existingDomains.some(d => 
          d.domain_name.toLowerCase().trim() === domainName
        )
        
        if (isDuplicate) {
          return NextResponse.json({ 
            error: 'Domain already exists', 
            details: ['This domain name is already in your portfolio']
          }, { 
            status: 409,
            headers: corsHeaders
          })
        }
        
        // 清理和标准化数据
        const sanitizedDomain = sanitizeDomainData(domain)
        const newDomain = await DomainService.createDomain({ 
          ...sanitizedDomain, 
          owner_user_id: userId, // 使用正确的字段名
          id: crypto.randomUUID(), // 生成唯一ID
          domain_name: sanitizedDomain.domain_name as string
        })
        return NextResponse.json({ success: true, data: newDomain }, { headers: corsHeaders })
      
      case 'updateDomain':
        if (!domain) {
          return NextResponse.json({ error: 'Domain data is required' }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        
        // 验证域名数据
        const updateDomainValidation = validateDomain(domain)
        if (!updateDomainValidation.valid) {
          return NextResponse.json({ 
            error: 'Domain validation failed', 
            details: updateDomainValidation.errors 
          }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        
        // 清理和标准化数据
        const sanitizedUpdateDomain = sanitizeDomainData(domain)
        const updatedDomain = await DomainService.updateDomain(domain.id, sanitizedUpdateDomain)
        return NextResponse.json({ success: true, data: updatedDomain }, { headers: corsHeaders })
      
      case 'deleteDomain':
        if (!domain?.id) {
          return NextResponse.json({ error: 'Domain ID is required' }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        const deleteResult = await DomainService.deleteDomain(domain.id)
        return NextResponse.json({ success: deleteResult }, { headers: corsHeaders })
      
      case 'bulkUpdateDomains':
        if (!domains || !Array.isArray(domains)) {
          return NextResponse.json({ error: 'Domains array is required' }, { 
            status: 400,
            headers: corsHeaders
          })
        }
        const bulkResult = await DomainService.bulkUpdateDomains(domains)
        return NextResponse.json({ success: bulkResult }, { headers: corsHeaders })
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { 
          status: 400,
          headers: corsHeaders
        })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })
}
