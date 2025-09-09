import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { emailActivities, contacts, companies, dailyOutreachBatches, strategicProfiles } from '../../../shared/schema';
import { and, eq, gte, lte, not, isNull, inArray } from 'drizzle-orm';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, format } from 'date-fns';

const router = Router();

// Get streak data
router.get('/api/outreach/streak', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Get all email activities for the user to calculate streak
    const activities = await db.execute<{ date: string; count: number }>(sql`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM email_activities
      WHERE user_id = ${userId}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) DESC
    `);

    // Calculate current streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate: Date | null = null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const activity of activities.rows) {
      const activityDate = new Date(activity.date);
      activityDate.setHours(0, 0, 0, 0);
      
      if (!lastDate) {
        // First activity
        tempStreak = 1;
        const daysDiff = differenceInDays(today, activityDate);
        if (daysDiff <= 1) {
          currentStreak = 1;
        }
      } else {
        const daysDiff = differenceInDays(lastDate, activityDate);
        if (daysDiff === 1) {
          tempStreak++;
          if (currentStreak > 0 || differenceInDays(today, activityDate) <= 1) {
            currentStreak = tempStreak;
          }
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
          if (currentStreak === 0 && differenceInDays(today, activityDate) <= 1) {
            currentStreak = 1;
          }
        }
      }
      lastDate = activityDate;
    }
    
    longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

    res.json({
      currentStreak,
      longestStreak,
      lastOutreachDate: activities[0]?.date || null,
      totalDaysActive: activities.length,
    });
  } catch (error) {
    console.error('Error fetching streak data:', error);
    res.status(500).json({ error: 'Failed to fetch streak data' });
  }
});

// Get outreach statistics
router.get('/api/outreach/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Get available contacts and companies
    const availableContacts = await db.select({ count: sql<number>`COUNT(*)` })
      .from(contacts)
      .where(and(
        eq(contacts.userId, userId),
        not(isNull(contacts.email))
      ));

    const availableCompanies = await db.select({ count: sql<number>`COUNT(DISTINCT ${contacts.companyId})` })
      .from(contacts)
      .where(and(
        eq(contacts.userId, userId),
        not(isNull(contacts.email))
      ));

    // Get this week's stats
    const weekStats = await db.execute<{ contactsEmailed: number; companiesReached: number; emailsSent: number }>(sql`
      SELECT 
        COUNT(DISTINCT ea.contact_id) as "contactsEmailed",
        COUNT(DISTINCT c.company_id) as "companiesReached",
        COUNT(*) as "emailsSent"
      FROM email_activities ea
      LEFT JOIN contacts c ON ea.contact_id = c.id
      WHERE ea.user_id = ${userId}
        AND ea.created_at >= ${weekStart}
        AND ea.created_at <= ${weekEnd}
    `);

    // Get this month's stats
    const monthStats = await db.execute<{ contactsEmailed: number; companiesReached: number; emailsSent: number }>(sql`
      SELECT 
        COUNT(DISTINCT ea.contact_id) as "contactsEmailed",
        COUNT(DISTINCT c.company_id) as "companiesReached",
        COUNT(*) as "emailsSent"
      FROM email_activities ea
      LEFT JOIN contacts c ON ea.contact_id = c.id
      WHERE ea.user_id = ${userId}
        AND ea.created_at >= ${monthStart}
        AND ea.created_at <= ${monthEnd}
    `);

    // Get all time stats
    const allTimeStats = await db.select({
      contactsEmailed: sql<number>`COUNT(DISTINCT ${emailActivities.contactId})`,
      companiesReached: sql<number>`COUNT(DISTINCT ${contacts.companyId})`,
      emailsSent: sql<number>`COUNT(*)`,
    })
    .from(emailActivities)
    .leftJoin(contacts, eq(emailActivities.contactId, contacts.id))
    .where(eq(emailActivities.userId, userId));

    const contactCount = availableContacts[0]?.count || 0;
    const companyCount = availableCompanies[0]?.count || 0;

    res.json({
      available: {
        companies: companyCount,
        contacts: contactCount,
        needsMore: contactCount < 20, // Alert if less than 20 contacts
      },
      thisWeek: {
        companiesReached: weekStats.rows[0]?.companiesReached || 0,
        contactsEmailed: weekStats.rows[0]?.contactsEmailed || 0,
        emailsSent: weekStats.rows[0]?.emailsSent || 0,
        responses: 0, // Placeholder for now
      },
      thisMonth: {
        companiesReached: monthStats.rows[0]?.companiesReached || 0,
        contactsEmailed: monthStats.rows[0]?.contactsEmailed || 0,
        emailsSent: monthStats.rows[0]?.emailsSent || 0,
        responses: 0, // Placeholder for now
      },
      allTime: {
        companiesReached: allTimeStats[0]?.companiesReached || 0,
        contactsEmailed: allTimeStats[0]?.contactsEmailed || 0,
        emailsSent: allTimeStats[0]?.emailsSent || 0,
        responses: 0, // Placeholder for now
      },
    });
  } catch (error) {
    console.error('Error fetching outreach stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get user preferences
router.get('/api/outreach/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Get or create default preferences from KV store
    const kv = (global as any).kv;
    const prefsKey = `outreach_prefs_${userId}`;
    let preferences = await kv.get(prefsKey);
    
    if (!preferences) {
      // Default preferences
      preferences = {
        enabled: true,
        schedule: {
          days: ['monday', 'tuesday', 'wednesday'],
          time: '09:00',
        },
        timezone: 'America/New_York',
        emailsPerBatch: 5,
        vacationMode: {
          enabled: false,
          startDate: null,
          endDate: null,
        },
      };
      await kv.set(prefsKey, preferences);
    }
    
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update user preferences
router.put('/api/outreach/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const updates = req.body;
    
    // Get current preferences
    const kv = (global as any).kv;
    const prefsKey = `outreach_prefs_${userId}`;
    let preferences = await kv.get(prefsKey) || {
      enabled: true,
      schedule: {
        days: ['monday', 'tuesday', 'wednesday'],
        time: '09:00',
      },
      timezone: 'America/New_York',
      emailsPerBatch: 5,
      vacationMode: {
        enabled: false,
        startDate: null,
        endDate: null,
      },
    };
    
    // Merge updates
    preferences = { ...preferences, ...updates };
    
    // Save updated preferences
    await kv.set(prefsKey, preferences);
    
    res.json({ success: true, preferences });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get today's batch
router.get('/api/outreach/today', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Get today's batch
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const batch = await db.execute<any>(sql`
      SELECT * FROM daily_outreach_batches
      WHERE user_id = ${userId}
        AND created_at >= ${today}
        AND created_at < ${tomorrow}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (!batch.rows[0]) {
      res.json(null);
      return;
    }
    
    // Get contact details
    const contactIds = batch.rows[0].contact_ids as number[];
    const contactDetails = await db.select({
      id: contacts.id,
      name: contacts.name,
      role: contacts.role,
      email: contacts.email,
      companyId: contacts.companyId,
    })
    .from(contacts)
    .where(inArray(contacts.id, contactIds));
    
    // Get company names
    const companyIds = Array.from(new Set(contactDetails.map(c => c.companyId)));
    const companyNames = await db.select({
      id: companies.id,
      name: companies.name,
    })
    .from(companies)
    .where(inArray(companies.id, companyIds));
    
    const companyMap = new Map(companyNames.map(c => [c.id, c.name]));
    
    const contactsWithCompanies = contactDetails.map(contact => ({
      id: String(contact.id),
      name: contact.name || 'Unknown',
      role: contact.role || '',
      email: contact.email || '',
      companyName: companyMap.get(contact.companyId) || 'Unknown Company',
    }));
    
    res.json({
      batchId: batch.rows[0].id,
      token: batch.rows[0].token,
      createdAt: batch.rows[0].created_at,
      contacts: contactsWithCompanies,
      emailsSent: batch.rows[0].status === 'sent' ? contactsWithCompanies.length : 0,
      status: batch.rows[0].status,
    });
  } catch (error) {
    console.error('Error fetching today\'s batch:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s batch' });
  }
});

// Preview HTML email endpoint
router.get('/outreach/:token/preview', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    // Get batch by token
    const batch = await db.select()
      .from(dailyOutreachBatches)
      .where(eq(dailyOutreachBatches.token, token))
      .limit(1);
    
    if (!batch[0]) {
      res.status(404).send('Batch not found');
      return;
    }
    
    // Get the email content from KV store
    const kv = (global as any).kv;
    const emailKey = `batch_emails_${batch[0].id}`;
    const emails = await kv.get(emailKey);
    
    if (!emails || !emails[0]) {
      res.status(404).send('Email content not found');
      return;
    }
    
    // Return the first email as HTML preview
    const emailContent = emails[0].content || emails[0].body || 'No content available';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Preview - 5Ducks</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .email-container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            border-bottom: 2px solid #e1e1e1;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            margin: 0;
            color: #333;
            font-size: 24px;
          }
          .meta {
            color: #666;
            font-size: 14px;
            margin-top: 10px;
          }
          .content {
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e1e1e1;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>📧 Email Preview</h1>
            <div class="meta">
              Generated by 5Ducks Daily Outreach Engine<br>
              Batch Token: ${token}
            </div>
          </div>
          <div class="content">${emailContent.replace(/\n/g, '<br>')}</div>
          <div class="footer">
            This is a preview of the email that would be sent to your contacts.
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).send('Failed to generate preview');
  }
});

export function registerStreakRoutes(app: any) {
  app.use(router);
}