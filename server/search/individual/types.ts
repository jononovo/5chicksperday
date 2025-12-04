export interface ParsedIndividualQuery {
  personName: string;
  locationHint?: string;
  roleHint?: string;
  originalQuery: string;
}

export interface IndividualDiscoveryResult {
  personName: string;
  currentCompany: string;
  currentRole: string;
  companyWebsite?: string;
  linkedinUrl?: string;
  confidence: number;
  notes?: string;
}

export interface IndividualSearchResult {
  success: boolean;
  company?: {
    id: number;
    name: string;
    website: string | null;
    description: string | null;
  };
  contact?: {
    id: number;
    name: string;
    role: string | null;
    email: string | null;
    probability: number | null;
  };
  error?: string;
}
