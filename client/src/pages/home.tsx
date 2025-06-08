import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchProgress } from "@/components/search-progress";
import { LandingPageTooltip } from "@/components/ui/landing-page-tooltip";
import { TableSkeleton } from "@/components/ui/table-skeleton";

// Lazy load heavy components
const CompanyTable = lazy(() => import("@/components/company-table"));
const PromptEditor = lazy(() => import("@/components/prompt-editor"));

// Import components with named exports directly for now
import { EmailSearchSummary } from "@/components/email-search-summary";
import { ContactDiscoveryReport } from "@/components/contact-discovery-report";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useRegistrationModal } from "@/hooks/use-registration-modal";
import {
  ListPlus,
  Search,
  Code2,
  UserCircle,
  Banknote,
  Eye,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  Star,
  MessageSquare,
  Gem,
  MoreHorizontal,
  Menu,
  Mail,
  Target,
  Rocket,
  Plus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { EggAnimation } from "@/components/egg-animation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Company, Contact } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { filterTopProspects, ContactWithCompanyInfo } from "@/lib/results-analysis/prospect-filtering";
import { Checkbox } from "@/components/ui/checkbox";
import { ContactActionColumn } from "@/components/contact-action-column";

// Extend Company type to include contacts
interface CompanyWithContacts extends Company {
  contacts?: ContactWithCompanyInfo[];
}

// Define interface for the saved state
interface SavedSearchState {
  currentQuery: string | null;
  currentResults: CompanyWithContacts[] | null;
}

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentQuery, setCurrentQuery] = useState<string | null>(null);
  const [currentResults, setCurrentResults] = useState<CompanyWithContacts[] | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [pendingContactIds, setPendingContactIds] = useState<Set<number>>(new Set());
  // State for selected contacts (for multi-select checkboxes)
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  // Add new state for tracking contact loading status
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  // Track if user came from landing page
  const [isFromLandingPage, setIsFromLandingPage] = useState(false);
  // Track the last executed search query and if input has changed
  const [lastExecutedQuery, setLastExecutedQuery] = useState<string | null>(null);
  const [inputHasChanged, setInputHasChanged] = useState(false);
  // Track when to highlight the email search button and start selling button
  const [highlightEmailButton, setHighlightEmailButton] = useState(false);
  const [highlightStartSellingButton, setHighlightStartSellingButton] = useState(false);
  const [showEmailTooltip, setShowEmailTooltip] = useState(false);
  // Tour modal has been removed
  const [pendingAeroLeadsIds, setPendingAeroLeadsIds] = useState<Set<number>>(new Set());
  const [pendingHunterIds, setPendingHunterIds] = useState<Set<number>>(new Set());
  const [pendingApolloIds, setPendingApolloIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const registrationModal = useRegistrationModal();
  const auth = useAuth();
  
  // Track if component is mounted to prevent localStorage corruption during unmount
  const isMountedRef = useRef(true);
  const isInitializedRef = useRef(false);

  // Helper function to load valid search state with fallback
  const loadSearchState = (): SavedSearchState | null => {
    try {
      // Try localStorage first
      const localState = localStorage.getItem('searchState');
      if (localState) {
        const parsed = JSON.parse(localState) as SavedSearchState;
        // Validate the data - ensure we have meaningful content
        if (parsed.currentQuery || (parsed.currentResults && parsed.currentResults.length > 0)) {
          return parsed;
        }
      }
      
      // Fallback to sessionStorage if localStorage is corrupted
      const sessionState = sessionStorage.getItem('searchState');
      if (sessionState) {
        const parsed = JSON.parse(sessionState) as SavedSearchState;
        if (parsed.currentQuery || (parsed.currentResults && parsed.currentResults.length > 0)) {
          console.log('Restored search state from sessionStorage backup');
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error loading search state:', error);
    }
    return null;
  };

  // Load state from localStorage on component mount
  useEffect(() => {
    // Check for pending search query from landing page
    const pendingQuery = localStorage.getItem('pendingSearchQuery');
    if (pendingQuery) {
      console.log('Found pending search query:', pendingQuery);
      setCurrentQuery(pendingQuery);
      setIsFromLandingPage(true); // Set flag when coming from landing page
      localStorage.removeItem('pendingSearchQuery');
      // No longer automatically triggering search - user must click the search button
    } else {
      // Load saved search state if no pending query
      const savedState = loadSearchState();
      if (savedState) {
        console.log('Loading saved search state:', {
          query: savedState.currentQuery,
          resultsCount: savedState.currentResults?.length,
          companies: savedState.currentResults?.map(c => ({ id: c.id, name: c.name }))
        });
        setCurrentQuery(savedState.currentQuery);
        setCurrentResults(savedState.currentResults);
      }
    }
    
    // Mark component as initialized
    isInitializedRef.current = true;
    
    // Cleanup function to prevent localStorage corruption during unmount
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Save state to localStorage whenever it changes (but prevent corruption during unmount)
  useEffect(() => {
    // Only save if component is mounted and initialized (prevents corruption during unmount)
    if (!isMountedRef.current || !isInitializedRef.current) {
      console.log('Skipping localStorage save - component not ready or unmounting');
      return;
    }
    
    // Only save if we have meaningful data (prevents saving null states)
    if (currentQuery || (currentResults && currentResults.length > 0)) {
      const stateToSave: SavedSearchState = {
        currentQuery,
        currentResults
      };
      console.log('Saving search state:', {
        query: currentQuery,
        resultsCount: currentResults?.length,
        companies: currentResults?.map(c => ({ id: c.id, name: c.name }))
      });
      
      // Save to both localStorage and sessionStorage for redundancy
      const stateString = JSON.stringify(stateToSave);
      localStorage.setItem('searchState', stateString);
      sessionStorage.setItem('searchState', stateString);
    } else {
      console.log('Skipping localStorage save - no meaningful data to save');
    }
  }, [currentQuery, currentResults]);



  const { data: searchApproaches = [] } = useQuery<any[]>({
    queryKey: ["/api/search-approaches"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentQuery || !currentResults) return;
      const res = await apiRequest("POST", "/api/lists", {
        companies: currentResults,
        prompt: currentQuery
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lists"] });
      toast({
        title: "List Saved",
        description: "The search results have been saved as a new list.",
      });
      setIsSaved(true);
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation for saving and navigating to outreach
  const saveAndNavigateMutation = useMutation({
    mutationFn: async () => {
      if (!currentQuery || !currentResults) return null;
      const res = await apiRequest("POST", "/api/lists", {
        companies: currentResults,
        prompt: currentQuery
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lists"] });
      toast({
        title: "List Saved",
        description: "Starting outreach process with your search results.",
      });
      setIsSaved(true);
      
      // Navigate to outreach page with the new list ID
      if (data && data.listId) {
        const outreachState = {
          selectedListId: data.listId.toString(),
          selectedContactId: null,
          emailPrompt: "",
          emailContent: "",
          toEmail: "",
          emailSubject: "",
          currentCompanyIndex: 0
        };
        localStorage.setItem('outreachState', JSON.stringify(outreachState));
        
        // Navigate to the outreach page
        setLocation("/outreach");
      }
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAnalysisComplete = () => {
    setIsAnalyzing(false);
  };

  // New handler for initial companies data
  const handleCompaniesReceived = (query: string, companies: Company[]) => {
    console.log('Companies received:', companies.length);
    // Update the UI with just the companies data
    setCurrentQuery(query);
    // Convert Company[] to CompanyWithContacts[] with empty contacts arrays
    setCurrentResults(companies.map(company => ({ ...company, contacts: [] })));
    setIsSaved(false);
    setIsLoadingContacts(true);
    setContactsLoaded(false);
  };

  // Modified search results handler for the full data with contacts
  const handleSearchResults = (query: string, results: CompanyWithContacts[]) => {
    console.log('Complete results received with contacts:', results.length);
    setCurrentQuery(query);
    setCurrentResults(results);
    setIsSaved(false);
    setIsLoadingContacts(false);
    setContactsLoaded(true);
    setLastExecutedQuery(query); // Store the last executed query
    setInputHasChanged(false); // Reset the input changed flag
    
    // Show contact discovery report for any search with companies
    const companiesWithContacts = results.filter(company => 
      company.contacts && company.contacts.length > 0
    ).length;
    
    console.log("Companies with contacts:", companiesWithContacts, "of", results.length);
    
    // Always show the report if we have companies (even if 0 have contacts)
    if (results.length > 0) {
      setContactReportVisible(true);
    }
    
    // Keep isFromLandingPage true until email button is clicked
    // (removed automatic reset to allow email tooltip to show)
  };

  const handleSaveList = () => {
    if (!currentResults || !currentQuery) {
      toast({
        title: "Cannot Save",
        description: "Please perform a search first.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };
  
  // Handler for Start Selling button
  const handleStartSelling = () => {
    if (!currentResults || !currentQuery) {
      toast({
        title: "Cannot Start Selling",
        description: "Please perform a search first to find companies and contacts.",
        variant: "destructive",
      });
      return;
    }
    
    // If email search summary is visible, we know an email search has run
    if (summaryVisible) {
      // Proceed with saving and navigating
      saveAndNavigateMutation.mutate();
      return;
    }
    
    // Otherwise, check if we have 5+ emails already
    const emailCount = currentResults.reduce((count, company) => {
      return count + (company.contacts?.filter(contact => 
        contact.email && contact.email.length > 5
      ).length || 0);
    }, 0);
    
    if (emailCount >= 5) {
      // We have enough emails, proceed
      saveAndNavigateMutation.mutate();
    } else {
      // Not enough emails
      toast({
        title: "Action Required",
        description: "Search for 5 emails before moving to Outreach.",
        variant: "destructive"
      });
    }
  };

  // Get top prospects from all companies
  const getTopProspects = (): ContactWithCompanyInfo[] => {
    if (!currentResults) return [];

    const allContacts: ContactWithCompanyInfo[] = [];
    currentResults.forEach(company => {
      if (company.contacts) {
        allContacts.push(...company.contacts);
      }
    });

    // Use the filtering logic
    return filterTopProspects(allContacts, {
      maxPerCompany: 3,
      minProbability: 50
    });
  };

  // Updated navigation handlers
  const handleContactView = (contactId: number) => {
    if (typeof contactId !== 'number') {
      console.error('Invalid contact ID:', contactId);
      return;
    }
    console.log('Navigating to contact:', contactId);
    setLocation(`/contacts/${contactId}`);
  };

  const handleCompanyView = (companyId: number) => {
    if (typeof companyId !== 'number') {
      console.error('Invalid company ID:', companyId);
      return;
    }
    console.log('Navigating to company:', { companyId });
    setLocation(`/companies/${companyId}`);
  };


  const enrichContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      // Add this contact ID to the set of pending contacts
      setPendingContactIds(prev => {
        const newSet = new Set(prev);
        newSet.add(contactId);
        return newSet;
      });
      const response = await apiRequest("POST", `/api/contacts/${contactId}/enrich`);
      return {data: await response.json(), contactId};
    },
    onSuccess: (result) => {
      // The data and the contactId that was processed
      const {data, contactId} = result;
      
      // Update the currentResults with the enriched contact - use a safer update pattern
      setCurrentResults(prev => {
        if (!prev) return null;
        
        // Make sure we're only updating this specific contact without disturbing other state
        return prev.map(company => {
          // Only update the company that contains this contact
          if (!company.contacts?.some(c => c.id === data.id)) {
            return company;
          }
          
          return {
            ...company,
            contacts: company.contacts?.map(contact =>
              contact.id === data.id ? data : contact
            )
          };
        });
      });
      
      // Remove this contact ID from the set of pending contacts
      setPendingContactIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Only show notifications if we're not in a consolidated search
      if (!isConsolidatedSearching && !isAutomatedSearchRef.current) {
        toast({
          title: "Email Search Complete",
          description: `${data.name}: ${data.email 
            ? "Successfully found email address."
            : "No email found for this contact."}`,
        });
      } else if (isConsolidatedSearching && data.email) {
        // During consolidated search, only show when we find an email
        toast({
          title: "Email Search Complete",
          description: `${data.name}: Successfully found email address.`,
        });
      }
    },
    onError: (error, variables) => {
      const contactId = variables; // This will be the contactId that was passed to mutate
      
      // Remove this contact ID from the set of pending contacts
      setPendingContactIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId as number);
        return newSet;
      });
      
      toast({
        title: "Email Search Failed",
        description: error instanceof Error ? error.message : "Failed to find contact's email",
        variant: "destructive",
      });
    },
  });

  // Update to allow multiple searches to run in parallel
  const handleEnrichContact = (contactId: number) => {
    // Only prevent if this specific contact is already being processed
    if (pendingContactIds.has(contactId)) return;
    enrichContactMutation.mutate(contactId);
  };

  const isContactEnriched = (contact: Contact) => {
    // Consider a contact "enriched" if it's been processed, even if no data was found
    return contact.completedSearches?.includes('contact_enrichment') || false;
  };

  const isContactPending = (contactId: number) => {
    return pendingContactIds.has(contactId);
  };

  // Add mutation for contact feedback
  const feedbackMutation = useMutation({
    mutationFn: async ({ contactId, feedbackType }: { contactId: number; feedbackType: string }) => {
      const response = await apiRequest("POST", `/api/contacts/${contactId}/feedback`, {
        feedbackType,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Update the contact in the results
      setCurrentResults((prev) => {
        if (!prev) return null;
        return prev.map((company) => ({
          ...company,
          contacts: company.contacts?.map((contact) =>
            contact.id === data.contactId
              ? {
                  ...contact,
                  userFeedbackScore: data.userFeedbackScore,
                  feedbackCount: data.feedbackCount,
                }
              : contact
          ),
        }));
      });

      toast({
        title: "Feedback Recorded",
        description: "Thank you for helping improve our contact validation!",
      });
    },
    onError: (error) => {
      toast({
        title: "Feedback Failed",
        description: error instanceof Error ? error.message : "Failed to record feedback",
        variant: "destructive",
      });
    },
  });

  const handleContactFeedback = (contactId: number, feedbackType: string) => {
    feedbackMutation.mutate({ contactId, feedbackType });
  };

  const handleEnrichProspects = async (prospects: ContactWithCompanyInfo[]) => {
    if (prospects.length === 0) {
      toast({
        title: "No Prospects",
        description: "There are no high-probability prospects to enrich.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get all contact IDs regardless of company
      const contactIds = prospects.map(contact => contact.id);

      // Send all contacts for enrichment in a single request
      const response = await apiRequest("POST", `/api/enrich-contacts`, {
        contactIds
      });
      const data = await response.json();

      toast({
        title: "Enrichment Started",
        description: `Started enriching ${contactIds.length} top prospects`,
      });

      // Start polling for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await apiRequest("GET", `/api/enrichment/${data.queueId}/status`);
          const statusData = await statusResponse.json();

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            // Refresh all contacts that were enriched
            const updatedContacts = await Promise.all(
              contactIds.map(async (id) => {
                const contactResponse = await apiRequest("GET", `/api/contacts/${id}`);
                return contactResponse.json();
              })
            );

            // Update the currentResults with the enriched contacts
            setCurrentResults(prev => {
              if (!prev) return null;
              return prev.map(company => ({
                ...company,
                contacts: company.contacts?.map(contact =>
                  updatedContacts.find(uc => uc.id === contact.id) || contact
                )
              }));
            });

            toast({
              title: "Enrichment Complete",
              description: `Successfully enriched ${statusData.completedItems} contacts`,
            });
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            toast({
              title: "Enrichment Failed",
              description: "Failed to complete contact enrichment",
              variant: "destructive",
            });
          }
        } catch (error) {
          clearInterval(pollInterval);
          console.error('Status check error:', error);
        }
      }, 2000); // Check every 2 seconds

      // Clear interval after 5 minutes to prevent infinite polling
      setTimeout(() => clearInterval(pollInterval), 300000);

    } catch (error) {
      toast({
        title: "Enrichment Failed",
        description: error instanceof Error ? error.message : "Failed to start enrichment",
        variant: "destructive",
      });
    }
  };

  //New function added here
  const getEnrichButtonText = (contact: Contact) => {
    if (isContactPending(contact.id)) return "Processing...";
    if (isContactEnriched(contact)) {
      const hasEnrichedData = contact.email || contact.linkedinUrl || contact.phoneNumber || contact.department;
      return hasEnrichedData ? "Enriched" : "No Data Found";
    }
    return "Enrich";
  };

  const getEnrichButtonClass = (contact: Contact) => {
    if (isContactEnriched(contact)) {
      const hasEnrichedData = contact.email || contact.linkedinUrl || contact.phoneNumber || contact.department;
      return hasEnrichedData ? "text-green-500" : "text-muted-foreground opacity-50";
    }
    return "";
  };

  // Add Hunter.io mutation with Set-based state management
  const hunterMutation = useMutation({
    mutationFn: async ({ contactId, searchContext = 'manual' }: { contactId: number; searchContext?: 'manual' | 'automated' }) => {
      // Add this contact ID to the set of pending searches
      setPendingHunterIds(prev => {
        const newSet = new Set(prev);
        newSet.add(contactId);
        return newSet;
      });
      const response = await apiRequest("POST", `/api/contacts/${contactId}/hunter`);
      return {data: await response.json(), contactId, searchContext};
    },
    onSuccess: (result) => {
      const {data, contactId, searchContext} = result;
      
      // Update the contact in the results
      setCurrentResults(prev => {
        if (!prev) return null;
        
        // Only update the specific contact without affecting others
        return prev.map(company => {
          if (!company.contacts?.some(c => c.id === data.id)) {
            return company;
          }
          
          return {
            ...company,
            contacts: company.contacts?.map(contact =>
              contact.id === data.id ? data : contact
            )
          };
        });
      });
      
      // Remove this contact ID from the set of pending searches
      setPendingHunterIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Only show toast notifications based on context
      if (searchContext === 'manual') {
        // Manual searches: show all results (success and no email found)
        toast({
          title: "Hunter.io Email Search Complete",
          description: `${data.name}: ${data.email 
            ? `Found email with ${data.nameConfidenceScore || 'unknown'} confidence.`
            : "No email found for this contact."}`,
        });
      } else if (searchContext === 'automated' && data.email) {
        // Automated searches: only show when email is found
        toast({
          title: "Email Search Complete",
          description: `${data.name}: Successfully found email address.`,
        });
      }
    },
    onError: (error, variables) => {
      const { contactId, searchContext } = variables;
      
      // Remove this contact ID from the set of pending searches
      setPendingHunterIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Only show error notifications for manual searches
      if (searchContext === 'manual') {
        toast({
          title: "Hunter.io Search Failed",
          description: error instanceof Error ? error.message : "Failed to find contact email",
          variant: "destructive",
        });
      }
    },
  });
  
  // Handler for Hunter.io search
  const handleHunterSearch = (contactId: number, searchContext: 'manual' | 'automated' = 'manual') => {
    // Allow multiple searches to run in parallel
    if (pendingHunterIds.has(contactId)) return; // Only prevent if this specific contact is already being processed
    hunterMutation.mutate({ contactId, searchContext });
  };
  
  // Add AeroLeads mutation with Set-based state management
  const aeroLeadsMutation = useMutation({
    mutationFn: async ({ contactId, searchContext = 'manual' }: { contactId: number; searchContext?: 'manual' | 'automated' }) => {
      // Add this contact ID to the set of pending searches
      setPendingAeroLeadsIds(prev => {
        const newSet = new Set(prev);
        newSet.add(contactId);
        return newSet;
      });
      const response = await apiRequest("POST", `/api/contacts/${contactId}/aeroleads`);
      return {data: await response.json(), contactId, searchContext};
    },
    onSuccess: (result) => {
      const {data, contactId, searchContext} = result;
      
      // Update the contact in the results
      setCurrentResults(prev => {
        if (!prev) return null;
        
        // Only update the specific contact without affecting others
        return prev.map(company => {
          if (!company.contacts?.some(c => c.id === data.id)) {
            return company;
          }
          
          return {
            ...company,
            contacts: company.contacts?.map(contact =>
              contact.id === data.id ? data : contact
            )
          };
        });
      });
      
      // Remove this contact ID from the set of pending searches
      setPendingAeroLeadsIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Only show toast notifications based on context
      if (searchContext === 'manual') {
        // Manual searches: show all results (success and no email found)
        toast({
          title: "Email Search Complete",
          description: `${data.name}: ${data.email 
            ? "Successfully found email address."
            : "No email found for this contact."}`,
        });
      } else if (searchContext === 'automated' && data.email) {
        // Automated searches: only show when email is found
        toast({
          title: "Email Search Complete",
          description: `${data.name}: Successfully found email address.`,
        });
      }
    },
    onError: (error, variables) => {
      const { contactId, searchContext } = variables;
      
      // Remove this contact ID from the set of pending searches
      setPendingAeroLeadsIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Only show error notifications for manual searches
      if (searchContext === 'manual') {
        toast({
          title: "AeroLeads Search Failed",
          description: error instanceof Error ? error.message : "Failed to find contact email",
          variant: "destructive",
        });
      }
    },
  });

  const handleAeroLeadsSearch = (contactId: number, searchContext: 'manual' | 'automated' = 'manual') => {
    // Allow multiple searches to run in parallel
    if (pendingAeroLeadsIds.has(contactId)) return; // Only prevent if this specific contact is already being processed
    aeroLeadsMutation.mutate({ contactId, searchContext });
  };

  const isAeroLeadsSearchComplete = (contact: Contact) => {
    return contact.completedSearches?.includes('aeroleads_search') || false;
  };

  const isAeroLeadsPending = (contactId: number) => {
    return pendingAeroLeadsIds.has(contactId);
  };

  const getAeroLeadsButtonClass = (contact: Contact) => {
    if (isAeroLeadsSearchComplete(contact)) {
      return contact.email ? "text-yellow-500" : "text-muted-foreground opacity-50";
    }
    return "";
  };
  
  // Hunter.io helpers
  const isHunterSearchComplete = (contact: Contact) => {
    return contact.completedSearches?.includes('hunter_search') || false;
  };

  const isHunterPending = (contactId: number) => {
    return pendingHunterIds.has(contactId);
  };

  const getHunterButtonClass = (contact: Contact) => {
    if (isHunterSearchComplete(contact)) {
      return contact.email ? "text-blue-500" : "text-muted-foreground opacity-50";
    }
    return "";
  };
  
  // Apollo.io helpers
  const isApolloSearchComplete = (contact: Contact) => {
    return contact.completedSearches?.includes('apollo_search') || false;
  };

  const isApolloPending = (contactId: number) => {
    return pendingApolloIds.has(contactId);
  };
  
  // Consolidated Email Search functionality
  const [isConsolidatedSearching, setIsConsolidatedSearching] = useState(false);
  const isAutomatedSearchRef = useRef(false);
  const [searchProgress, setSearchProgress] = useState({
    phase: "",
    completed: 0,
    total: 0
  });
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [contactReportVisible, setContactReportVisible] = useState(false);
  
  // Effect to highlight Start Selling button when email search completes
  useEffect(() => {
    // If the consolidated search just finished (summary is visible and not searching)
    if (summaryVisible && !isConsolidatedSearching) {
      // Add a 2-second delay before highlighting the Start Selling button
      const timer = setTimeout(() => {
        // The search has completed and results are available, highlight the Start Selling button
        setHighlightStartSellingButton(true);
        setTimeout(() => {
          setHighlightStartSellingButton(false);
        }, 25000);
      }, 2000);
      
      // Clean up timer if component unmounts or dependencies change
      return () => clearTimeout(timer);
    }
  }, [summaryVisible, isConsolidatedSearching]);

  // Email tooltip timing effect
  useEffect(() => {
    // Show email tooltip 5 seconds after first search completes
    if (currentResults && currentResults.length > 0 && !isAnalyzing) {
      const timer = setTimeout(() => {
        setShowEmailTooltip(true);
        setTimeout(() => {
          setShowEmailTooltip(false);
        }, 5000);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [currentResults, isAnalyzing]);

  // Helper to get current companies without emails (only check top 3 contacts)
  const getCurrentCompaniesWithoutEmails = () => {
    return currentResults?.filter(company => 
      !getTopContacts(company, 3).some(contact => contact.email && contact.email.length > 5)
    ) || [];
  };

  // Helper to get a contact by ID from current results
  const getCurrentContact = (contactId: number) => {
    if (!currentResults) return null;
    
    for (const company of currentResults) {
      const contact = company.contacts?.find(c => c.id === contactId);
      if (contact) return contact;
    }
    return null;
  };

  // Helper to get top N contacts from a company based on probability score (same as UI display)
  const getTopContacts = (company: any, count: number) => {
    if (!company.contacts || company.contacts.length === 0) return [];
    
    // Sort by probability score (same as UI display)
    const sorted = [...company.contacts].sort((a, b) => {
      return (b.probability || 0) - (a.probability || 0);
    });
    
    return sorted.slice(0, count);
  };

  // Helper to get the best contact from a company for email search
  const getBestContact = (company: any) => {
    return getTopContacts(company, 1)[0];
  };

  // Helper function to finish search (no longer shows toast)
  const finishSearch = () => {
    setIsConsolidatedSearching(false);
    isAutomatedSearchRef.current = false;
    setSummaryVisible(true);
  };

  // Add delay helper for throttling API requests
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Helper function for processing contacts in parallel batches
  const processContactsBatch = async (
    contacts: Contact[], 
    processFn: (contactId: number) => Promise<any>, 
    batchSize = 3
  ) => {
    // Track total progress for UI updates
    const totalBatches = Math.ceil(contacts.length / batchSize);
    let completedBatches = 0;
    
    // Process contacts in batches of the specified size
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      
      // Process this batch in parallel
      await Promise.all(batch.map(contact => processFn(contact.id)));
      
      // Update progress
      completedBatches++;
      setSearchProgress(prev => ({
        ...prev,
        completed: Math.floor((completedBatches / totalBatches) * prev.total)
      }));
      
      // Small delay between batches to avoid overwhelming APIs
      await delay(200);
      
      // Continue processing all contacts in Perplexity phase to find multiple emails per company
      // (Early termination removed to allow finding 2+ contacts per company)
    }
  };
  
  // Main consolidated email search function with parallel processing
  const runConsolidatedEmailSearch = async () => {
    if (!currentResults || currentResults.length === 0) return;
    
    setIsConsolidatedSearching(true);
    isAutomatedSearchRef.current = true;
    setSummaryVisible(false);
    setSearchProgress({ phase: "Preparing", completed: 0, total: currentResults.length });
    
    try {
      // Get companies without emails (only check top 3 contacts)
      const companiesNeedingEmails = currentResults.filter(company => 
        !getTopContacts(company, 3).some(contact => contact.email && contact.email.length > 5)
      );
      
      if (companiesNeedingEmails.length === 0) {
        setIsConsolidatedSearching(false);
        setSummaryVisible(true);
        return;
      }
      
      // Phase 1: Perplexity search (2 contacts per company) - using parallel processing
      setSearchProgress({ 
        phase: "Perplexity Search", 
        completed: 0, 
        total: companiesNeedingEmails.length 
      });
      
      // Collect all contacts needing emails for parallel processing
      const perplexityContacts: Contact[] = [];
      
      // Collect top contacts from each company
      companiesNeedingEmails.forEach(company => {
        const topContacts = getTopContacts(company, 2)
          .filter(contact => !contact.email || contact.email.length <= 5);
        perplexityContacts.push(...topContacts);
      });
      
      // Process Perplexity searches in parallel batches (7 at a time for faster processing)
      await processContactsBatch(
        perplexityContacts, 
        (contactId) => enrichContactMutation.mutateAsync(contactId),
        7 // Batch size of 7 for Perplexity (one per company for optimal speed)
      );
      
      // Check which companies still need emails (where Perplexity found zero emails)
      const companiesStillNeedingEmails = getCurrentCompaniesWithoutEmails();
      
      if (companiesStillNeedingEmails.length === 0) {
        finishSearch();
        return;
      }
      
      // Phase 2: Apollo search - faster and higher quality primary search
      setSearchProgress({ 
        phase: "Apollo Search", 
        completed: 0, 
        total: companiesStillNeedingEmails.length 
      });
      
      // Collect best contacts for Apollo
      const apolloContacts: Contact[] = [];
      companiesStillNeedingEmails.forEach(company => {
        const bestContact = getBestContact(company);
        if (bestContact && (!bestContact.email || bestContact.email.length <= 5)) {
          apolloContacts.push(bestContact);
        }
      });
      
      // Process Apollo searches in parallel batches (3 at a time)
      await processContactsBatch(
        apolloContacts, 
        (contactId) => apolloMutation.mutateAsync({ contactId, searchContext: 'automated' }),
        3 // Batch size of 3 for Apollo
      );
      
      // Check which companies still need emails
      const companiesNeedingFinalSearch = getCurrentCompaniesWithoutEmails();
      
      if (companiesNeedingFinalSearch.length === 0) {
        finishSearch();
        return;
      }
      
      // Phase 3: Hunter search - specialized email-focused fallback
      setSearchProgress({ 
        phase: "Hunter Search", 
        completed: 0, 
        total: companiesNeedingFinalSearch.length 
      });
      
      // Collect best contacts for Hunter
      const hunterContacts: Contact[] = [];
      companiesNeedingFinalSearch.forEach(company => {
        const bestContact = getBestContact(company);
        if (bestContact && (!bestContact.email || bestContact.email.length <= 5)) {
          hunterContacts.push(bestContact);
        }
      });
      
      // Process Hunter searches in parallel batches (3 at a time)
      await processContactsBatch(
        hunterContacts, 
        (contactId) => hunterMutation.mutateAsync({ contactId, searchContext: 'automated' }),
        3 // Batch size of 3 for Hunter
      );
      
      // Final summary - no toast needed
      finishSearch();
      
    } catch (error) {
      console.error("Consolidated email search error:", error);
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
      setIsConsolidatedSearching(false);
      isAutomatedSearchRef.current = false;
    }
  };

  const getApolloButtonClass = (contact: Contact) => {
    if (isApolloSearchComplete(contact)) {
      return contact.email ? "text-purple-500" : "text-muted-foreground opacity-50";
    }
    return "";
  };
  
  // Apollo.io mutation
  const apolloMutation = useMutation({
    mutationFn: async ({ contactId, searchContext = 'manual' }: { contactId: number; searchContext?: 'manual' | 'automated' }) => {
      // Add this contact ID to the set of pending searches
      setPendingApolloIds(prev => {
        const newSet = new Set(prev);
        newSet.add(contactId);
        return newSet;
      });
      const response = await apiRequest("POST", `/api/contacts/${contactId}/apollo`);
      return {data: await response.json(), contactId, searchContext};
    },
    onSuccess: (result) => {
      const {data, contactId, searchContext} = result;
      
      // Update the contact in the results
      setCurrentResults(prev => {
        if (!prev) return null;
        
        // Only update the specific contact without affecting others
        return prev.map(company => {
          if (!company.contacts?.some(c => c.id === data.id)) {
            return company;
          }
          
          return {
            ...company,
            contacts: company.contacts?.map(contact =>
              contact.id === data.id ? data : contact
            )
          };
        });
      });
      
      // Remove this contact ID from the set of pending searches
      setPendingApolloIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Only show toast notifications based on context
      if (searchContext === 'manual') {
        // Manual searches: show all results (success and no email found)
        toast({
          title: "Apollo.io Search Complete",
          description: `${data.name}: ${data.email 
            ? `Found email with ${data.nameConfidenceScore || 'unknown'} confidence.`
            : "No email found for this contact."}`,
        });
      } else if (searchContext === 'automated' && data.email) {
        // Automated searches: only show when email is found
        toast({
          title: "Email Search Complete",
          description: `${data.name}: Successfully found email address.`,
        });
      }
    },
    onError: (error, variables) => {
      const { contactId, searchContext } = variables;
      
      // Remove this contact ID from the set of pending searches
      setPendingApolloIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Only show error notifications for manual searches
      if (searchContext === 'manual') {
        toast({
          title: "Apollo.io Search Failed",
          description: error instanceof Error ? error.message : "Failed to find contact email",
          variant: "destructive",
        });
      }
    },
  });
  
  // Handler for Apollo.io search
  const handleApolloSearch = (contactId: number, searchContext: 'manual' | 'automated' = 'manual') => {
    // Allow multiple searches to run in parallel
    if (pendingApolloIds.has(contactId)) return; // Only prevent if this specific contact is already being processed
    apolloMutation.mutate({ contactId, searchContext });
  };
  
  // Functions for checkbox selection
  const handleCheckboxChange = (contactId: number) => {
    setSelectedContacts(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(contactId)) {
        newSelected.delete(contactId);
      } else {
        newSelected.add(contactId);
      }
      return newSelected;
    });
  };

  const isContactSelected = (contactId: number) => {
    return selectedContacts.has(contactId);
  };

  const handleSelectAllContacts = () => {
    const prospects = getTopProspects();
    if (prospects.length === 0) return;
    
    // If all are already selected, deselect all
    if (prospects.every(contact => selectedContacts.has(contact.id))) {
      setSelectedContacts(new Set());
    } else {
      // Otherwise select all
      setSelectedContacts(new Set(prospects.map(contact => contact.id)));
    }
  };

  // Get selected contacts for batch operations
  const getSelectedProspects = () => {
    return getTopProspects().filter(contact => selectedContacts.has(contact.id));
  };

  return (
    <div className="container mx-auto py-6">
      {/* Intro tour modal has been removed */}

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content Area - full width */}
        <div className="col-span-12 space-y-4 mt-[-10px]">
          {/* Search Section - border removed and moved up */}
          <div className="px-6 py-1"> {/* Matched padding with CardHeader (p-6) */}
            <div className="flex flex-col-reverse md:flex-row items-center gap-4 mb-3">
              <h2 className="text-2xl font-semibold mt-2 md:mt-0">Search for target businesses</h2>
              <div>
                <EggAnimation />
              </div>
            </div>
            <Suspense fallback={<div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>}>
              <PromptEditor
                onAnalyze={() => setIsAnalyzing(true)}
                onComplete={handleAnalysisComplete}
                onSearchResults={handleSearchResults}
                onCompaniesReceived={handleCompaniesReceived}
                isAnalyzing={isAnalyzing}
                initialPrompt={currentQuery || ""}
                isFromLandingPage={isFromLandingPage}
                onDismissLandingHint={() => setIsFromLandingPage(false)}
                lastExecutedQuery={lastExecutedQuery}
                onInputChange={(newValue) => setInputHasChanged(newValue !== lastExecutedQuery)}
                onSearchSuccess={() => {
                  // Highlight only the email search button for 25 seconds
                setHighlightEmailButton(true);
                setTimeout(() => {
                  setHighlightEmailButton(false);
                }, 25000);
                }}
                hasSearchResults={currentResults ? currentResults.length > 0 : false}
            />
            </Suspense>
          </div>

          {/* Companies Analysis Section - Moved to top */}
          {currentResults && currentResults.length > 0 ? (
            <Card className="w-full fluffy-gradient-bg">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Companies Analysis</CardTitle>
                  {currentResults && (
                    <Button
                      variant="outline"
                      onClick={handleSaveList}
                      disabled={isSaved || saveMutation.isPending}
                      className="opacity-45 hover:opacity-100 hover:bg-white transition-all"
                    >
                      <ListPlus className="mr-2 h-4 w-4" />
                      {isSaved ? "Saved" : "Save as List"}
                    </Button>
                  )}
                </div>
                {currentQuery && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Search: {currentQuery}
                  </p>
                )}
              </CardHeader>
              
              {/* Contact Discovery Report - with reduced padding */}
              {contactReportVisible && (
                <div className="px-4 pt-0 pb-2">
                  <ContactDiscoveryReport 
                    companiesWithContacts={currentResults?.filter(company => 
                      company.contacts && company.contacts.length > 0).length || 0}
                    totalCompanies={currentResults?.length || 0}
                    totalContacts={currentResults?.reduce((sum, company) => 
                      sum + (company.contacts?.length || 0), 0) || 0}
                    onClose={() => setContactReportVisible(false)}
                    isVisible={contactReportVisible}
                  />
                </div>
              )}

              {/* Email Search Summary - with reduced padding */}
              {summaryVisible && (
                <div className="px-4 pt-1 pb-0">
                  <EmailSearchSummary 
                    companiesWithEmails={currentResults?.filter(company => 
                      getTopContacts(company, 3).some(contact => contact.email && contact.email.length > 5)).length || 0}
                    totalCompanies={currentResults?.length || 0}
                    onClose={() => setSummaryVisible(false)}
                    isVisible={summaryVisible}
                  />
                </div>
              )}
              
              {/* Email Search Progress - with reduced padding */}
              {isConsolidatedSearching && (
                <div className="px-4 pt-0 pb-3">
                  <SearchProgress 
                    phase={searchProgress.phase}
                    completed={searchProgress.completed}
                    total={searchProgress.total}
                    isVisible={isConsolidatedSearching}
                  />
                </div>
              )}
              
              {/* Mini Search Menu */}
              {currentResults && currentResults.length > 0 && (
                <div className="px-6 pb-3 flex items-center gap-2">
                  <div className="relative">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={`flex items-center gap-1 h-8 ${
                        highlightEmailButton 
                          ? 'email-button-highlight' 
                          : 'opacity-45 hover:opacity-100 hover:bg-white'
                      } transition-all`}
                      onClick={() => {
                        try {
                          if (isFromLandingPage && setIsFromLandingPage) {
                            setIsFromLandingPage(false);
                          }
                        } catch (e) {
                          // Silent fail - prevents error from showing to users
                        }
                        runConsolidatedEmailSearch();
                      }}
                      disabled={isConsolidatedSearching}
                    >
                      <Mail className={`h-4 w-4 ${isConsolidatedSearching ? "animate-spin" : ""}`} />
                      <span>{isConsolidatedSearching ? "Searching..." : "Find Key Emails"}</span>
                    </Button>
                    
                    <LandingPageTooltip
                      message="Click here to find Egg-cellent emails of wonderful people."
                      visible={showEmailTooltip && !(isAnalyzing || isConsolidatedSearching)}
                      position="custom"
                      offsetX={-10}
                    />
                  </div>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`flex items-center gap-1 h-8 ${
                            highlightStartSellingButton 
                              ? 'email-button-highlight' 
                              : 'opacity-45 hover:opacity-100 hover:bg-white'
                          } transition-all`}
                          onClick={handleStartSelling}
                        >
                          <Rocket className="h-4 w-4" />
                          <span>Start Selling</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Save list, open "Outreach" page & load this list</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex items-center gap-1 h-8 opacity-45 hover:opacity-100 hover:bg-white transition-all"
                          onClick={() => {
                            if (!auth.user) {
                              registrationModal.openModal();
                              return;
                            }
                            // If user is logged in, the actual functionality would go here
                            console.log("5 More button clicked by authenticated user");
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          <span>5 More</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Expand the search to include another five companies with the same prompt</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex items-center gap-1 h-8 opacity-45 hover:opacity-100 hover:bg-white transition-all"
                        >
                          <ChevronDown className="h-4 w-4" />
                          <span>Expand</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Expand or collapse all company rows of contacts</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
              
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Suspense fallback={<TableSkeleton />}>
                    <CompanyTable
                      companies={currentResults || []}
                      handleCompanyView={handleCompanyView}
                      handleHunterSearch={handleHunterSearch}
                      handleAeroLeadsSearch={handleAeroLeadsSearch}
                      handleApolloSearch={handleApolloSearch}
                      handleEnrichContact={handleEnrichContact}
                      pendingHunterIds={pendingHunterIds}
                      pendingAeroLeadsIds={pendingAeroLeadsIds}
                      pendingApolloIds={pendingApolloIds}
                    pendingContactIds={pendingContactIds}
                  />
                  </Suspense>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Top Prospects Section - Moved below Companies Analysis */}
          {currentResults && currentResults.length > 0 && (
            <Card className="w-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UserCircle className="w-5 h-5" />
                    Top Prospects
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const selectedProspects = getSelectedProspects();
                        if (selectedProspects.length > 0) {
                          handleEnrichProspects(selectedProspects);
                        } else {
                          handleEnrichProspects(getTopProspects());
                        }
                      }}
                    >
                      <Banknote className="mr-2 h-4 w-4" />
                      {selectedContacts.size > 0 
                        ? `Enrich Selected (${selectedContacts.size})` 
                        : "Enrich All Prospects"}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Highest probability contacts across all companies
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox 
                            checked={getTopProspects().length > 0 && 
                              getTopProspects().every(contact => selectedContacts.has(contact.id))}
                            onCheckedChange={handleSelectAllContacts}
                            aria-label="Select all contacts"
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell"><span className="text-xs">Company</span></TableHead>
                        <TableHead className="hidden md:table-cell"><span className="text-xs">Email</span></TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getTopProspects().map((contact) => (
                        <TableRow key={contact.id} className="group">
                          <TableCell className="w-10">
                            <Checkbox 
                              checked={isContactSelected(contact.id)}
                              onCheckedChange={() => handleCheckboxChange(contact.id)}
                              aria-label={`Select ${contact.name}`}
                            />
                          </TableCell>
                          <TableCell className="py-1 pl-1">
                            <div className="font-medium leading-tight">{contact.name}</div>
                            <div className="text-xs text-slate-500 leading-tight -mt-0.5 truncate max-w-[300px]" title={contact.role || "N/A"}>
                              {contact.role || "N/A"}
                            </div>
                            <div className="md:hidden text-xs text-muted-foreground leading-tight mt-0.5">
                              <div>{contact.companyName}</div>
                              <div className="flex flex-col mt-1">
                                <div>{contact.email || (
                                  <Mail className="h-4 w-4 text-gray-400 inline" />
                                )}</div>
                                {contact.alternativeEmails && contact.alternativeEmails.length > 0 && (
                                  <div className="flex flex-col gap-0.5 mt-1">
                                    {contact.alternativeEmails.map((email, i) => (
                                      <span key={i} className="italic opacity-70">
                                        {email}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          
                          {/* Company name - hidden on mobile, shown as small text */}
                          <TableCell className="hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">{contact.companyName}</span>
                          </TableCell>
                          
                          {/* Email - hidden on mobile, shown as small text */}
                          <TableCell className="py-1 hidden md:table-cell">
                            <div className="text-xs text-muted-foreground">
                              {contact.email || (
                                <TooltipProvider delayDuration={300}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-muted-foreground">
                                        <Mail className="h-4 w-4 text-gray-400" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      <p>Use "Action" icons on this row to find this email. 👉🏼</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            {contact.alternativeEmails && contact.alternativeEmails.length > 0 && (
                              <div className="text-xs text-muted-foreground opacity-75 mt-1">
                                {contact.alternativeEmails.map((altEmail, index) => (
                                  <div key={index} className="text-xs italic">
                                    {altEmail}
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            <Badge
                              variant={
                                (contact.probability || 0) >= 90
                                  ? "default"
                                  : (contact.probability || 0) >= 70
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {contact.probability || 0}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center">
                              {/* Contact actions (first 5 icons) */}
                              <ContactActionColumn
                                contact={contact}
                                handleContactView={handleContactView}
                                handleEnrichContact={handleEnrichContact}
                                handleHunterSearch={handleHunterSearch}
                                handleAeroLeadsSearch={handleAeroLeadsSearch}
                                handleApolloSearch={handleApolloSearch}
                                pendingContactIds={pendingContactIds}
                                pendingHunterIds={pendingHunterIds}
                                pendingAeroLeadsIds={pendingAeroLeadsIds}
                                pendingApolloIds={pendingApolloIds}
                                standalone={true}
                              />
                              
                              {/* Feedback button - both desktop and mobile */}
                              <TooltipProvider delayDuration={500}>
                                <Tooltip>
                                  <DropdownMenu>
                                    <TooltipTrigger asChild>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1">
                                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <DropdownMenuContent>
                                      <DropdownMenuItem onClick={() => handleContactFeedback(contact.id, "excellent")}>
                                        <Star className="h-4 w-4 mr-2 text-yellow-500" />
                                        Excellent Match
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleContactFeedback(contact.id, "ok")}>
                                        <ThumbsUp className="h-4 w-4 mr-2 text-blue-500" />
                                        OK Match
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleContactFeedback(contact.id, "terrible")}>
                                        <ThumbsDown className="h-4 w-4 mr-2 text-red-500" />
                                        Not a Match
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <TooltipContent>
                                    <p>Rate this contact</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {getTopProspects().length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No high-probability contacts found in the search results
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* API Templates Button moved to settings drawer */}
      </div>
    </div>
  );
}