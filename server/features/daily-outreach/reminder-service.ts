import { storage } from "../../storage";
import sgMail from "@sendgrid/mail";

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export class ReminderService {
  static async sendUrgentReminder(
    userId: number,
    type: "low_contacts" | "no_activity" | "follow_up_due",
    additionalData?: {
      availableContacts?: number;
      suggestedPrompts?: string[];
      followUpCompanies?: string[];
    }
  ): Promise<boolean> {
    try {
      // Get user information
      const user = await storage.getUserById(userId);
      if (!user || !user.email) {
        console.error('User not found or missing email');
        return false;
      }

      // Check if SendGrid is configured
      if (!process.env.SENDGRID_API_KEY) {
        console.warn('SendGrid API key not configured - skipping email send');
        // Still create the reminder record for tracking
        await this.createReminderRecord(userId, type, additionalData);
        return false;
      }

      // Generate email content based on type
      const emailContent = this.generateEmailContent(type, additionalData);
      
      // Send email via SendGrid
      const msg = {
        to: user.email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@5ducks.com',
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html
      };

      await sgMail.send(msg);
      
      // Record the reminder in database
      await this.createReminderRecord(userId, type, additionalData, emailContent);
      
      return true;
    } catch (error) {
      console.error('Error sending urgent reminder:', error);
      return false;
    }
  }

  private static generateEmailContent(
    type: "low_contacts" | "no_activity" | "follow_up_due",
    data?: any
  ) {
    let subject = '';
    let text = '';
    let html = '';

    switch (type) {
      case 'low_contacts':
        subject = '🚨 URGENT: You\'re Running Low on Contacts!';
        text = `You only have ${data?.availableContacts || 0} contacts available for outreach.\n\n`;
        text += 'To maintain your daily outreach momentum, you need to search for more contacts.\n\n';
        
        if (data?.suggestedPrompts?.length > 0) {
          text += 'Here are some suggested searches to get you started:\n';
          data.suggestedPrompts.forEach((prompt: string, i: number) => {
            text += `${i + 1}. ${prompt}\n`;
          });
        }
        
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">🚨 URGENT: You're Running Low on Contacts!</h2>
            <p style="font-size: 18px; color: #333;">
              You only have <strong>${data?.availableContacts || 0}</strong> contacts available for outreach.
            </p>
            <p>To maintain your daily outreach momentum, you need to search for more contacts.</p>
            ${data?.suggestedPrompts?.length > 0 ? `
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Suggested Searches:</h3>
                <ul style="list-style-type: none; padding: 0;">
                  ${data.suggestedPrompts.map((prompt: string) => 
                    `<li style="margin: 10px 0; padding: 10px; background: white; border-left: 4px solid #3b82f6;">
                      ${prompt}
                    </li>`
                  ).join('')}
                </ul>
              </div>
            ` : ''}
            <a href="${process.env.BASE_URL || 'https://5ducks.com'}" 
               style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; margin-top: 20px;">
              Search for More Contacts Now
            </a>
          </div>
        `;
        break;

      case 'no_activity':
        subject = '⚠️ Your Outreach Has Stalled - Take Action Now';
        text = 'We noticed you haven\'t sent any outreach emails recently.\n\n';
        text += 'Consistent outreach is key to generating leads. Don\'t let your pipeline dry up!\n';
        
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ea580c;">⚠️ Your Outreach Has Stalled</h2>
            <p style="font-size: 18px; color: #333;">
              We noticed you haven't sent any outreach emails recently.
            </p>
            <p>Consistent outreach is key to generating leads. Don't let your pipeline dry up!</p>
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>💡 Pro Tip:</strong> Set aside just 15 minutes each day for outreach. 
              Small consistent efforts lead to big results!</p>
            </div>
            <a href="${process.env.BASE_URL || 'https://5ducks.com'}" 
               style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; margin-top: 20px;">
              Resume Your Outreach
            </a>
          </div>
        `;
        break;

      case 'follow_up_due':
        subject = '📅 Follow-Up Reminder: Companies Ready for Re-engagement';
        text = 'You have companies that are now ready for follow-up!\n\n';
        
        if (data?.followUpCompanies?.length > 0) {
          text += 'Companies to follow up with:\n';
          data.followUpCompanies.forEach((company: string) => {
            text += `• ${company}\n`;
          });
        }
        
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">📅 Companies Ready for Follow-Up</h2>
            <p style="font-size: 18px; color: #333;">
              Great news! Companies you previously marked as "not now" are ready for re-engagement.
            </p>
            ${data?.followUpCompanies?.length > 0 ? `
              <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Companies to Contact:</h3>
                <ul style="list-style-type: none; padding: 0;">
                  ${data.followUpCompanies.map((company: string) => 
                    `<li style="margin: 8px 0; padding: 8px; background: white; border-left: 4px solid #10b981;">
                      ${company}
                    </li>`
                  ).join('')}
                </ul>
              </div>
            ` : ''}
            <a href="${process.env.BASE_URL || 'https://5ducks.com'}" 
               style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; margin-top: 20px;">
              Start Follow-Up Outreach
            </a>
          </div>
        `;
        break;
    }

    return { subject, text, html };
  }

  private static async createReminderRecord(
    userId: number,
    type: "low_contacts" | "no_activity" | "follow_up_due",
    data?: any,
    emailContent?: { subject: string; text: string; html: string }
  ) {
    await storage.createUrgentReminder({
      userId,
      type,
      emailSubject: emailContent?.subject || `${type} reminder`,
      emailContent: emailContent?.text || `Reminder: ${type}`,
      suggestedPrompts: data?.suggestedPrompts
    });
  }

  // Check and send reminders for a specific user
  static async checkAndSendRemindersForUser(userId: number): Promise<void> {
    try {
      // Check if user needs a low contacts reminder
      const availability = await storage.getUncontactedContacts(userId, 100);
      const preferences = await storage.getDailyOutreachPreferences(userId);
      const minNeeded = (preferences?.contactsPerDay || 5) * 3;
      
      if (availability.length < minNeeded) {
        // Check if we've already sent a reminder recently
        const recentReminders = await storage.getUrgentReminders(userId, false);
        const hasRecentLowContactsReminder = recentReminders.some(r => {
          if (r.type === 'low_contacts' && r.sentAt) {
            const sentTime = new Date(r.sentAt).getTime();
            return sentTime > Date.now() - 24 * 60 * 60 * 1000; // Within 24 hours
          }
          return false;
        });
        
        if (!hasRecentLowContactsReminder) {
          // Get strategic profile for better prompts
          const profiles = await storage.getStrategicProfiles(userId);
          const latestProfile = profiles?.[0];
          const suggestedPrompts = latestProfile?.searchPrompts?.slice(0, 3) || [
            "Find B2B companies in your target market",
            "Search for decision makers at mid-size companies",
            "Discover potential clients in your industry"
          ];
          
          await this.sendUrgentReminder(userId, 'low_contacts', {
            availableContacts: availability.length,
            suggestedPrompts
          });
        }
      }
      
      // Check for follow-up companies
      const followUpCompanies = await storage.getCompaniesWithFollowUp(userId, new Date().toISOString());
      if (followUpCompanies.length > 0) {
        // Check if we've already sent a follow-up reminder recently
        const recentReminders = await storage.getUrgentReminders(userId, false);
        const hasRecentFollowUpReminder = recentReminders.some(r => {
          if (r.type === 'follow_up_due' && r.sentAt) {
            const sentTime = new Date(r.sentAt).getTime();
            return sentTime > Date.now() - 24 * 60 * 60 * 1000; // Within 24 hours
          }
          return false;
        });
        
        if (!hasRecentFollowUpReminder) {
          await this.sendUrgentReminder(userId, 'follow_up_due', {
            followUpCompanies: followUpCompanies.map(c => c.name)
          });
        }
      }
    } catch (error) {
      console.error('Error checking and sending reminders for user:', error);
    }
  }
}