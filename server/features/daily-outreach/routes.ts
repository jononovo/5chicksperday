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
      
      res.json(preferences || {
        enabled: true,
        schedule: { days: ["Monday", "Tuesday", "Wednesday"], time: "09:00" },
        contactsPerDay: 5,
        timezone: "America/New_York"
      });
    } catch (error) {
      console.error('Error getting preferences:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get preferences' 
      });
    }
  });
}