export interface DailyOutreachEmail {
  contactId: number;
  contactName: string;
  contactEmail: string;
  contactRole: string;
  companyName: string;
  companyDescription?: string;
  subject: string;
  content: string;
  priority: number;
}

export interface OutreachPageData {
  token: string;
  email: DailyOutreachEmail;
  contactInfo: {
    name: string;
    role: string;
    email: string;
    company: {
      name: string;
      description?: string;
    };
  };
  userEmail: string;
  userName: string;
  position: number;
  totalCount: number;
}

export interface DailyOutreachCheckResult {
  hasContacts: boolean;
  contacts?: DailyOutreachEmail[];
  message?: string;
}

export interface TokenPayload {
  userId: number;
  contactIds: number[];
  expiresAt: Date;
}