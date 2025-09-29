/**
 * Email Search Orchestrator Module
 * 
 * Handles complex multi-stage email search across multiple companies and contacts
 */

import { Express, Request, Response } from "express";
import { storage } from "../storage";
import { CreditService } from "../features/billing/credits/service";
import { getUserId } from "./utils";
import { searchContactDetails } from "./enrichment/contact-details";
import { searchApolloDirect } from "./providers/apollo";
import { searchHunterDirect } from "./providers/hunter";
import type { Contact } from "@shared/schema";

export function registerOrchestratorRoutes(app: Express, requireAuth: any) {
  
  // Backend Email Search Orchestration Endpoint
  app.post("/api/companies/find-all-emails", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { companyIds, sessionId } = req.body;
      
      console.log(`🔍 [EMAIL ORCHESTRATION START] User ${userId} requesting email search for companies:`, companyIds);
      console.log(`🔍 [EMAIL ORCHESTRATION] Session ID:`, sessionId);
      
      if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
        console.log(`❌ [EMAIL ORCHESTRATION ERROR] Invalid companyIds:`, companyIds);
        res.status(400).json({ message: "companyIds array is required" });
        return;
      }
      
      console.log(`🔍 [EMAIL ORCHESTRATION] Processing ${companyIds.length} companies for user ${userId}`);
      
      // Mark email search as started in session if sessionId provided
      if (sessionId) {
        const session = global.searchSessions?.get(sessionId);
        if (session) {
          session.emailSearchStatus = 'running';
          global.searchSessions.set(sessionId, session);
          console.log(`[Email Search] Session ${sessionId} marked as email search running`);
        }
      }
      
      let totalProcessed = 0;
      let totalEmailsFound = 0;
      const results = [];
      
      // Helper function to add delay
      const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
      
      // Process individual company with waterfall search
      const processCompany = async (companyId: number, index: number) => {
        // Add staggered delay before starting each company
        await delay(index * 400);
        
        try {
          console.log(`🏢 [COMPANY ${index + 1}] Starting email search for company ID: ${companyId} (after ${index * 400}ms delay)`);
          
          const company = await storage.getCompany(companyId, userId);
          if (!company) {
            console.log(`❌ [COMPANY ${index + 1}] Company ${companyId} not found, skipping`);
            return { processed: 0, emailsFound: 0, result: null };
          }
          
          console.log(`🏢 [COMPANY ${index + 1}] Processing emails for company: ${company.name}`);
          
          // Get current contacts for this company
          const contacts = await storage.listContactsByCompany(company.id, userId);
          console.log(`📋 [COMPANY ${index + 1}] Found ${contacts.length} total contacts for ${company.name}`);
          
          // Filter to contacts needing emails (top 3 contacts without emails)
          const allTop3 = contacts
            .sort((a, b) => (b.probability || 0) - (a.probability || 0))
            .slice(0, 3);
            
          console.log(`📋 [COMPANY ${index + 1}] Top 3 contacts for ${company.name}:`, 
            allTop3.map(c => ({ name: c.name, email: c.email, hasValidEmail: c.email && c.email.length > 5 })));
          
          const topContacts = allTop3.filter(contact => !contact.email || contact.email.length <= 5);
          
          console.log(`📧 [COMPANY ${index + 1}] Contacts needing emails: ${topContacts.length} of ${allTop3.length} for ${company.name}`);
          console.log(`📧 [COMPANY ${index + 1}] Contacts needing emails:`, topContacts.map(c => ({ name: c.name, currentEmail: c.email })));
          
          if (topContacts.length === 0) {
            console.log(`✅ [COMPANY ${index + 1}] No contacts need email search for ${company.name} - all have valid emails`);
            return { processed: 0, emailsFound: 0, result: null };
          }
          
          // Helper function: Search multiple contacts with Apollo
          const searchApolloContacts = async (contacts: Contact[]) => {
            console.log(`🔍 [APOLLO SEARCH] Starting Apollo search for ${contacts.length} contacts in ${company.name}`);
            console.log(`🔍 [APOLLO SEARCH] Contacts to search:`, contacts.map(c => ({ id: c.id, name: c.name })));
            
            let emailsFound = 0;
            let contactsProcessed = 0;
            const sources = [];
            
            // Check if Apollo API key is available
            const apolloApiKey = process.env.APOLLO_API_KEY;
            if (!apolloApiKey) {
              console.log(`⚠️ [APOLLO] API key not configured, skipping Apollo search`);
              return { emailsFound: 0, contactsProcessed: 0, sources: [] };
            }
            
            for (const contact of contacts) {
              try {
                console.log(`🔍 [APOLLO] Searching contact ${contact.id} (${contact.name}) in ${company.name}`);
                
                // Direct function call instead of HTTP request
                const searchResult = await searchApolloDirect(contact, company, apolloApiKey);
                
                if (searchResult.success && searchResult.contact.email) {
                  // Update contact in database
                  await storage.updateContact(contact.id, {
                    email: searchResult.contact.email,
                    role: searchResult.contact.role || contact.role,
                    linkedinUrl: searchResult.contact.linkedinUrl || contact.linkedinUrl,
                    phoneNumber: searchResult.contact.phoneNumber || contact.phoneNumber,
                    completedSearches: [...(contact.completedSearches || []), 'apollo_search'],
                    lastValidated: new Date()
                  });
                  
                  emailsFound++;
                  sources.push(`Apollo-${contact.name}`);
                  console.log(`✅ [APOLLO SUCCESS] Found email for ${contact.name}: ${searchResult.contact.email}`);
                } else {
                  console.log(`❌ [APOLLO] No email found for ${contact.name}`);
                }
                contactsProcessed++;
              } catch (error) {
                console.error(`❌ [APOLLO ERROR] Search failed for contact ${contact.id} (${contact.name}):`, error);
                contactsProcessed++;
              }
            }
            
            console.log(`🔍 [APOLLO COMPLETE] Processed ${contactsProcessed} contacts, found ${emailsFound} emails`);
            return { emailsFound, contactsProcessed, sources };
          };

          // Helper function: Search multiple contacts with Perplexity  
          const searchPerplexityContacts = async (contacts: Contact[]) => {
            console.log(`🧠 [PERPLEXITY SEARCH] Starting Perplexity search for ${contacts.length} contacts in ${company.name}`);
            console.log(`🧠 [PERPLEXITY SEARCH] Contacts to search:`, contacts.map(c => ({ id: c.id, name: c.name })));
            
            let emailsFound = 0;
            let contactsProcessed = 0;
            const sources = [];
            
            for (const contact of contacts) {
              try {
                console.log(`🧠 [PERPLEXITY] Searching contact ${contact.id} (${contact.name}) at ${company.name}`);
                
                const enrichedDetails = await searchContactDetails(contact.name, company.name);
                console.log(`🧠 [PERPLEXITY] Response for ${contact.name}:`, { email: enrichedDetails?.email, hasValidEmail: enrichedDetails?.email && enrichedDetails.email.length > 5 });
                
                if (enrichedDetails && enrichedDetails.email && enrichedDetails.email.length > 5) {
                  await storage.updateContact(contact.id, {
                    ...enrichedDetails,
                    completedSearches: [...(contact.completedSearches || []), 'contact_enrichment']
                  });
                  emailsFound++;
                  sources.push(`Perplexity-${contact.name}`);
                  console.log(`✅ [PERPLEXITY SUCCESS] Found email for ${contact.name}: ${enrichedDetails.email}`);
                } else {
                  console.log(`❌ [PERPLEXITY] No email found for ${contact.name}`);
                }
                contactsProcessed++;
              } catch (error) {
                console.error(`❌ [PERPLEXITY ERROR] Search failed for contact ${contact.id} (${contact.name}):`, error);
                contactsProcessed++;
              }
            }
            
            console.log(`🧠 [PERPLEXITY COMPLETE] Processed ${contactsProcessed} contacts, found ${emailsFound} emails`);
            return { emailsFound, contactsProcessed, sources };
          };

          // Helper function: Search multiple contacts with Hunter
          const searchHunterContacts = async (contacts: Contact[]) => {
            console.log(`🎯 [HUNTER SEARCH] Starting Hunter search for ${contacts.length} contacts`);
            
            let emailsFound = 0;
            let contactsProcessed = 0;
            const sources = [];
            
            // Check if Hunter API key is available
            const hunterApiKey = process.env.HUNTER_API_KEY;
            if (!hunterApiKey) {
              console.log(`⚠️ [HUNTER] API key not configured, skipping Hunter search`);
              return { emailsFound: 0, contactsProcessed: 0, sources: [] };
            }
            
            for (const contact of contacts) {
              try {
                console.log(`🎯 [HUNTER] Searching contact ${contact.id} (${contact.name})`);
                
                // Direct function call instead of HTTP request
                const searchResult = await searchHunterDirect(contact, company, hunterApiKey);
                
                if (searchResult.success && searchResult.contact.email) {
                  // Update contact in database
                  await storage.updateContact(contact.id, {
                    email: searchResult.contact.email,
                    role: searchResult.contact.role || contact.role,
                    completedSearches: [...(contact.completedSearches || []), 'hunter_search'],
                    lastValidated: new Date()
                  });
                  
                  emailsFound++;
                  sources.push(`Hunter-${contact.name}`);
                  console.log(`✅ [HUNTER SUCCESS] Found email for ${contact.name}: ${searchResult.contact.email}`);
                } else {
                  console.log(`❌ [HUNTER] No email found for ${contact.name}`);
                }
                contactsProcessed++;
              } catch (error) {
                console.error(`❌ [HUNTER ERROR] Search failed for contact ${contact.id}:`, error);
                contactsProcessed++;
              }
            }
            
            console.log(`🎯 [HUNTER COMPLETE] Processed ${contactsProcessed} contacts, found ${emailsFound} emails`);
            return { emailsFound, contactsProcessed, sources };
          };

          // Define contact assignments
          const contact1 = topContacts[0]; // Highest scored
          const contact2 = topContacts[1]; // Second highest  
          const contact3 = topContacts[2]; // Third highest

          console.log(`🎯 [CONTACT ASSIGNMENT] For ${company.name}:`);
          console.log(`🎯 Contact 1 (Apollo + Perplexity):`, contact1 ? { id: contact1.id, name: contact1.name } : 'None');
          console.log(`🎯 Contact 2 (Apollo only):`, contact2 ? { id: contact2.id, name: contact2.name } : 'None');
          console.log(`🎯 Contact 3 (Perplexity only):`, contact3 ? { id: contact3.id, name: contact3.name } : 'None');

          // Tier 1 & 2: Run Apollo and Perplexity in parallel
          console.log(`🚀 [PARALLEL SEARCH START] Starting parallel search for ${company.name}`);
          console.log(`🚀 Apollo will search:`, [contact1, contact2].filter(Boolean).map(c => c.name));
          console.log(`🚀 Perplexity will search:`, [contact1, contact3].filter(Boolean).map(c => c.name));
          
          const [apolloResults, perplexityResults] = await Promise.all([
            searchApolloContacts([contact1, contact2].filter(Boolean)),
            searchPerplexityContacts([contact1, contact3].filter(Boolean))
          ]);

          const combinedEmailsFound = apolloResults.emailsFound + perplexityResults.emailsFound;
          const combinedContactsProcessed = apolloResults.contactsProcessed + perplexityResults.contactsProcessed;
          const combinedSources = [...apolloResults.sources, ...perplexityResults.sources];

          console.log(`📊 [PARALLEL RESULTS] ${company.name} - Combined: ${combinedEmailsFound} emails, ${combinedContactsProcessed} searches`);
          console.log(`📊 [PARALLEL SOURCES] ${company.name} - Sources:`, combinedSources);

          // Early return if emails found
          if (combinedEmailsFound > 0) {
            console.log(`✅ [PARALLEL SUCCESS] ${company.name}: ${combinedEmailsFound} emails found - skipping Hunter fallback`);
            return {
              processed: combinedContactsProcessed,
              emailsFound: combinedEmailsFound,
              result: {
                companyId: company.id,
                companyName: company.name,
                emailsFound: combinedEmailsFound,
                source: combinedSources.join(', ')
              }
            };
          }

          // Tier 3: Hunter only if no emails found in Tiers 1 & 2
          console.log(`🎯 [HUNTER FALLBACK] No emails found in parallel search, trying Hunter for ${company.name}`);
          console.log(`🎯 Hunter will search:`, [contact1, contact2].filter(Boolean).map(c => c.name));
          const hunterResults = await searchHunterContacts([contact1, contact2].filter(Boolean));
          
          return {
            processed: combinedContactsProcessed + hunterResults.contactsProcessed,
            emailsFound: hunterResults.emailsFound,
            result: {
              companyId: company.id,
              companyName: company.name,
              emailsFound: hunterResults.emailsFound,
              source: hunterResults.emailsFound > 0 ? hunterResults.sources.join(', ') : 'None'
            }
          };
          
        } catch (error) {
          console.error(`Error processing company ${companyId}:`, error);
          return { processed: 0, emailsFound: 0, result: null };
        }
      };
      
      // Process all companies in parallel with staggered starts
      const companyResults = await Promise.all(
        companyIds.map((companyId, index) => processCompany(companyId, index))
      );
      
      // Collect results and calculate totals + source breakdown
      const sourceBreakdown = { Perplexity: 0, Apollo: 0, Hunter: 0 };
      
      for (const { processed, emailsFound, result } of companyResults) {
        totalProcessed += processed;
        totalEmailsFound += emailsFound;
        if (result) {
          results.push(result);
          if (result.source && result.emailsFound > 0) {
            // Handle parallel search results with multiple sources
            const sources = result.source.split(', ');
            sources.forEach(source => {
              if (source.includes('Apollo')) {
                sourceBreakdown.Apollo++;
              } else if (source.includes('Perplexity')) {
                sourceBreakdown.Perplexity++;
              } else if (source.includes('Hunter')) {
                sourceBreakdown.Hunter++;
              }
            });
          }
        }
      }
      
      console.log(`Backend email orchestration completed: ${totalEmailsFound} emails found from ${totalProcessed} searches across ${companyIds.length} companies`);
      console.log(`Source breakdown - Perplexity: ${sourceBreakdown.Perplexity}, Apollo: ${sourceBreakdown.Apollo}, Hunter: ${sourceBreakdown.Hunter}`);
      
      // Mark email search as completed in session if sessionId provided
      if (sessionId) {
        const session = global.searchSessions?.get(sessionId);
        if (session) {
          session.emailSearchStatus = 'completed';
          session.emailSearchCompleted = Date.now();
          global.searchSessions.set(sessionId, session);
          console.log(`[Email Search] Session ${sessionId} marked as email search completed`);
        }
      }
      
      // Deduct credits for bulk email search (flat rate of 160 credits)
      try {
        const creditResult = await CreditService.deductCredits(
          userId,
          'email_search',  // This will deduct 160 credits as defined in CREDIT_COSTS
          true  // success = true
        );
        
        console.log(`💳 [BULK EMAIL SEARCH] Deducted 160 credits for user ${userId}. New balance: ${creditResult.newBalance}`);
        console.log(`💳 [BULK EMAIL SEARCH] Found ${totalEmailsFound} emails across ${companyIds.length} companies`);
        
        res.json({
          success: true,
          summary: {
            companiesProcessed: companyIds.length,
            contactsProcessed: totalProcessed,
            emailsFound: totalEmailsFound,
            sourceBreakdown,
            creditsCharged: 160,
            newCreditBalance: creditResult.newBalance
          },
          results
        });
      } catch (creditError) {
        console.error('Failed to deduct credits for bulk email search:', creditError);
        // Still return success even if credit deduction fails
        res.json({
          success: true,
          summary: {
            companiesProcessed: companyIds.length,
            contactsProcessed: totalProcessed,
            emailsFound: totalEmailsFound,
            sourceBreakdown,
            creditDeductionError: true
          },
          results
        });
      }
      
    } catch (error) {
      console.error('Backend email orchestration error:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to orchestrate email search"
      });
    }
  });
}