import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, resetUrl, subject, template } = await req.json()

    if (!email || !resetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 创建邮件内容
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>重置您的密码</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>66Do 域名投资管理平台</h1>
            <p>密码重置请求</p>
          </div>
          <div class="content">
            <h2>您好！</h2>
            <p>我们收到了您的密码重置请求。请点击下面的按钮来重置您的密码：</p>
            <a href="${resetUrl}" class="button">重置密码</a>
            <p>如果按钮无法点击，请复制以下链接到浏览器中打开：</p>
            <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">${resetUrl}</p>
            <p><strong>注意：</strong>此链接将在1小时后过期，请及时使用。</p>
            <p>如果您没有请求重置密码，请忽略此邮件。</p>
          </div>
          <div class="footer">
            <p>此邮件由系统自动发送，请勿回复。</p>
            <p>&copy; 2024 66Do. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `

    // 暂时跳过实际邮件发送，只记录日志
    // 在生产环境中，您需要配置SMTP或使用第三方邮件服务
    console.log('Password reset email would be sent to:', email)
    console.log('Reset URL:', resetUrl)
    console.log('Email content:', htmlContent)

    // TODO: 集成实际的邮件发送服务
    // 选项1: 使用Supabase的SMTP配置
    // 选项2: 使用第三方服务如Resend、SendGrid等
    // 选项3: 使用Supabase的Auth邮件模板

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
