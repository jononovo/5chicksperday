// Types for the outreach feature

export interface EmailActivityData {
  contactId: number;
  companyId: number;
  subject: string;
  content: string;
  senderEmail: string;
  recipientEmail: string;
  emailType?: 'manual' | 'campaign' | 'daily_outreach';
}

export interface ContactStatusUpdate {
  contactId: number;
  status: 'uncontacted' | 'emailed' | 'skipped';
  emailActivity?: EmailActivityData;
}

export interface CompanySkipData {
  companyId: number;
  reason: 'not_fit' | 'not_now';
  skipUntilDate?: Date; // For 'not_now' - when to reconsider
}

export interface OutreachBatchData {
  userId: number;
  contactIds: number[];
  emails: GeneratedEmail[];
  scheduledFor: Date;
  expiresAt: Date;
}

export interface GeneratedEmail {
  contactId: number;
  subject: string;
  content: string;
  recipientEmail: string;
  recipientName: string;
  companyName: string;
  companyContext?: string;
}

export interface OutreachPreferences {
  enabled: boolean;
  schedule: {
    days: string[]; // ['mon', 'tue', 'wed']
    time: string; // '09:00'
  };
  timezone: string;
  emailsPerBatch: number;
  includeSearchPrompts: boolean;
  sendUrgentReminders: boolean;
}

export interface ContactWithCompany {
  id: number;
  name: string;
  email: string;
  role?: string;
  companyId: number;
  companyName: string;
  companyDescription?: string;
  companyWebsite?: string;
  contactStatus: string;
  lastEmailedAt?: Date;
  emailCount: number;
}

export interface AvailableContactsResult {
  contacts: ContactWithCompany[];
  totalAvailable: number;
  needsMoreContacts: boolean;
  suggestedSearchPrompts?: string[];
}