import { storage } from "../../storage";
import { generateSecureToken, createExpirationDate, isTokenExpired } from "./token";
import { generateOutreachEmail, personalizeEmailContent } from "./email-generator";
import type { DailyOutreachCheckResult, DailyOutreachEmail, OutreachPageData } from "./types";
import type { Contact, Company, OutreachToken } from "@shared/schema";

export class DailyOutreachService {
  static async checkDailyOutreach(userId: number): Promise<DailyOutreachCheckResult> {
    try {
      // Get user preferences
      const preferences = await storage.getDailyOutreachPreferences(userId);
      const contactsPerDay = preferences?.contactsPerDay || 5;
      
      // Get uncontacted contacts with emails
      const uncontactedContacts = await storage.getUncontactedContacts(userId, contactsPerDay);
      
      if (uncontactedContacts.length < contactsPerDay) {
        return {
          hasContacts: false,
          message: `You need to search for more contacts! Only ${uncontactedContacts.length} uncontacted contacts found.`
        };
      }
      
      // Get company information for each contact
      const contactsWithCompanies = await Promise.all(
        uncontactedContacts.map(async (contact) => {
          const company = await storage.getCompany(contact.companyId, userId);
          return { ...contact, company };
        })
      );
      
      // Generate emails for each contact
      const emails: DailyOutreachEmail[] = await Promise.all(
        contactsWithCompanies.map(async (contact, index) => {
          const emailData = await generateOutreachEmail(contact);
          return {
            ...emailData,
            priority: contactsWithCompanies.length - index // Higher priority for first contacts
          };
        })
      );
      
      return {
        hasContacts: true,
        contacts: emails
      };
    } catch (error) {
      console.error('Error checking daily outreach:', error);
      throw error;
    }
  }
  
  static async createOutreachToken(userId: number, contactIds: number[]): Promise<string> {
    const token = generateSecureToken();
    const expiresAt = createExpirationDate(24); // 24 hours
    
    await storage.createOutreachToken({
      userId,
      token,
      contactIds,
      expiresAt: expiresAt.toISOString()
    });
    
    return token;
  }
  
  static async getOutreachPageData(token: string): Promise<OutreachPageData | null> {
    try {
      const tokenData = await storage.getOutreachToken(token);
      
      if (!tokenData) {
        return null;
      }
      
      if (isTokenExpired(tokenData.expiresAt)) {
        return null;
      }
      
      if (tokenData.usedAt) {
        return null;
      }
      
      // Get the first contact from the token
      const contactIds = tokenData.contactIds as number[];
      if (!contactIds || contactIds.length === 0) {
        return null;
      }
      
      const contactId = contactIds[0];
      const contact = await storage.getContact(contactId, tokenData.userId);
      
      if (!contact || !contact.email) {
        return null;
      }
      
      // Get company and user information
      const [company, user, queueItem] = await Promise.all([
        storage.getCompany(contact.companyId, tokenData.userId),
        storage.getUserById(tokenData.userId),
        storage.getQueuedContact(tokenData.userId, contactId)
      ]);
      
      if (!user) {
        return null;
      }
      
      // Generate or get queued email
      let emailContent;
      if (queueItem?.generatedEmail) {
        emailContent = queueItem.generatedEmail as { subject: string; content: string };
      } else {
        const emailData = await generateOutreachEmail({ ...contact, company: company || undefined });
        emailContent = {
          subject: emailData.subject,
          content: emailData.content
        };
      }
      
      // Personalize the email content
      const personalizedContent = personalizeEmailContent(emailContent.content, {
        senderName: user.username || user.email.split('@')[0],
        senderEmail: user.email
      });
      
      return {
        token,
        email: {
          contactId: contact.id,
          contactName: contact.name,
          contactEmail: contact.email,
          contactRole: contact.role || '',
          companyName: company?.name || '',
          companyDescription: company?.description || undefined,
          subject: emailContent.subject,
          content: personalizedContent,
          priority: 1
        },
        contactInfo: {
          name: contact.name,
          role: contact.role || '',
          email: contact.email,
          company: {
            name: company?.name || '',
            description: company?.description || undefined
          }
        },
        userEmail: user.email,
        userName: user.username || user.email.split('@')[0],
        position: 1,
        totalCount: contactIds.length
      };
    } catch (error) {
      console.error('Error getting outreach page data:', error);
      return null;
    }
  }
  
  static async markContactContacted(
    userId: number,
    contactId: number,
    status: 'sent' | 'skipped',
    emailSubject?: string,
    emailContent?: string
  ): Promise<void> {
    // Check if status already exists
    const existingStatus = await storage.getContactOutreachStatus(contactId, userId);
    
    if (existingStatus) {
      await storage.updateContactOutreachStatus(existingStatus.id, {
        status,
        emailSubject,
        emailContent,
        sentAt: status === 'sent' ? new Date() : undefined,
        skippedAt: status === 'skipped' ? new Date() : undefined
      });
    } else {
      await storage.createContactOutreachStatus({
        userId,
        contactId,
        status,
        emailSubject,
        emailContent
      });
    }
    
    // Remove from queue if present
    const queueItem = await storage.getQueuedContact(userId, contactId);
    if (queueItem) {
      await storage.removeFromOutreachQueue(queueItem.id);
    }
  }
  
  static async updateOutreachPreferences(
    userId: number,
    preferences: {
      enabled?: boolean;
      schedule?: { days: string[]; time: string };
      contactsPerDay?: number;
      timezone?: string;
    }
  ): Promise<void> {
    const existing = await storage.getDailyOutreachPreferences(userId);
    
    if (existing) {
      await storage.updateDailyOutreachPreferences(userId, preferences);
    } else {
      // Provide default values for required fields when creating new preferences
      await storage.createDailyOutreachPreferences({
        userId,
        enabled: preferences.enabled ?? true,
        schedule: preferences.schedule ?? { days: ["Monday", "Tuesday", "Wednesday"], time: "09:00" },
        contactsPerDay: preferences.contactsPerDay ?? 5,
        timezone: preferences.timezone ?? "America/New_York"
      });
    }
  }
  
  static async getTokenData(token: string): Promise<OutreachToken | null> {
    try {
      const tokenData = await storage.getOutreachToken(token);
      
      if (!tokenData || isTokenExpired(tokenData.expiresAt) || tokenData.usedAt) {
        return null;
      }
      
      return tokenData;
    } catch (error) {
      console.error('Error getting token data:', error);
      return null;
    }
  }
  
  static async getPreferences(userId: number) {
    return storage.getDailyOutreachPreferences(userId);
  }

  // Enhanced Email Tracking Methods
  static async markEmailSent(
    userId: number,
    contactId: number,
    emailData: {
      subject: string;
      content: string;
      emailAddress: string;
    }
  ): Promise<void> {
    // Mark contact as clicked/sent
    await storage.markContactAsClicked(userId, contactId, emailData);
    
    // Update company contacted count
    const contact = await storage.getContact(contactId, userId);
    if (contact) {
      const companyStatus = await storage.getCompanyOutreachStatus(contact.companyId, userId);
      
      if (companyStatus) {
        await storage.updateCompanyOutreachStatus(companyStatus.id, {
          contactedCount: (companyStatus.contactedCount || 0) + 1,
          lastContactedAt: new Date(),
          status: "contacted"
        });
      } else {
        await storage.createCompanyOutreachStatus({
          userId,
          companyId: contact.companyId,
          status: "contacted",
          contactedCount: 1
        });
      }
    }
  }

  // Company Skip Management
  static async markCompanyAsSkipped(
    userId: number,
    companyId: number,
    reason: "not_fit" | "not_now",
    notes?: string
  ): Promise<void> {
    const followUpDate = reason === "not_now" 
      ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days from now
      : undefined;
    
    await storage.markCompanyAsSkipped(userId, companyId, reason, notes, followUpDate);
    
    // Mark all contacts from this company as skipped
    const contacts = await storage.listContactsByCompany(companyId, userId);
    for (const contact of contacts) {
      const existing = await storage.getContactOutreachStatus(contact.id, userId);
      if (!existing || existing.status === "pending") {
        await storage.createContactOutreachStatus({
          userId,
          contactId: contact.id,
          status: "skipped",
          skipReason: reason,
          skippedAt: new Date().toISOString()
        });
      }
    }
  }

  // Contact Pipeline Management
  static async getContactPipeline(userId: number): Promise<{
    available: Contact[];
    emailed: Contact[];
    skipped: Contact[];
    total: number;
  }> {
    const [available, emailed, skipped] = await Promise.all([
      storage.getUncontactedContacts(userId, 100),
      storage.getContactsByStatus(userId, "clicked"),
      storage.getContactsByStatus(userId, "skipped")
    ]);

    return {
      available,
      emailed,
      skipped,
      total: available.length + emailed.length + skipped.length
    };
  }

  // Check if more contacts are needed
  static async checkContactAvailability(userId: number): Promise<{
    needsMoreContacts: boolean;
    availableCount: number;
    suggestedPrompts?: string[];
  }> {
    const preferences = await storage.getDailyOutreachPreferences(userId);
    const minContactsNeeded = (preferences?.contactsPerDay || 5) * 3; // 3 days worth
    
    const availableContacts = await storage.getUncontactedContacts(userId, 1000);
    const needsMoreContacts = availableContacts.length < minContactsNeeded;
    
    if (needsMoreContacts) {
      // Generate suggested search prompts based on user's business
      const profiles = await storage.getStrategicProfiles(userId);
      const latestProfile = profiles?.[0];
      
      const suggestedPrompts = latestProfile?.searchPrompts?.slice(0, 3) || [
        "Find B2B companies in my target market",
        "Search for decision makers at mid-size companies",
        "Discover potential clients in my industry"
      ];
      
      return {
        needsMoreContacts: true,
        availableCount: availableContacts.length,
        suggestedPrompts
      };
    }
    
    return {
      needsMoreContacts: false,
      availableCount: availableContacts.length
    };
  }

  // Get companies ready for follow-up
  static async getFollowUpCompanies(userId: number): Promise<Company[]> {
    const today = new Date().toISOString();
    return await storage.getCompaniesWithFollowUp(userId, today);
  }
}