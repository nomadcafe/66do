export async function onRequestPost(context: any) {
  const { request, env } = context;
  
  try {
    const { email, verificationCode, language = 'en' } = await request.json();
    
    // 使用 Cloudflare Email Workers 发送邮件
    const emailResponse = await fetch('https://66do-email-worker.metadomain.workers.dev/send-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        verificationCode,
        language
      })
    });
    
    if (!emailResponse.ok) {
      console.error('Email Worker failed:', emailResponse.status, await emailResponse.text());
      return new Response(JSON.stringify({ 
        success: false, 
        message: '邮件服务暂时不可用，请稍后重试' 
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    const result = await emailResponse.json();
    
    if (result.success) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: '验证码已发送到您的邮箱' 
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    } else {
      console.error('Email Worker error:', result);
      return new Response(JSON.stringify({ 
        success: false, 
        message: '邮件发送失败，请重试' 
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
  } catch (error) {
    console.error('Email sending error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: '服务器错误，请稍后重试' 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
