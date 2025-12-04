import { storage } from '../../storage';
import { CreditService } from '../../features/billing/credits/service';
import { parseIndividualQuery } from './query-parser';
import { discoverIndividual, enrichIndividualWithEmail } from './individual-search';
import type { SearchJob } from '@shared/schema';
import type { SearchType } from '../../features/billing/credits/types';

export class IndividualSearchService {
  static async executeIndividualJob(job: SearchJob, jobId: string): Promise<void> {
    try {
      console.log(`[IndividualSearchService] Starting individual search for job ${jobId}`);
      console.log(`[IndividualSearchService] Query: "${job.query}"`);

      await storage.updateSearchJob(job.id, {
        progress: {
          phase: 'Parsing query',
          completed: 1,
          total: 6,
          message: 'Analyzing your search...'
        }
      });

      const parsed = parseIndividualQuery(job.query);
      console.log(`[IndividualSearchService] Parsed query:`, parsed);

      if (job.source !== 'cron') {
        const creditType: SearchType = 'individual_search';
        const userCredits = await CreditService.getUserCredits(job.userId);
        const { CREDIT_COSTS } = await import('../../features/billing/credits/types');
        const requiredCredits = CREDIT_COSTS[creditType];

        if (userCredits.currentBalance < requiredCredits) {
          console.log(`[IndividualSearchService] Insufficient credits for job ${job.id}: has ${userCredits.currentBalance}, needs ${requiredCredits}`);
          await storage.updateSearchJob(job.id, {
            status: 'failed',
            completedAt: new Date(),
            error: `Insufficient credits. You have ${userCredits.currentBalance} credits but this search requires ${requiredCredits} credits.`,
            results: {
              companies: [],
              contacts: [],
              totalCompanies: 0,
              totalContacts: 0,
              searchType: 'individual',
              metadata: {
                message: 'Insufficient credits for this search. Please add more credits to continue.'
              }
            },
            resultCount: 0
          });
          return;
        }
      }

      await storage.updateSearchJob(job.id, {
        progress: {
          phase: 'Finding individual',
          completed: 2,
          total: 6,
          message: `Searching for ${parsed.personName}...`
        }
      });

      const discoveryResult = await discoverIndividual(parsed);

      if (!discoveryResult || discoveryResult.confidence < 30) {
        console.log(`[IndividualSearchService] Could not find individual with confidence`);
        await storage.updateSearchJob(job.id, {
          status: 'completed',
          completedAt: new Date(),
          results: {
            companies: [],
            contacts: [],
            totalCompanies: 0,
            totalContacts: 0,
            searchType: 'individual',
            metadata: {
              message: `Could not find "${parsed.personName}" with sufficient confidence. Try adding more context like their company or role.`
            }
          },
          resultCount: 0
        });
        return;
      }

      if (!discoveryResult.currentCompany || discoveryResult.currentCompany.trim() === '') {
        console.log(`[IndividualSearchService] Could not determine current company for individual`);
        await storage.updateSearchJob(job.id, {
          status: 'completed',
          completedAt: new Date(),
          results: {
            companies: [],
            contacts: [],
            totalCompanies: 0,
            totalContacts: 0,
            searchType: 'individual',
            metadata: {
              message: `Found ${discoveryResult.personName} but could not determine their current company. Try adding their company name to your search.`
            }
          },
          resultCount: 0
        });
        return;
      }

      await storage.updateSearchJob(job.id, {
        progress: {
          phase: 'Creating company record',
          completed: 3,
          total: 6,
          message: `Found ${discoveryResult.personName} at ${discoveryResult.currentCompany}`
        }
      });

      const companyData = {
        userId: job.userId,
        name: discoveryResult.currentCompany,
        website: discoveryResult.companyWebsite || null,
        description: null,
        size: null,
        age: null,
        alternativeProfileUrl: null,
        defaultContactEmail: null,
        ranking: null,
        linkedinProminence: null,
        customerCount: null,
        rating: null,
        services: null,
        validationPoints: null,
        differentiation: null,
        totalScore: null,
        snapshot: null,
        listId: (job.metadata as any)?.listId || null
      };

      const savedCompany = await storage.createCompany(companyData);
      console.log(`[IndividualSearchService] Created company ${savedCompany.id}: ${savedCompany.name}`);

      await storage.updateSearchJob(job.id, {
        progress: {
          phase: 'Creating contact record',
          completed: 4,
          total: 6,
          message: `Adding ${discoveryResult.personName} as contact...`
        }
      });

      const contactData = {
        userId: job.userId,
        name: discoveryResult.personName,
        companyId: savedCompany.id,
        role: discoveryResult.currentRole || null,
        email: null,
        probability: null,
        linkedinUrl: discoveryResult.linkedinUrl || null,
        twitterHandle: null,
        phoneNumber: null,
        department: null,
        location: null,
        verificationSource: 'individual_search',
        nameConfidenceScore: discoveryResult.confidence,
        userFeedbackScore: null,
        feedbackCount: null
      };

      const savedContact = await storage.createContact(contactData);
      console.log(`[IndividualSearchService] Created contact ${savedContact.id}: ${savedContact.name}`);

      await storage.updateSearchJob(job.id, {
        progress: {
          phase: 'Finding email',
          completed: 5,
          total: 6,
          message: 'Searching for email address...'
        }
      });

      await enrichIndividualWithEmail(savedContact.id, savedCompany.id, job.userId);

      const enrichedContact = await storage.getContact(savedContact.id, job.userId);

      if (job.source !== 'cron') {
        await storage.updateSearchJob(job.id, {
          progress: {
            phase: 'Processing credits',
            completed: 6,
            total: 6,
            message: 'Updating account credits'
          }
        });

        const creditType: SearchType = 'individual_search';
        const creditResult = await CreditService.deductCredits(
          job.userId,
          creditType,
          true
        );

        console.log(`[IndividualSearchService] Deducted credits for individual search, new balance: ${creditResult.newBalance}`);
      }

      const companyWithContacts = {
        ...savedCompany,
        contacts: enrichedContact ? [enrichedContact] : [savedContact]
      };

      await storage.updateSearchJob(job.id, {
        status: 'completed',
        completedAt: new Date(),
        results: {
          companies: [companyWithContacts],
          contacts: enrichedContact ? [enrichedContact] : [savedContact],
          totalCompanies: 1,
          totalContacts: 1,
          searchType: 'individual',
          metadata: {
            personName: discoveryResult.personName,
            confidence: discoveryResult.confidence,
            notes: discoveryResult.notes
          }
        },
        resultCount: 1
      });

      console.log(`[IndividualSearchService] Completed individual search job ${jobId}`);

    } catch (error) {
      console.error(`[IndividualSearchService] Error in individual search:`, error);

      const shouldRetry = (job.retryCount || 0) < (job.maxRetries || 3);

      await storage.updateSearchJob(job.id, {
        status: shouldRetry ? 'pending' : 'failed',
        error: error instanceof Error ? error.message : 'Unknown error in individual search',
        retryCount: (job.retryCount || 0) + 1
      });

      if (!shouldRetry) {
        throw error;
      }
    }
  }
}
