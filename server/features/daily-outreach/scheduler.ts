import * as cron from 'node-cron';
import { DailyOutreachService } from './service';
import { storage } from '../../storage';

export class DailyOutreachScheduler {
  private static cronJob: cron.ScheduledTask | null = null;
  
  /**
   * Initialize the daily outreach scheduler
   * Runs at 9:00 AM on Monday, Tuesday, and Wednesday
   */
  static start() {
    // Schedule for 9:00 AM on Mon (1), Tue (2), Wed (3)
    // Cron format: minute hour day-of-month month day-of-week
    const cronExpression = '0 9 * * 1,2,3'; // 9:00 AM on Mon, Tue, Wed
    
    console.log('[Daily Outreach Scheduler] Starting scheduler for 9:00 AM on Mon/Tue/Wed');
    
    this.cronJob = cron.schedule(cronExpression, async () => {
      console.log('[Daily Outreach Scheduler] Running daily outreach generation at', new Date().toISOString());
      await this.generateDailyOutreachForAllUsers();
    }, {
      timezone: "America/New_York" // Adjust timezone as needed
    });
    
    console.log('[Daily Outreach Scheduler] Scheduler initialized successfully');
    
    // Also run immediately if it's a scheduled day and after 9 AM
    this.checkAndRunIfNeeded();
  }
  
  /**
   * Stop the scheduler
   */
  static stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[Daily Outreach Scheduler] Scheduler stopped');
    }
  }
  
  /**
   * Check if we should run the scheduler now (for catch-up)
   */
  static async checkAndRunIfNeeded() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();
    
    // Check if it's a scheduled day (Mon=1, Tue=2, Wed=3)
    const isScheduledDay = [1, 2, 3].includes(day);
    
    // Check if it's after 9 AM
    const isAfter9AM = hour >= 9;
    
    if (isScheduledDay && isAfter9AM) {
      console.log('[Daily Outreach Scheduler] Running catch-up generation for today');
      await this.generateDailyOutreachForAllUsers();
    }
  }
  
  /**
   * Generate daily outreach tokens for all active users
   */
  private static async generateDailyOutreachForAllUsers() {
    try {
      console.log('[Daily Outreach Scheduler] Starting daily outreach generation for all users');
      
      // Get all users with daily outreach enabled
      // Import necessary database modules
      const { drizzle } = await import('drizzle-orm/neon-serverless');
      const { Pool } = await import('@neondatabase/serverless');
      const { users: usersTable } = await import('../../../shared/schema');
      
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const db = drizzle(pool);
      const users = await db.select().from(usersTable);
      
      for (const user of users) {
        try {
          // Get user preferences
          const preferences = await storage.getDailyOutreachPreferences(user.id);
          
          // Skip if daily outreach is not enabled
          if (!preferences?.enabled) {
            console.log(`[Daily Outreach Scheduler] Skipping user ${user.id} - daily outreach not enabled`);
            continue;
          }
          
          // Check if user is on vacation (if vacationMode is implemented)
          // TODO: Add vacation mode support when added to preferences schema
          
          // Check if token already exists for today
          const existingToken = await this.checkExistingTokenForToday(user.id);
          if (existingToken) {
            console.log(`[Daily Outreach Scheduler] Token already exists for user ${user.id} today`);
            continue;
          }
          
          // Get uncontacted contacts for the user
          const contacts = await storage.getUncontactedContacts(user.id, 5);
          
          if (contacts.length === 0) {
            console.log(`[Daily Outreach Scheduler] No contacts available for user ${user.id}`);
            continue;
          }
          
          // Generate token for today's outreach
          const contactIds = contacts.map(c => c.id);
          const token = await DailyOutreachService.createOutreachToken(user.id, contactIds);
          
          // Store the token with today's date
          await this.storeTodaysToken(user.id, token);
          
          console.log(`[Daily Outreach Scheduler] Generated token for user ${user.id}: ${token}`);
          
          // Optional: Send email notification to user
          // Default to true if not specified
          const sendNotification = true; // TODO: Add emailNotifications to preferences
          if (sendNotification) {
            await this.sendOutreachNotification(user, token);
          }
          
        } catch (error) {
          console.error(`[Daily Outreach Scheduler] Error processing user ${user.id}:`, error);
        }
      }
      
      console.log('[Daily Outreach Scheduler] Daily outreach generation completed');
      
    } catch (error) {
      console.error('[Daily Outreach Scheduler] Error in generateDailyOutreachForAllUsers:', error);
    }
  }
  
  /**
   * Check if a token already exists for today
   */
  private static async checkExistingTokenForToday(userId: number): Promise<string | null> {
    try {
      const Database = (await import('@replit/database')).default;
      const db = new Database();
      
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const key = `daily_outreach_token_${userId}_${today}`;
      
      const value = await db.get(key);
      return value ? String(value) : null;
    } catch (error) {
      console.error('[Daily Outreach Scheduler] Error checking existing token:', error);
      return null;
    }
  }
  
  /**
   * Store today's token
   */
  private static async storeTodaysToken(userId: number, token: string) {
    try {
      const Database = (await import('@replit/database')).default;
      const db = new Database();
      
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const key = `daily_outreach_token_${userId}_${today}`;
      
      // Store with 24 hour expiry
      await db.set(key, token);
      
      // Also store in a list for quick access
      const listKey = `daily_outreach_tokens_${today}`;
      const existingTokens = await db.get(listKey);
      const tokens = existingTokens ? JSON.parse(String(existingTokens)) : [];
      tokens.push({ userId, token });
      await db.set(listKey, tokens);
      
    } catch (error) {
      console.error('[Daily Outreach Scheduler] Error storing token:', error);
    }
  }
  
  /**
   * Send email notification about daily outreach
   */
  private static async sendOutreachNotification(user: any, token: string) {
    try {
      // Check if SendGrid is configured
      if (!process.env.SENDGRID_API_KEY) {
        console.log('[Daily Outreach Scheduler] SendGrid not configured, skipping email notification');
        return;
      }
      
      const sgMail = await import('@sendgrid/mail');
      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
      
      const baseUrl = process.env.BASE_URL || 'https://5ducks.com';
      const outreachUrl = `${baseUrl}/outreach/${token}`;
      
      const msg = {
        to: user.email,
        from: 'outreach@5ducks.com', // Make sure this is verified in SendGrid
        subject: '🚀 Your Daily Outreach is Ready!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Good morning!</h2>
            <p>Your daily outreach emails are ready to send.</p>
            <p>You have 5 new prospects waiting for your personalized messages.</p>
            <div style="margin: 30px 0;">
              <a href="${outreachUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Start Today's Outreach
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Remember: The best time to reach prospects is between 9-11 AM their local time.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              You're receiving this because you have daily outreach enabled.<br>
              <a href="${baseUrl}/account" style="color: #3b82f6;">Manage preferences</a>
            </p>
          </div>
        `,
        text: `
Good morning!

Your daily outreach emails are ready to send.
You have 5 new prospects waiting for your personalized messages.

Start Today's Outreach: ${outreachUrl}

Remember: The best time to reach prospects is between 9-11 AM their local time.

---
You're receiving this because you have daily outreach enabled.
Manage preferences: ${baseUrl}/account
        `
      };
      
      await sgMail.default.send(msg);
      console.log(`[Daily Outreach Scheduler] Email notification sent to user ${user.id}`);
      
    } catch (error) {
      console.error('[Daily Outreach Scheduler] Error sending email notification:', error);
    }
  }
}