import type { Contact } from "@shared/schema";

interface ContactWithCompanyInfo extends Omit<Contact, 'companyId'> {
  companyName?: string;
  companyId?: number;
}

interface FilterOptions {
  maxPerCompany?: number;
  minProbability?: number;
}

export function filterTopProspects(
  contacts: ContactWithCompanyInfo[],
  options: FilterOptions = { maxPerCompany: 10, minProbability: 50 }
): ContactWithCompanyInfo[] {
  // First, ensure we're working with valid contacts
  const validContacts = contacts.filter(contact => 
    contact.name && 
    contact.probability && 
    contact.probability >= (options.minProbability ?? 50)
  );

  // Sort by probability (higher is better)
  const sortedContacts = [...validContacts].sort((a, b) => 
    (b.probability || 0) - (a.probability || 0)
  );

  const result: ContactWithCompanyInfo[] = [];
  const usedEmails = new Set<string>();
  const companyCount: Record<number, number> = {};

  for (const contact of sortedContacts) {
    // Skip if we've already used this email
    if (contact.email && usedEmails.has(contact.email.toLowerCase())) {
      continue;
    }

    // Skip if we've reached the max contacts for this company
    if (contact.companyId) {
      companyCount[contact.companyId] = companyCount[contact.companyId] || 0;
      if (companyCount[contact.companyId] >= (options.maxPerCompany ?? 10)) {
        continue;
      }
    }

    // Add the contact
    result.push(contact);

    // Track the email and company count
    if (contact.email) {
      usedEmails.add(contact.email.toLowerCase());
    }
    if (contact.companyId) {
      companyCount[contact.companyId]++;
    }
  }

  return result;
}
