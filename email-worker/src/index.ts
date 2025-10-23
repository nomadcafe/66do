export interface Env {
  FROM_EMAIL: string;
  APP_NAME: string;
  RESEND_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.method === 'POST' && url.pathname === '/send-verification') {
      try {
        const { email, verificationCode, language = 'en' } = await request.json();
        
        // 根据语言生成邮件内容
        const isChinese = language === 'zh';
        
        const emailContent = {
          subject: isChinese ? `${env.APP_NAME} 账户验证码` : `${env.APP_NAME} Account Verification Code`,
          html: isChinese ? `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${env.APP_NAME} 账户验证</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #2563eb; font-size: 28px;">${env.APP_NAME}</h1>
                    <h2 style="color: #374151; font-size: 20px;">账户验证码</h2>
                </div>
                
                <div style="background-color: #f9fafb; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
                    <p style="font-size: 16px; margin: 0 0 20px 0;">您好！</p>
                    <p style="font-size: 16px; margin: 0 0 20px 0;">您的验证码是：</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="font-size: 36px; font-weight: bold; color: #2563eb; background-color: #eff6ff; padding: 20px 40px; border-radius: 12px; display: inline-block; border: 2px solid #dbeafe;">
                            ${verificationCode}
                        </span>
                    </div>
                    <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                        验证码有效期为 10 分钟。
                    </p>
                </div>
                
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; color: #6b7280; font-size: 12px;">
                    <p style="margin: 0 0 10px 0;">如果您没有请求此验证码，请忽略此邮件。</p>
                    <p style="margin: 0;">此邮件由 ${env.APP_NAME} 系统自动发送，请勿回复。</p>
                </div>
            </body>
            </html>
          ` : `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${env.APP_NAME} Account Verification</title>
            </head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #2563eb; font-size: 28px;">${env.APP_NAME}</h1>
                    <h2 style="color: #374151; font-size: 20px;">Account Verification Code</h2>
                </div>
                
                <div style="background-color: #f9fafb; padding: 30px; border-radius: 12px; margin-bottom: 20px;">
                    <p style="font-size: 16px; margin: 0 0 20px 0;">Hello!</p>
                    <p style="font-size: 16px; margin: 0 0 20px 0;">Your verification code is:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="font-size: 36px; font-weight: bold; color: #2563eb; background-color: #eff6ff; padding: 20px 40px; border-radius: 12px; display: inline-block; border: 2px solid #dbeafe;">
                            ${verificationCode}
                        </span>
                    </div>
                    <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                        This code will expire in 10 minutes.
                    </p>
                </div>
                
                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; color: #6b7280; font-size: 12px;">
                    <p style="margin: 0 0 10px 0;">If you didn't request this code, please ignore this email.</p>
                    <p style="margin: 0;">This email was sent automatically by ${env.APP_NAME} system, please do not reply.</p>
                </div>
            </body>
            </html>
          `,
          text: isChinese ? `
            ${env.APP_NAME} 账户验证码
            
            您的验证码是：${verificationCode}
            
            验证码有效期为 10 分钟。
            
            如果您没有请求此验证码，请忽略此邮件。
          ` : `
            ${env.APP_NAME} Account Verification Code
            
            Your verification code is: ${verificationCode}
            
            This code will expire in 10 minutes.
            
            If you didn't request this code, please ignore this email.
          `
        };

        const emailData = {
          from: env.FROM_EMAIL,
          to: email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        };

        // 使用 Resend API 发送邮件（简单易用）
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.FROM_EMAIL,
            to: [email],
            subject: `${env.APP_NAME} 账户验证码`,
            html: emailData.html,
            text: emailData.text
          })
        });

        if (!resendResponse.ok) {
          const errorData = await resendResponse.json();
          console.error('Resend API error:', errorData);
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

        const resendResult = await resendResponse.json();
        console.log('Email sent successfully via Resend:', resendResult);
        
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
        
      } catch (error) {
        console.error('Email sending error:', error);
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
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
