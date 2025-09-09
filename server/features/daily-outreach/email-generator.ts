import type { Contact, Company, EmailTemplate, StrategicProfile } from "@shared/schema";
import type { DailyOutreachEmail } from "./types";

export async function generateOutreachEmail(
  contact: Contact & { company?: Company },
  template?: EmailTemplate,
  activeProduct?: StrategicProfile
): Promise<Omit<DailyOutreachEmail, 'priority'>> {
  const companyName = contact.company?.name || 'your company';
  const contactName = contact.name;
  const role = contact.role || 'there';
  
  // Build product context for the email
  let productContext = '';
  if (activeProduct) {
    if (activeProduct.productService) {
      productContext = `Our ${activeProduct.businessType || 'solution'} is ${activeProduct.productService}. `;
    }
    if (activeProduct.customerFeedback) {
      productContext += `${activeProduct.customerFeedback}. `;
    }
  }
  
  // Default template if none provided  
  let subject = template?.subject;
  let content = template?.content;
  
  if (!subject) {
    if (activeProduct?.productService) {
      subject = `${activeProduct.productService} for ${companyName}`;
    } else {
      subject = `Quick question for ${companyName}`;
    }
  }
  
  if (!content) {
    if (activeProduct) {
      // Product-focused email
      content = `Hi ${contactName},

I noticed that ${companyName} is ${contact.company?.description || 'doing great work'}.

${productContext}

I believe we could help ${companyName} ${activeProduct.customerFeedback ? 'achieve similar results' : 'grow and succeed'}.

Would you be open to a brief 15-minute call next week to explore how we could work together?

Best regards,
{senderName}`;
    } else {
      // Generic email
      content = `Hi ${contactName},

I noticed that ${companyName} is ${contact.company?.description || 'doing great work'}.

I help businesses like yours streamline their sales process and increase revenue. 

Would you be open to a brief 15-minute call next week to discuss how we could help ${companyName} grow?

Best regards,
{senderName}`;
    }
  }

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