import { Company } from "./schema";

export interface SearchSessionResult {
  sessionId: string;
  query: string;
  status: "pending" | "companies_found" | "contacts_complete" | "failed";
  quickResults?: any[];
  fullResults?: any[];
  error?: string;
  timestamp: number;
  ttl: number;
  emailSearchStatus?: "none" | "running" | "completed";
  emailSearchCompleted?: number;
}
export type CompanyResults = {
  name: string,
  website: string,
  description: string
}[];

export interface SearchCache {
  apiResults: CompanyResults,
  companyRecords: Company[],
  timestamp: number,
  ttl: number, 
}
export interface CSVImportType {
  company:string, role:string, name:string, email:string
}