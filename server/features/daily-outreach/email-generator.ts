import type { Contact, Company, EmailTemplate } from "@shared/schema";
import type { DailyOutreachEmail } from "./types";

export async function generateOutreachEmail(
  contact: Contact & { company?: Company },
  template?: EmailTemplate
): Promise<Omit<DailyOutreachEmail, 'priority'>> {
  const companyName = contact.company?.name || 'your company';
  const contactName = contact.name;
  const role = contact.role || 'there';
  
  // Default template if none provided
  const subject = template?.subject || `Quick question for ${companyName}`;
  
  const content = template?.content || `Hi ${contactName},

I noticed that ${companyName} is ${contact.company?.description || 'doing great work'}.

I help businesses like yours streamline their sales process and increase revenue. 

Would you be open to a brief 15-minute call next week to discuss how we could help ${companyName} grow?

Best regards,
{senderName}`;

  return {
    contactId: contact.id,
    contactName: contact.name,
    contactEmail: contact.email!,
    contactRole: contact.role || '',
    companyName,
    companyDescription: contact.company?.description || undefined,
    subject,
    content
  };
}

export function personalizeEmailContent(
  content: string,
  replacements: Record<string, string>
): string {
  let personalizedContent = content;
  
  Object.entries(replacements).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    personalizedContent = personalizedContent.replace(regex, value);
  });
  
  return personalizedContent;
}