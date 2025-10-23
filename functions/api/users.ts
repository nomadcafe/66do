// D1数据库用户管理API
import { D1Database } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
}

interface User {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export async function onRequest(context: any) {
  const { request, env } = context;
  const DB = env.DB;

  // 设置CORS头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // 处理预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // 检查D1数据库绑定
  if (!DB) {
    console.error('D1 database binding not found');
    return new Response(JSON.stringify({ 
      error: 'Database not available',
      details: 'D1 database binding is not configured'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { action, email, user } = body;

    switch (action) {
      case 'getUser':
        return await getUser(DB, email, corsHeaders);
      
      case 'saveUser':
        return await saveUser(DB, user, corsHeaders);
      
      case 'updateUser':
        return await updateUser(DB, user, corsHeaders);
      
      case 'updateUserEmailVerification':
        return await updateUserEmailVerification(DB, email, body.email_verified, corsHeaders);
      
      case 'deleteUser':
        return await deleteUser(DB, email, corsHeaders);
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// 获取用户
async function getUser(DB: D1Database, email: string, corsHeaders: Record<string, string>) {
  try {
    const stmt = DB.prepare('SELECT * FROM users WHERE email = ?');
    const result = await stmt.bind(email).first();
    
    return new Response(JSON.stringify({ 
      success: true, 
      user: result 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get user error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to get user' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// 保存用户
async function saveUser(DB: D1Database, user: User, corsHeaders: Record<string, string>) {
  try {
    // 检查用户是否已存在
    const existingUser = await DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(user.email)
      .first();

    if (existingUser) {
      // 更新现有用户
      const stmt = DB.prepare(`
        UPDATE users 
        SET password_hash = ?, email_verified = ?, updated_at = ?
        WHERE email = ?
      `);
      await stmt.bind(
        user.password_hash,
        user.email_verified,
        new Date().toISOString(),
        user.email
      ).run();
    } else {
      // 创建新用户
      const stmt = DB.prepare(`
        INSERT INTO users (id, email, password_hash, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      await stmt.bind(
        user.id,
        user.email,
        user.password_hash,
        user.email_verified,
        user.created_at,
        user.updated_at
      ).run();
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'User saved successfully' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Save user error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to save user' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// 更新用户
async function updateUser(DB: D1Database, user: User, corsHeaders: Record<string, string>) {
  try {
    const stmt = DB.prepare(`
      UPDATE users 
      SET email = ?, password_hash = ?, email_verified = ?, updated_at = ?
      WHERE id = ?
    `);
    
    await stmt.bind(
      user.email,
      user.password_hash,
      user.email_verified,
      new Date().toISOString(),
      user.id
    ).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'User updated successfully' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Update user error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to update user' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// 更新用户邮箱验证状态
async function updateUserEmailVerification(DB: D1Database, email: string, emailVerified: boolean, corsHeaders: Record<string, string>) {
  try {
    const stmt = DB.prepare(`
      UPDATE users 
      SET email_verified = ?, updated_at = ?
      WHERE email = ?
    `);
    
    await stmt.bind(
      emailVerified,
      new Date().toISOString(),
      email
    ).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Email verification status updated successfully' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Update email verification error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to update email verification status' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// 删除用户
async function deleteUser(DB: D1Database, email: string, corsHeaders: Record<string, string>) {
  try {
    const stmt = DB.prepare('DELETE FROM users WHERE email = ?');
    await stmt.bind(email).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'User deleted successfully' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to delete user' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
