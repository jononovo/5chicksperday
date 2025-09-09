import { db } from '../../../db';
import { users, strategicProfiles, contacts, companies } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { outreachService } from './outreach.service';
import { sendGridService } from '../../../services/sendgrid.service';
import type { GeneratedEmail, OutreachBatchData } from '../types';

export class BatchGeneratorService {
  /**
   * Generate personalized emails for contacts
   */
  async generateEmails(
    userId: number,
    contactIds: number[]
  ): Promise<GeneratedEmail[]> {
    // Get user's active strategic profile (or most recent if none active)
    const [profile] = await db.select()
      .from(strategicProfiles)
      .where(eq(strategicProfiles.userId, userId))
      .orderBy(
        desc(strategicProfiles.isActive),
        desc(strategicProfiles.createdAt)
      )
      .limit(1);

    const emails: GeneratedEmail[] = [];

    for (const contactId of contactIds) {
      // Get contact and company details
      const [contactData] = await db.select({
        contact: contacts,
        company: companies
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id))
      .where(eq(contacts.id, contactId))
      .limit(1);

      if (!contactData || !contactData.contact.email) continue;

      // Generate personalized email based on profile and contact
      const email = this.generatePersonalizedEmail(
        {
          ...contactData.contact,
          company: contactData.company
        },
        profile
      );

      emails.push(email);
    }

    return emails;
  }

  /**
   * Generate personalized email content
   */
  private generatePersonalizedEmail(
    contact: any,
    profile: any
  ): GeneratedEmail {
    // Base template that can be customized
    const companyContext = contact.company?.description 
      ? `I noticed ${contact.company.name} ${contact.company.description.slice(0, 100)}...`
      : `I came across ${contact.company?.name || 'your company'}`;

    let subject = `Quick question for ${contact.name.split(' ')[0]}`;
    let content = `Hi ${contact.name.split(' ')[0]},\n\n`;

    if (profile) {
      // Use strategic profile to personalize
      if (profile.productService) {
        content += `${companyContext}\n\n`;
        content += `We help businesses like yours with ${profile.productService}. `;
        
        if (profile.uniqueAttributes?.length > 0) {
          content += `What makes us different is ${profile.uniqueAttributes[0]}.\n\n`;
        }
        
        content += `Would you be open to a brief 15-minute call to see if we could help ${contact.company?.name || 'your team'}?\n\n`;
      } else {
        // Fallback generic template
        content += `${companyContext}\n\n`;
        content += `I wanted to reach out because I believe we might be able to help your team achieve better results.\n\n`;
        content += `Would you have 15 minutes this week for a quick call?\n\n`;
      }
    } else {
      // Generic fallback
      content += `${companyContext}\n\n`;
      content += `I'd love to learn more about your current challenges and see if there's a way we could help.\n\n`;
      content += `Are you available for a brief call this week?\n\n`;
    }

    content += `Best regards,\n[Your Name]`;

    return {
      contactId: contact.id,
      subject,
      content,
      recipientEmail: contact.email,
      recipientName: contact.name,
      companyName: contact.company?.name || 'Unknown Company',
      companyContext
    };
  }

  /**
   * Process daily outreach for all users
   */
  async processDailyOutreach(): Promise<void> {
    console.log('Processing daily outreach batches...');

    // Get all users with outreach enabled
    const usersWithPrefs = await db.query.userOutreachPreferences.findMany({
      where: (prefs, { eq }) => eq(prefs.enabled, true)
    });

    for (const prefs of usersWithPrefs) {
      try {
        await this.processUserOutreach(prefs.userId);
      } catch (error) {
        console.error(`Failed to process outreach for user ${prefs.userId}:`, error);
      }
    }
  }

  /**
   * Process outreach for a single user
   */
  private async processUserOutreach(userId: number): Promise<void> {
    // Get user details
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.email) {
      console.log(`User ${userId} not found or has no email`);
      return;
    }

    // Get available contacts
    const result = await outreachService.getAvailableContacts(userId, 5);

    if (result.needsMoreContacts) {
      // Send urgent reminder
      await sendGridService.sendOutreachNotification({
        to: user.email,
        from: 'notifications@5ducks.com',
        userName: user.username,
        contactCount: result.contacts.length,
        batchToken: '', // Will be generated if they have some contacts
        searchPrompts: result.suggestedSearchPrompts,
        isUrgent: true
      });

      if (result.contacts.length === 0) {
        console.log(`User ${userId} has no contacts available for outreach`);
        return;
      }
    }

    // Generate emails for available contacts
    const contactIds = result.contacts.map(c => c.id);
    const emails = await this.generateEmails(userId, contactIds);

    // Create batch
    const batchData: OutreachBatchData = {
      userId,
      contactIds,
      emails,
      scheduledFor: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    const token = await outreachService.createOutreachBatch(batchData);

    // Send notification email
    await sendGridService.sendOutreachNotification({
      to: user.email,
      from: 'notifications@5ducks.com',
      userName: user.username,
      contactCount: emails.length,
      batchToken: token,
      isUrgent: false
    });

    console.log(`Sent outreach batch to ${user.email} with ${emails.length} contacts`);
  }

  /**
   * Check if outreach should run based on schedule
   */
  shouldRunOutreach(schedule: { days: string[], time: string }, timezone: string): boolean {
    const now = new Date();
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    
    const dayMap: { [key: string]: number } = {
      'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3,
      'thu': 4, 'fri': 5, 'sat': 6
    };

    const currentDay = userTime.getDay();
    const currentHour = userTime.getHours();
    const currentMinute = userTime.getMinutes();

    // Check if today is in schedule
    const todayKey = Object.keys(dayMap).find(key => dayMap[key] === currentDay);
    if (!todayKey || !schedule.days.includes(todayKey)) {
      return false;
    }

    // Check if current time matches schedule (within 30 minute window)
    const [schedHour, schedMinute] = schedule.time.split(':').map(Number);
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const scheduleTotalMinutes = schedHour * 60 + schedMinute;

    return Math.abs(currentTotalMinutes - scheduleTotalMinutes) <= 30;
  }
}

export const batchGeneratorService = new BatchGeneratorService();