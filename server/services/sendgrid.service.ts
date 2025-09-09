import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
if (!process.env.SENDGRID_API_KEY) {
  console.error('SENDGRID_API_KEY environment variable is not set');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface EmailData {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface OutreachNotificationData {
  to: string;
  from: string;
  userName?: string;
  contactCount: number;
  batchToken: string;
  searchPrompts?: string[];
  isUrgent: boolean;
}

export class SendGridService {
  private static instance: SendGridService;
  private defaultSender = 'notifications@5ducks.com'; // You'll need to verify this domain in SendGrid

  static getInstance(): SendGridService {
    if (!SendGridService.instance) {
      SendGridService.instance = new SendGridService();
    }
    return SendGridService.instance;
  }

  /**
   * Send a basic email
   */
  async sendEmail(data: EmailData): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('Cannot send email: SENDGRID_API_KEY not configured');
      return false;
    }

    try {
      await sgMail.send({
        to: data.to,
        from: data.from || this.defaultSender,
        subject: data.subject,
        text: data.text,
        html: data.html,
      });
      console.log(`Email sent successfully to ${data.to}`);
      return true;
    } catch (error: any) {
      console.error('SendGrid email error:', error);
      if (error.response) {
        console.error('SendGrid response error:', error.response.body);
      }
      return false;
    }
  }

  /**
   * Send daily outreach notification email
   */
  async sendOutreachNotification(data: OutreachNotificationData): Promise<boolean> {
    const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
    
    const outreachUrl = `${baseUrl}/outreach/${data.batchToken}`;
    
    let emailContent: { subject: string; html: string; text: string };

    if (data.isUrgent) {
      // Urgent reminder when running low on contacts
      emailContent = this.generateUrgentReminderEmail(data, outreachUrl);
    } else {
      // Regular daily outreach email
      emailContent = this.generateDailyOutreachEmail(data, outreachUrl);
    }

    return this.sendEmail({
      to: data.to,
      from: data.from || this.defaultSender,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  }

  /**
   * Generate regular daily outreach email content
   */
  private generateDailyOutreachEmail(data: OutreachNotificationData, outreachUrl: string) {
    const subject = `🚀 Your ${data.contactCount} Daily Leads Are Ready`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: white; padding: 30px; border: 1px solid #e1e1e1; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 14px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .button:hover { background: #5a67d8; }
          .contact-preview { background: #f7f7f7; padding: 15px; border-radius: 6px; margin: 10px 0; }
          .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Your Daily Leads Are Ready!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div class="content">
            <p>Hi${data.userName ? ` ${data.userName}` : ''},</p>
            
            <p><strong>${data.contactCount} qualified contacts</strong> are ready for your outreach today. Each one has:</p>
            <ul>
              <li>✅ Verified email address</li>
              <li>✅ Personalized email message</li>
              <li>✅ Company context and role information</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${outreachUrl}" class="button">Start Today's Outreach →</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              <strong>Quick tip:</strong> Today's batch expires in 24 hours. Click the link above to review and send your personalized emails. You can edit each message before sending.
            </p>
          </div>
          <div class="footer">
            <p>You're receiving this because you have daily outreach enabled.<br>
            <a href="${outreachUrl}" style="color: #667eea;">Manage preferences</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Your ${data.contactCount} Daily Leads Are Ready!

Hi${data.userName ? ` ${data.userName}` : ''},

${data.contactCount} qualified contacts are ready for your outreach today.

Start Today's Outreach: ${outreachUrl}

Each contact includes:
- Verified email address
- Personalized email message
- Company context and role information

This batch expires in 24 hours.
    `;

    return { subject, html, text };
  }

  /**
   * Generate urgent reminder email content
   */
  private generateUrgentReminderEmail(data: OutreachNotificationData, outreachUrl: string) {
    const subject = `⚠️ Action Needed: Add More Leads to Your Pipeline`;
    
    const searchPromptsHtml = data.searchPrompts && data.searchPrompts.length > 0 
      ? `
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-weight: 600; color: #92400e;">💡 Suggested searches to find more leads:</p>
          <ul style="margin: 10px 0; color: #92400e;">
            ${data.searchPrompts.map(prompt => `<li>${prompt}</li>`).join('')}
          </ul>
        </div>
      `
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: white; padding: 30px; border: 1px solid #e1e1e1; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 14px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .button:hover { background: #dc2626; }
          .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">⚠️ Your Lead Pipeline Is Running Low</h1>
          </div>
          <div class="content">
            <p>Hi${data.userName ? ` ${data.userName}` : ''},</p>
            
            <p><strong>You're running low on contacts for your daily outreach.</strong> To keep your sales momentum going, you need to add more qualified leads to your pipeline.</p>
            
            ${searchPromptsHtml}
            
            <div style="text-align: center;">
              <a href="${outreachUrl}" class="button">Search for More Leads →</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              <strong>Why this matters:</strong> Consistent daily outreach is key to building your sales pipeline. Without new contacts, your outreach will pause.
            </p>
          </div>
          <div class="footer">
            <p>Keep your pipeline full to maintain consistent growth.<br>
            <a href="${outreachUrl}" style="color: #ef4444;">Open 5Ducks</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
⚠️ Your Lead Pipeline Is Running Low

Hi${data.userName ? ` ${data.userName}` : ''},

You're running low on contacts for your daily outreach. To keep your sales momentum going, you need to add more qualified leads to your pipeline.

${data.searchPrompts && data.searchPrompts.length > 0 
  ? `Suggested searches to find more leads:\n${data.searchPrompts.map(p => `- ${p}`).join('\n')}\n`
  : ''}

Search for More Leads: ${outreachUrl}

Why this matters: Consistent daily outreach is key to building your sales pipeline.
    `;

    return { subject, html, text };
  }

  /**
   * Send test email to verify configuration
   */
  async sendTestEmail(to: string): Promise<boolean> {
    return this.sendEmail({
      to,
      from: this.defaultSender,
      subject: '✅ 5Ducks Email Notifications Active',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Email notifications are configured successfully!</h2>
          <p>You'll receive daily outreach reminders according to your schedule preferences.</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This is a test email from 5Ducks to confirm your email configuration is working.
          </p>
        </div>
      `,
      text: 'Email notifications are configured successfully! You\'ll receive daily outreach reminders according to your schedule preferences.'
    });
  }
}

export const sendGridService = SendGridService.getInstance();