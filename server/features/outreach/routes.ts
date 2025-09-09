import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { outreachService } from './services/outreach.service';
import { batchGeneratorService } from './services/batch-generator.service';
import { 
  insertEmailActivitySchema,
  insertUserOutreachPreferencesSchema 
} from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Track email activity
router.post('/api/outreach/track-email', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Validate request body
    const schema = z.object({
      contactId: z.number(),
      companyId: z.number(),
      subject: z.string(),
      content: z.string(),
      senderEmail: z.string().email(),
      recipientEmail: z.string().email(),
      emailType: z.enum(['manual', 'campaign', 'daily_outreach']).optional()
    });

    const data = schema.parse(req.body);

    const activity = await outreachService.trackEmailActivity(userId, data);
    
    res.json({ success: true, activity });
  } catch (error: any) {
    console.error('Error tracking email:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to track email activity' });
  }
});

// Update contact status
router.post('/api/outreach/contact-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    const schema = z.object({
      contactId: z.number(),
      status: z.enum(['uncontacted', 'emailed', 'skipped']),
      emailActivity: z.object({
        companyId: z.number(),
        subject: z.string(),
        content: z.string(),
        senderEmail: z.string().email(),
        recipientEmail: z.string().email()
      }).optional()
    });

    const data = schema.parse(req.body);

    const contact = await outreachService.updateContactStatus(userId, data);
    
    res.json({ success: true, contact });
  } catch (error: any) {
    console.error('Error updating contact status:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update contact status' });
  }
});

// Skip company
router.post('/api/outreach/skip-company', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    const schema = z.object({
      companyId: z.number(),
      reason: z.enum(['not_fit', 'not_now']),
      skipUntilDate: z.string().optional() // ISO date string
    });

    const data = schema.parse(req.body);
    
    const skipData = {
      companyId: data.companyId,
      reason: data.reason,
      skipUntilDate: data.skipUntilDate ? new Date(data.skipUntilDate) : undefined
    };

    const company = await outreachService.skipCompany(userId, skipData);
    
    res.json({ success: true, company });
  } catch (error: any) {
    console.error('Error skipping company:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to skip company' });
  }
});

// Get available contacts for outreach
router.get('/api/outreach/available-contacts', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 5;

    const result = await outreachService.getAvailableContacts(userId, limit);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting available contacts:', error);
    res.status(500).json({ error: 'Failed to get available contacts' });
  }
});

// Get user outreach preferences
router.get('/api/outreach/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const preferences = await outreachService.getUserPreferences(userId);
    
    res.json(preferences || {
      enabled: false,
      schedule: { days: ['mon', 'tue', 'wed'], time: '09:00' },
      timezone: 'America/New_York',
      emailsPerBatch: 5,
      includeSearchPrompts: true,
      sendUrgentReminders: true
    });
  } catch (error) {
    console.error('Error getting preferences:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// Update user outreach preferences
router.put('/api/outreach/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    const schema = z.object({
      enabled: z.boolean().optional(),
      schedule: z.object({
        days: z.array(z.string()),
        time: z.string()
      }).optional(),
      timezone: z.string().optional(),
      emailsPerBatch: z.number().min(1).max(20).optional(),
      includeSearchPrompts: z.boolean().optional(),
      sendUrgentReminders: z.boolean().optional()
    });

    const data = schema.parse(req.body);

    const preferences = await outreachService.updateUserPreferences(userId, data);
    
    res.json(preferences);
  } catch (error: any) {
    console.error('Error updating preferences:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Generate outreach batch manually (for testing)
router.post('/api/outreach/generate-batch', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Get available contacts
    const result = await outreachService.getAvailableContacts(userId, 5);
    
    if (result.contacts.length === 0) {
      return res.status(400).json({ 
        error: 'No contacts available for outreach',
        needsMoreContacts: true,
        suggestedSearchPrompts: result.suggestedSearchPrompts
      });
    }

    // Generate emails
    const contactIds = result.contacts.map(c => c.id);
    const emails = await batchGeneratorService.generateEmails(userId, contactIds);

    // Create batch
    const token = await outreachService.createOutreachBatch({
      userId,
      contactIds,
      emails,
      scheduledFor: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    
    res.json({ 
      success: true, 
      token,
      contactCount: emails.length,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  } catch (error) {
    console.error('Error generating batch:', error);
    res.status(500).json({ error: 'Failed to generate batch' });
  }
});

// Public route: Get batch by token (no auth required)
router.get('/outreach/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const batch = await outreachService.getBatchByToken(token);
    
    if (!batch) {
      return res.status(404).send('Outreach batch not found or expired');
    }

    // Check if expired
    if (new Date() > new Date(batch.expiresAt!)) {
      return res.status(410).send('This outreach batch has expired');
    }

    // Render a simple HTML page for now (will be replaced with React component)
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Outreach - 5Ducks</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: #f7f7f7;
            padding: 30px;
            border-bottom: 1px solid #e1e1e1;
          }
          .header h1 {
            color: #333;
            margin-bottom: 10px;
          }
          .header p {
            color: #666;
          }
          .email-section {
            padding: 30px;
          }
          .email-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          label {
            font-weight: 600;
            color: #333;
            font-size: 14px;
          }
          input, textarea {
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 16px;
            font-family: inherit;
          }
          textarea {
            min-height: 200px;
            resize: vertical;
          }
          .buttons {
            display: flex;
            gap: 10px;
            margin-top: 20px;
          }
          button {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
          }
          .btn-send {
            background: #667eea;
            color: white;
            flex: 1;
          }
          .btn-send:hover {
            background: #5a67d8;
          }
          .btn-skip {
            background: #f3f4f6;
            color: #666;
          }
          .btn-skip:hover {
            background: #e5e7eb;
          }
          .company-info {
            background: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #666;
          }
          .company-info strong {
            color: #333;
          }
          .status {
            text-align: center;
            padding: 20px;
            background: #f0fdf4;
            color: #166534;
            border-radius: 6px;
            margin: 20px;
            display: none;
          }
          .status.show {
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Daily Outreach</h1>
            <p>Review and send your personalized email</p>
          </div>
          <div class="email-section">
            <div class="status" id="status"></div>
            <div id="emailContainer">
              <!-- Emails will be loaded here -->
            </div>
          </div>
        </div>
        <script>
          const batchData = ${JSON.stringify(batch)};
          let currentIndex = 0;
          
          function loadEmail(index) {
            const email = batchData.emails[index];
            if (!email) {
              document.getElementById('emailContainer').innerHTML = '<p>All emails processed!</p>';
              return;
            }
            
            document.getElementById('emailContainer').innerHTML = \`
              <div class="company-info">
                <strong>\${email.companyName}</strong><br>
                Contact: \${email.recipientName} (\${email.recipientEmail})
              </div>
              <form class="email-form" onsubmit="sendEmail(event)">
                <div class="form-group">
                  <label>To:</label>
                  <input type="email" value="\${email.recipientEmail}" readonly>
                </div>
                <div class="form-group">
                  <label>Subject:</label>
                  <input type="text" id="subject" value="\${email.subject}" required>
                </div>
                <div class="form-group">
                  <label>Message:</label>
                  <textarea id="content" required>\${email.content}</textarea>
                </div>
                <div class="buttons">
                  <button type="submit" class="btn-send">Send Email</button>
                  <button type="button" class="btn-skip" onclick="skipEmail()">Skip</button>
                </div>
              </form>
            \`;
          }
          
          function sendEmail(event) {
            event.preventDefault();
            // In production, this would send the email
            showStatus('Email sent successfully!');
            currentIndex++;
            setTimeout(() => {
              hideStatus();
              loadEmail(currentIndex);
            }, 2000);
          }
          
          function skipEmail() {
            showStatus('Skipped');
            currentIndex++;
            setTimeout(() => {
              hideStatus();
              loadEmail(currentIndex);
            }, 1000);
          }
          
          function showStatus(message) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.classList.add('show');
          }
          
          function hideStatus() {
            document.getElementById('status').classList.remove('show');
          }
          
          // Load first email
          loadEmail(0);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error loading batch:', error);
    res.status(500).send('Failed to load outreach batch');
  }
});

// Public route: Process email from batch
router.post('/outreach/:token/send', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { contactId, action } = req.body;

    await outreachService.updateBatchStatus(
      token,
      contactId,
      action as 'emailed' | 'skipped'
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error processing batch action:', error);
    res.status(500).json({ error: 'Failed to process action' });
  }
});

import { registerStreakRoutes } from './streak-routes';
import { registerStrategyCheckRoutes } from './strategy-check-route';
import { registerProductsRoutes } from './products-route';

export function registerOutreachRoutes(app: any) {
  app.use(router);
  
  // Also register streak routes
  registerStreakRoutes(app);
  
  // Also register strategy check routes
  registerStrategyCheckRoutes(app);
  
  // Also register products routes
  registerProductsRoutes(app);
}