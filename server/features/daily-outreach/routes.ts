import { Router, type Request, type Response } from "express";
import { DailyOutreachService } from "./service";
import { storage } from "../../storage";

export function registerDailyOutreachRoutes(app: Router, requireAuth: any) {
  // Check if user has enough contacts for daily outreach
  app.get('/api/daily-outreach/check', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      
      // Check if today is a scheduled day and auto-generate token if needed
      const now = new Date();
      const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const hour = now.getHours();
      
      // Check if it's a scheduled day (Mon=1, Tue=2, Wed=3)
      const isScheduledDay = [1, 2, 3].includes(day);
      
      if (isScheduledDay) {
        // Check if token already exists for today
        const Database = (await import('@replit/database')).default;
        const db = new Database();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const tokenKey = `daily_outreach_token_${userId}_${today}`;
        const tokenResult = await db.get(tokenKey);
        
        // Check if we have a valid token (not an error object)
        const existingToken = tokenResult && 
                              typeof tokenResult === 'string' ? tokenResult : 
                              (tokenResult && typeof tokenResult === 'object' && !(tokenResult as any).error) ? String(tokenResult) : null;
        
        if (!existingToken) {
          // No token exists for today, generate one
          console.log(`[Daily Outreach] Auto-generating token for user ${userId} on ${today}`);
          
          // Get user preferences to check if enabled
          const preferences = await DailyOutreachService.getPreferences(userId);
          
          if (preferences?.enabled) {
            // Get uncontacted contacts
            const contacts = await storage.getUncontactedContacts(userId, 5);
            
            if (contacts.length > 0) {
              // Generate token
              const contactIds = contacts.map((c: any) => c.id);
              const token = await DailyOutreachService.createOutreachToken(userId, contactIds);
              
              // Store the token for today
              await db.set(tokenKey, token);
              
              // Also store in the list for quick access
              const listKey = `daily_outreach_tokens_${today}`;
              const existingList = await db.get(listKey);
              const tokens = existingList ? JSON.parse(String(existingList)) : [];
              tokens.push({ userId, token });
              await db.set(listKey, JSON.stringify(tokens));
              
              console.log(`[Daily Outreach] Token generated for user ${userId}: ${token}`);
              
              // Add the token to the result
              const result = await DailyOutreachService.checkDailyOutreach(userId);
              return res.json({
                ...result,
                todaysToken: token
              });
            }
          }
        } else {
          // Token exists, include it in the response
          console.log(`[Daily Outreach] Found existing token for user ${userId}: ${existingToken}`);
          
          const result = await DailyOutreachService.checkDailyOutreach(userId);
          return res.json({
            ...result,
            todaysToken: existingToken
          });
        }
      }
      
      // Not a scheduled day or token generation failed, return normal check
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
      
      // Check if user has any strategic profiles (product setup)
      const { storage } = await import('../../storage');
      let hasProductSetup = false;
      try {
        const profiles = await storage.getStrategicProfiles(userId);
        hasProductSetup = profiles && profiles.length > 0;
      } catch (err) {
        console.log('Error checking strategic profiles:', err);
        // Fall back to checking if daily outreach is enabled
        hasProductSetup = preferences?.enabled || false;
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

  // Get test email HTML for preview (used by Preview Today's Email button)
  app.get('/api/daily-outreach/test-email', async (req: Request, res: Response) => {
    try {
      const { EmailTemplateService } = await import('./email-template');
      const testEmail = EmailTemplateService.generateTestEmail();
      
      res.json({
        success: true,
        data: {
          html: testEmail.html,
          subject: testEmail.subject,
          text: testEmail.text
        }
      });
    } catch (error) {
      console.error('[Daily Outreach] Test email generation error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate test email'
      });
    }
  });
  
  // Force-generate today's token (for testing/recovery)
  app.post('/api/daily-outreach/force-generate-today', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      console.log(`[Daily Outreach] Force generating token for user ${userId} on ${today}`);
      
      // Get uncontacted contacts
      const contacts = await storage.getUncontactedContacts(userId, 5);
      
      if (contacts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No contacts available. Please search for contacts first.'
        });
      }
      
      // Generate token
      const contactIds = contacts.map((c: any) => c.id);
      const token = await DailyOutreachService.createOutreachToken(userId, contactIds);
      
      // Store the token for today
      const Database = (await import('@replit/database')).default;
      const db = new Database();
      const tokenKey = `daily_outreach_token_${userId}_${today}`;
      await db.set(tokenKey, token);
      
      // Also store in the list for quick access
      const listKey = `daily_outreach_tokens_${today}`;
      const existingList = await db.get(listKey);
      const tokens = existingList ? JSON.parse(String(existingList)) : [];
      tokens.push({ userId, token });
      await db.set(listKey, JSON.stringify(tokens));
      
      console.log(`[Daily Outreach] Force generated token for user ${userId}: ${token}`);
      
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const outreachUrl = `${baseUrl}/outreach/${token}`;
      
      res.json({
        success: true,
        token,
        url: outreachUrl,
        message: 'Today\'s outreach token has been generated successfully'
      });
    } catch (error) {
      console.error('Error force generating today\'s token:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate today\'s token'
      });
    }
  });
  
  // Generate preview token (bypass scheduling restrictions)
  app.post('/api/daily-outreach/generate-preview-token', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      
      // Get some contacts for preview
      const { storage } = await import('../../storage');
      const contacts = await storage.getUncontactedContacts(userId, 5);
      
      if (contacts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No contacts available. Please search for contacts first.'
        });
      }
      
      const contactIds = contacts.map(c => c.id);
      const token = await DailyOutreachService.createOutreachToken(userId, contactIds);
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const outreachUrl = `${baseUrl}/outreach/${token}`;
      
      res.json({
        success: true,
        token,
        url: outreachUrl
      });
    } catch (error) {
      console.error('Error generating preview token:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate preview token'
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