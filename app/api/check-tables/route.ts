import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../src/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // 设置CORS头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    // 检查所有必要的表是否存在
    const tables = ['users', 'domains', 'domain_transactions', 'verification_tokens']
    const tableStatus = {}

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1)

        if (error) {
          tableStatus[table] = { exists: false, error: error.message }
        } else {
          tableStatus[table] = { exists: true, count: data?.length || 0 }
        }
      } catch (err) {
        tableStatus[table] = { exists: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Table check completed',
      tables: tableStatus
    }, { 
      headers: corsHeaders
    })

  } catch (error) {
    return NextResponse.json({ 
      success: false,
      error: 'Table check failed',
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
