import { Router, type Request, type Response } from "express";
import { DailyOutreachService } from "./service";

export function registerDailyOutreachRoutes(app: Router, requireAuth: any) {
  // Check if user has enough contacts for daily outreach
  app.get('/api/daily-outreach/check', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const result = await DailyOutreachService.checkDailyOutreach(userId);
      res.json(result);
    } catch (error) {
      console.error('Error checking daily outreach:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to check daily outreach' 
      });
    }
  });
  
  // Generate token for daily outreach emails
  app.post('/api/daily-outreach/generate-token', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { contactIds } = req.body;
      
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        res.status(400).json({ message: 'Contact IDs are required' });
        return;
      }
      
      const token = await DailyOutreachService.createOutreachToken(userId, contactIds);
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const outreachUrl = `${baseUrl}/outreach/${token}`;
      
      res.json({ 
        token,
        url: outreachUrl
      });
    } catch (error) {
      console.error('Error generating outreach token:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to generate token' 
      });
    }
  });
  
  // Get outreach page data (no auth required - token-based)
  app.get('/api/daily-outreach/page/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        res.status(400).json({ message: 'Token is required' });
        return;
      }
      
      const pageData = await DailyOutreachService.getOutreachPageData(token);
      
      if (!pageData) {
        res.status(404).json({ message: 'Invalid or expired token' });
        return;
      }
      
      res.json(pageData);
    } catch (error) {
      console.error('Error getting outreach page data:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to load outreach page' 
      });
    }
  });
  
  // Send email from outreach page (no auth required - token-based)
  app.post('/api/daily-outreach/send/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { contactId, subject, content } = req.body;
      
      if (!token || !contactId) {
        res.status(400).json({ message: 'Token and contact ID are required' });
        return;
      }
      
      // Verify token and get user ID
      const tokenData = await DailyOutreachService.getTokenData(token);
      if (!tokenData) {
        res.status(404).json({ message: 'Invalid or expired token' });
        return;
      }
      
      // Mark contact as contacted
      await DailyOutreachService.markContactContacted(
        tokenData.userId,
        contactId,
        'sent',
        subject,
        content
      );
      
      // Get next contact in the queue
      const contactIds = tokenData.contactIds as number[];
      const currentIndex = contactIds.indexOf(contactId);
      const nextContactId = contactIds[currentIndex + 1];
      
      if (nextContactId) {
        const nextPageData = await DailyOutreachService.getOutreachPageData(token);
        res.json({ 
          success: true,
          hasNext: true,
          nextContact: nextPageData
        });
      } else {
        res.json({ 
          success: true,
          hasNext: false,
          message: 'All contacts have been processed'
        });
      }
    } catch (error) {
      console.error('Error sending outreach email:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to send email' 
      });
    }
  });
  
  // Skip contact (no auth required - token-based)
  app.post('/api/daily-outreach/skip/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { contactId } = req.body;
      
      if (!token || !contactId) {
        res.status(400).json({ message: 'Token and contact ID are required' });
        return;
      }
      
      // Verify token and get user ID
      const tokenData = await DailyOutreachService.getTokenData(token);
      if (!tokenData) {
        res.status(404).json({ message: 'Invalid or expired token' });
        return;
      }
      
      // Mark contact as skipped
      await DailyOutreachService.markContactContacted(
        tokenData.userId,
        contactId,
        'skipped'
      );
      
      // Get next contact in the queue
      const contactIds = tokenData.contactIds as number[];
      const currentIndex = contactIds.indexOf(contactId);
      const nextContactId = contactIds[currentIndex + 1];
      
      if (nextContactId) {
        const nextPageData = await DailyOutreachService.getOutreachPageData(token);
        res.json({ 
          success: true,
          hasNext: true,
          nextContact: nextPageData
        });
      } else {
        res.json({ 
          success: true,
          hasNext: false,
          message: 'All contacts have been skipped'
        });
      }
    } catch (error) {
      console.error('Error skipping contact:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to skip contact' 
      });
    }
  });
  
  // Update user preferences for daily outreach
  app.post('/api/daily-outreach/preferences', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const preferences = req.body;
      
      await DailyOutreachService.updateOutreachPreferences(userId, preferences);
      
      res.json({ 
        success: true,
        message: 'Preferences updated successfully'
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to update preferences' 
      });
    }
  });
  
  // Get user preferences for daily outreach
  app.get('/api/daily-outreach/preferences', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const preferences = await DailyOutreachService.getPreferences(userId);
      
      // Check if user has completed product setup (has strategic profile)
      const storage = require('../../storage').default;
      let hasProductSetup = false;
      try {
        const profiles = await storage.listStrategicProfiles(userId);
        hasProductSetup = profiles && profiles.length > 0;
      } catch (err) {
        console.log('Error checking strategic profiles:', err);
      }
      
      res.json({
        ...(preferences || {
          enabled: false,
          schedule: { days: ["Monday", "Tuesday", "Wednesday"], time: "09:00" },
          contactsPerDay: 5,
          timezone: "America/New_York"
        }),
        hasProductSetup
      });
    } catch (error) {
      console.error('Error getting preferences:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get preferences' 
      });
    }
  });

  // Mark email as sent
  app.post('/api/daily-outreach/mark-sent', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { contactId, subject, content, emailAddress } = req.body;
      
      if (!contactId || !subject || !content || !emailAddress) {
        res.status(400).json({ message: 'Missing required fields' });
        return;
      }
      
      await DailyOutreachService.markEmailSent(userId, contactId, {
        subject,
        content,
        emailAddress
      });
      
      res.json({ success: true, message: 'Email marked as sent' });
    } catch (error) {
      console.error('Error marking email as sent:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to mark email as sent' 
      });
    }
  });

  // Mark company as skipped
  app.post('/api/daily-outreach/skip-company', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { companyId, reason, notes } = req.body;
      
      if (!companyId || !reason) {
        res.status(400).json({ message: 'Company ID and reason are required' });
        return;
      }
      
      await DailyOutreachService.markCompanyAsSkipped(userId, companyId, reason, notes);
      
      res.json({ success: true, message: 'Company marked as skipped' });
    } catch (error) {
      console.error('Error marking company as skipped:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to mark company as skipped' 
      });
    }
  });

  // Get contact pipeline status  
  app.get('/api/daily-outreach/pipeline', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const stats = await DailyOutreachService.getPipelineStats(userId);
      
      res.json(stats);
    } catch (error) {
      console.error('Error getting contact pipeline:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get contact pipeline' 
      });
    }
  });

  // Check if more contacts are needed
  app.get('/api/daily-outreach/check-availability', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const availability = await DailyOutreachService.checkContactAvailability(userId);
      
      res.json(availability);
    } catch (error) {
      console.error('Error checking contact availability:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to check contact availability' 
      });
    }
  });

  // Get companies ready for follow-up
  app.get('/api/daily-outreach/follow-ups', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const companies = await DailyOutreachService.getFollowUpCompanies(userId);
      
      res.json({ companies });
    } catch (error) {
      console.error('Error getting follow-up companies:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get follow-up companies' 
      });
    }
  });

  // Test endpoint to send a test email via SendGrid
  app.post('/api/daily-outreach/test-sendgrid', requireAuth, async (req: Request, res: Response) => {
    try {
      const { recipientEmail } = req.body;
      
      if (!recipientEmail) {
        return res.status(400).json({
          success: false,
          error: 'Recipient email is required'
        });
      }
      
      // Import modules
      const { EmailTemplateService } = await import('./email-template');
      const sgMail = await import('@sendgrid/mail');
      
      // Check if API key exists
      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({
          success: false,
          error: 'SendGrid API key not configured'
        });
      }
      
      // Generate test email content
      const testEmail = EmailTemplateService.generateTestEmail();
      
      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
      
      const msg = {
        to: recipientEmail,
        from: 'test@5ducks.com', // You'll need to verify this email in SendGrid
        subject: testEmail.subject,
        text: testEmail.text,
        html: testEmail.html
      };
      
      await sgMail.default.send(msg);
      
      res.json({
        success: true,
        message: `Test email sent successfully to ${recipientEmail}`
      });
    } catch (error: any) {
      console.error('[Daily Outreach] SendGrid test error:', error);
      
      // Handle specific SendGrid errors
      if (error.response && error.response.body) {
        return res.status(500).json({
          success: false,
          error: 'SendGrid error',
          details: error.response.body.errors
        });
      }
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send test email'
      });
    }
  });
}