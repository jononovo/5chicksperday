import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchProgress } from "@/components/search-progress";
import { LandingPageTooltip } from "@/components/ui/landing-page-tooltip";
import { TableSkeleton } from "@/components/ui/table-skeleton";

// Lazy load heavy components
const CompanyCards = lazy(() => import("@/components/company-cards"));
const PromptEditor = lazy(() => import("@/components/prompt-editor"));

// Import components with named exports directly for now
import { EmailSearchSummary } from "@/components/email-search-summary";
import { ContactDiscoveryReport } from "@/components/contact-discovery-report";
import { EmailComposer } from "@/components/email-composer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useRegistrationModal } from "@/hooks/use-registration-modal";
import { useNotifications } from "@/features/user-account-settings";
import { useStrategyOverlay } from "@/features/strategy-chat";
import { NotificationToast } from "@/components/ui/notification-toast";
import {
  Search,
  Code2,
  UserCircle,
  Banknote,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  ThumbsUp,
  ThumbsDown,
  Star,
  MessageSquare,
  Gem,
  MoreHorizontal,
  Menu,
  Mail,
  Target,
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
import type { Company, Contact, List } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { filterTopProspects, ContactWithCompanyInfo } from "@/lib/results-analysis/prospect-filtering";
import { Checkbox } from "@/components/ui/checkbox";
import { ContactActionColumn } from "@/components/contact-action-column";
import { SearchSessionManager } from "@/lib/search-session-manager";
import { SavedSearchesDrawer } from "@/components/saved-searches-drawer";
import { useComprehensiveEmailSearch } from "@/hooks/use-comprehensive-email-search";

// Extend Company type to include contacts
interface CompanyWithContacts extends Company {
  contacts?: ContactWithCompanyInfo[];
}

// Define interface for the saved state
interface SavedSearchState {
  currentQuery: string | null;
  currentResults: CompanyWithContacts[] | null;
  currentListId: number | null;
  lastExecutedQuery?: string | null;
  emailSearchCompleted?: boolean;
  emailSearchTimestamp?: number;
  navigationRefreshTimestamp?: number;
}

// Define SourceBreakdown interface to match EmailSearchSummary
interface SourceBreakdown {
  Perplexity: number;
  Apollo: number;
  Hunter: number;
}

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentQuery, setCurrentQuery] = useState<string>("");
  const [currentResults, setCurrentResults] = useState<CompanyWithContacts[] | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [currentListId, setCurrentListId] = useState<number | null>(null);
  const [companiesViewMode, setCompaniesViewMode] = useState<'scroll' | 'slides'>('scroll');
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
  // Track current session ID for email search persistence
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showEmailTooltip, setShowEmailTooltip] = useState(false);
  const [hasShownEmailTooltip, setHasShownEmailTooltip] = useState(false);
  // Tour modal has been removed
  const [pendingHunterIds, setPendingHunterIds] = useState<Set<number>>(new Set());
  const [pendingApolloIds, setPendingApolloIds] = useState<Set<number>>(new Set());
  const [savedSearchesDrawerOpen, setSavedSearchesDrawerOpen] = useState(false);
  
  // State for email drawer
  const [emailDrawerOpen, setEmailDrawerOpen] = useState(false);
  const [selectedEmailContact, setSelectedEmailContact] = useState<Contact | null>(null);
  const [selectedEmailCompany, setSelectedEmailCompany] = useState<Company | null>(null);
  const [selectedCompanyContacts, setSelectedCompanyContacts] = useState<Contact[]>([]);
  const [drawerWidth, setDrawerWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [searchSectionCollapsed, setSearchSectionCollapsed] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const registrationModal = useRegistrationModal();
  const auth = useAuth();
  const { notificationState, triggerNotification, closeNotification } = useNotifications();
  const { setState: setStrategyOverlayState } = useStrategyOverlay();
  
  // Use shared comprehensive email search hook
  // Handler for contact click to open email drawer
  const handleContactClick = (contact: ContactWithCompanyInfo, company: Company) => {
    setSelectedEmailContact(contact);
    setSelectedEmailCompany(company);
    
    // Get all contacts from the same company
    const companyContacts = currentResults
      ?.find(c => c.id === company.id)
      ?.contacts || [];
    setSelectedCompanyContacts(companyContacts);
    
    // Check if contact has an email and show appropriate notification
    if (contact.email) {
      toast({
        title: "Email populated",
        description: `${contact.name}'s email added to recipient field`,
      });
    } else {
      // Check if we've already searched comprehensively for this contact
      const hasSearchedComprehensively = contact.completedSearches?.includes('comprehensive_search');
      
      if (hasSearchedComprehensively) {
        toast({
          title: "No email available",
          description: `All search methods have been exhausted for ${contact.name}. Consider selecting another contact.`,
          variant: "default",
        });
      } else {
        toast({
          title: "No email found",
          description: `Click the "Find email" button to search for it.`,
          variant: "default",
        });
      }
    }
    
    setEmailDrawerOpen(true);
    // Auto-collapse search section when email drawer opens
    setSearchSectionCollapsed(true);
  };
  
  const handleEmailContactChange = (newContact: Contact) => {
    setSelectedEmailContact(newContact);
  };

  // Auto-collapse search section when email drawer opens
  useEffect(() => {
    if (emailDrawerOpen) {
      setSearchSectionCollapsed(true);
    } else {
      // Optionally expand when drawer closes
      setSearchSectionCollapsed(false);
    }
  }, [emailDrawerOpen]);
  
  const { 
    handleComprehensiveEmailSearch: comprehensiveSearchHook, 
    pendingSearchIds: pendingComprehensiveSearchIds 
  } = useComprehensiveEmailSearch({
    onContactUpdate: (updatedContact) => {
      // Update the contact in currentResults
      setCurrentResults(prev => {
        if (!prev) return null;
        const updatedResults = prev.map(company => ({
          ...company,
          contacts: company.contacts?.map(contact =>
            contact.id === updatedContact.id 
              ? { ...updatedContact, companyName: company.name, companyId: company.id } as ContactWithCompanyInfo
              : contact
          )
        }));
        
        // Save to localStorage for persistence
        // Save lastExecutedQuery as currentQuery to ensure consistency
        const queryToSave = lastExecutedQuery || currentQuery;
        const stateToSave = {
          currentQuery: queryToSave,
          currentResults: updatedResults,
          currentListId,
          lastExecutedQuery
        };
        localStorage.setItem('searchState', JSON.stringify(stateToSave));
        sessionStorage.setItem('searchState', JSON.stringify(stateToSave));
        
        return updatedResults;
      });
    }
  });

  // Check if user has already seen email tooltip
  useEffect(() => {
    const checkEmailTooltipStatus = async () => {
      if (auth?.user) {
        try {
          const response = await fetch('/api/notifications/status', {
            headers: {
              ...(localStorage.getItem('authToken') && { 
                'Authorization': `Bearer ${localStorage.getItem('authToken')}` 
              })
            },
            credentials: 'include'
          });
          const data = await response.json();
          if (data.notifications && data.notifications[3] === 1) {
            setHasShownEmailTooltip(true);
          }
        } catch (error) {
          console.error('Failed to check email tooltip status:', error);
        }
      }
    };
    
    checkEmailTooltipStatus();
  }, [auth?.user]);


  // Handle tooltip dismissal when clicked
  useEffect(() => {
    const handleTooltipDismiss = async () => {
      // Dismiss email discovery tooltip
      if (showEmailTooltip) {
        setShowEmailTooltip(false);
        setHasShownEmailTooltip(true); // Mark as shown
        
        // Mark email tooltip as shown for authenticated users
        if (auth?.user) {
          try {
            await fetch('/api/notifications/mark-shown', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(localStorage.getItem('authToken') && { 
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}` 
                })
              },
              credentials: 'include',
              body: JSON.stringify({ notificationId: 3 })
            });
          } catch (error) {
            console.error('Failed to mark email tooltip as shown:', error);
          }
        }
      }
    };

    window.addEventListener('dismissTooltip', handleTooltipDismiss);
    return () => window.removeEventListener('dismissTooltip', handleTooltipDismiss);
  }, [showEmailTooltip, auth?.user, hasShownEmailTooltip]);
  
  // Track if component is mounted to prevent localStorage corruption during unmount
  const isMountedRef = useRef(true);
  const isInitializedRef = useRef(false);
  const hasSessionRestoredDataRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshVersionRef = useRef(0);  // For preventing race conditions in refresh operations

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



  // Auto-refresh contact data if there was a recent email search
  const refreshContactDataIfNeeded = async (companies: CompanyWithContacts[]) => {
    try {
      // Check if there was a recent email search (within last 2 minutes)
      const lastEmailSearch = localStorage.getItem('lastEmailSearchTimestamp');
      if (lastEmailSearch) {
        const timeSinceSearch = Date.now() - parseInt(lastEmailSearch);
        if (timeSinceSearch < 120000) { // 2 minutes
          console.log('Recent email search detected, refreshing contact data...');
          
          // Use the unified refresh helper with email search timestamp clearing
          const refreshedResults = await refreshAndUpdateResults(
            companies,
            {
              currentQuery: currentQuery,
              currentListId: currentListId,
              lastExecutedQuery: lastExecutedQuery
            },
            {
              clearEmailSearchTimestamp: true
            }
          );
          
          console.log('Contact data refresh completed');
          
          // Return the refreshed results for immediate use
          return refreshedResults;
        }
      }
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }
    
    // Return original companies if no refresh was needed
    return companies;
  };

  // Helper function to check if data has complete contact information
  const hasCompleteContacts = (data: CompanyWithContacts[] | null): boolean => {
    if (!data || !Array.isArray(data)) return false;
    
    // Check if at least one company has contacts
    return data.some(company => 
      company.contacts && Array.isArray(company.contacts) && company.contacts.length > 0
    );
  };

  // Enhanced data refresh logic for navigation persistence
  const refreshContactDataFromDatabase = async (
    companies: CompanyWithContacts[],
    options?: { forceFresh?: boolean }
  ): Promise<CompanyWithContacts[]> => {
    try {
      console.log('Refreshing contact data from database for navigation persistence...');
      
      const refreshedResults = await Promise.all(
        companies.map(async (company) => {
          try {
            // Add cache-busting timestamp to ensure fresh data when requested
            const timestamp = options?.forceFresh ? Date.now() : null;
            const url = timestamp 
              ? `/api/companies/${company.id}/contacts?t=${timestamp}`
              : `/api/companies/${company.id}/contacts`;
            const response = await apiRequest("GET", url);
            const freshContacts = await response.json();
            
            console.log(`Refreshed ${freshContacts.length} contacts for ${company.name}:`, 
              freshContacts.map((c: Contact) => ({ name: c.name, email: c.email, hasEmail: !!c.email })));
            
            return {
              ...company,
              contacts: freshContacts
            };
          } catch (error) {
            console.error(`Failed to refresh contacts for company ${company.id}:`, error);
            return company;
          }
        })
      );
      
      console.log('Contact data refresh completed from database');
      return refreshedResults;
    } catch (error) {
      console.error('Database refresh failed:', error);
      return companies;
    }
  };

  // Load state from localStorage on component mount
  useEffect(() => {
    // Check for pending search query from landing page
    const pendingQuery = localStorage.getItem('pendingSearchQuery');
    if (pendingQuery) {
      console.log('Found pending search query:', pendingQuery);
      setCurrentQuery(pendingQuery);
      setIsFromLandingPage(true); // Set flag when coming from landing page
      setHasShownEmailTooltip(false); // Reset tooltip flag for new session
      localStorage.removeItem('pendingSearchQuery');
      // Clear any existing search state when starting fresh search
      localStorage.removeItem('searchState');
      sessionStorage.removeItem('searchState');
      // No longer automatically triggering search - user must click the search button
    } else {
      // Enhanced data restoration logic with intelligent merging
      const savedState = loadSearchState();
      
      if (savedState && savedState.currentResults && !hasSessionRestoredDataRef.current) {
        console.log('Found localStorage data:', {
          query: savedState.currentQuery,
          resultsCount: savedState.currentResults?.length,
          hasContacts: hasCompleteContacts(savedState.currentResults),
          listId: savedState.currentListId
        });
        
        // Always restore the data first
        setCurrentQuery(savedState.currentQuery || "");
        setCurrentResults(savedState.currentResults);
        setCurrentListId(savedState.currentListId);
        setLastExecutedQuery(savedState.lastExecutedQuery || savedState.currentQuery);
        setInputHasChanged(false); // Set to false when loading saved state
        
        // Always refresh contact data when restoring from localStorage to ensure emails are preserved
        console.log('Refreshing contact data from database to preserve emails after navigation');
        console.log('Companies before refresh:', savedState.currentResults.map((c: CompanyWithContacts) => ({
          name: c.name,
          contactCount: c.contacts?.length || 0,
          contactsWithEmails: c.contacts?.filter(contact => contact.email).length || 0
        })));
        
        // SIMPLIFIED NAVIGATION RESTORATION: Always refresh from database
        console.log('NAVIGATION: Restoring search state and refreshing from database');
        
        // Set basic state first
        setCurrentQuery(savedState.currentQuery || "");
        setCurrentListId(savedState.currentListId);
        setCurrentResults(savedState.currentResults);
        setLastExecutedQuery(savedState.lastExecutedQuery || savedState.currentQuery);
        setInputHasChanged(false); // Set to false when loading saved state
        
        // Always refresh from database to ensure fresh data (including emails)
        refreshAndUpdateResults(
          savedState.currentResults,
          {
            currentQuery: savedState.currentQuery || "",
            currentListId: savedState.currentListId,
            lastExecutedQuery: savedState.lastExecutedQuery || savedState.currentQuery
          },
          {
            additionalStateFields: {
              emailSearchCompleted: savedState.emailSearchCompleted || false,
              emailSearchTimestamp: savedState.emailSearchTimestamp || null,
              navigationRefreshTimestamp: Date.now()
            }
          }
        ).then(refreshedResults => {
          const emailsAfterRefresh = refreshedResults.reduce((total, company) => 
            total + (company.contacts?.filter(c => c.email && c.email.length > 0).length || 0), 0
          );
          
          console.log(`NAVIGATION: Database refresh completed with ${emailsAfterRefresh} emails`);
          console.log('NAVIGATION: Companies after refresh:', refreshedResults.map(c => ({
            name: c.name,
            contactCount: c.contacts?.length || 0,
            contactsWithEmails: c.contacts?.filter(contact => contact.email && contact.email.length > 0).length || 0
          })));
          
          if (emailsAfterRefresh > 0) {
            console.log(`NAVIGATION: Successfully restored ${emailsAfterRefresh} emails`);
          }
        }).catch(error => {
          console.error('NAVIGATION: Database refresh failed:', error);
          // Fallback to using saved state as-is
          setCurrentResults(savedState.currentResults);
        });
      } else {
        console.log('No saved search state found or session data already restored');
      }
    }

    // Registration success callback setup (only set once)
    const handleRegistrationSuccess = async () => {
      console.log('Registration success detected, triggering welcome notification');
      
      try {
        // Extract guest data BEFORE cleanup (critical timing fix)
        const savedState = loadSearchState();
        const guestData = {
          originalQuery: savedState?.currentQuery || null
        };
        
        console.log('Extracted guest data:', guestData);
        
        // Clear all guest localStorage data
        localStorage.removeItem('searchState');
        sessionStorage.removeItem('searchState');
        localStorage.removeItem('contactSearchConfig');
        localStorage.removeItem('lastEmailSearchTimestamp');
        localStorage.removeItem('pendingSearchQuery');
        
        // Clear component state
        setCurrentResults(null);
        setCurrentListId(null);
        setIsSaved(false);
        setContactsLoaded(false);
        
        // Reset search button state for clean starting point
        setLastExecutedQuery(null);
        setInputHasChanged(false);
        
        // Clear saved searches cache to remove demo user's lists
        queryClient.invalidateQueries({ queryKey: ['/api/lists'] });
        
        console.log('Guest data cleared successfully');
        
        // Restore original query to input field
        if (guestData.originalQuery) {
          setCurrentQuery(guestData.originalQuery);
          console.log('Restored guest query to input:', guestData.originalQuery);
        }
        
        // Toast removed - redundant with welcome notification system
        
        // Trigger welcome notification
        await triggerNotification('registration_complete');
      } catch (error) {
        console.error('Failed to handle registration success:', error);
      }
    };

    // Only set callback once when component mounts
    if (!isInitializedRef.current) {
      registrationModal.setRegistrationSuccessCallback(handleRegistrationSuccess);
    }
    
    // Mark component as initialized
    isInitializedRef.current = true;
    
    // Cleanup function to prevent localStorage corruption during unmount
    return () => {
      isMountedRef.current = false;
    };
  }, []); // Remove dependencies to prevent re-running

  // Save state to localStorage whenever it changes (but prevent corruption during unmount)
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set 1000ms delay for existing save logic
    debounceTimerRef.current = setTimeout(() => {
      // Only save if component is mounted and initialized (prevents corruption during unmount)
      if (!isMountedRef.current || !isInitializedRef.current) {
        console.log('Skipping localStorage save - component not ready or unmounting');
        return;
      }
      
      // Only save if we have meaningful data (prevents saving null states)
      if (currentQuery || (currentResults && currentResults.length > 0)) {
        // Save lastExecutedQuery as currentQuery to ensure the saved query matches the results
        // If no search has been executed yet, fall back to currentQuery
        const queryToSave = lastExecutedQuery || currentQuery;
        const stateToSave: SavedSearchState = {
          currentQuery: queryToSave,
          currentResults,
          currentListId,
          lastExecutedQuery
        };
        console.log('Saving search state:', {
          query: queryToSave,
          resultsCount: currentResults?.length,
          listId: currentListId,
          companies: currentResults?.map(c => ({ id: c.id, name: c.name }))
        });
        
        // Save to both localStorage and sessionStorage for redundancy
        const stateString = JSON.stringify(stateToSave);
        localStorage.setItem('searchState', stateString);
        sessionStorage.setItem('searchState', stateString);
      } else {
        console.log('Skipping localStorage save - no meaningful data to save');
      }
    }, 1000);
    
    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [currentQuery, currentResults, currentListId, lastExecutedQuery]);





  
  // Auto-creation mutation for silent list creation after search
  const autoCreateListMutation = useMutation({
    mutationFn: async () => {
      if (!currentQuery || !currentResults) return;
      
      // Get current contact search config from localStorage
      const savedConfig = localStorage.getItem('contactSearchConfig');
      let contactSearchConfig = null;
      if (savedConfig) {
        try {
          contactSearchConfig = JSON.parse(savedConfig);
        } catch (error) {
          console.error('Error parsing contact search config:', error);
        }
      }
      
      const res = await apiRequest("POST", "/api/lists", {
        companies: currentResults,
        prompt: currentQuery,
        contactSearchConfig: contactSearchConfig
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lists"] });
      setCurrentListId(data.listId); // Track the auto-created list
      setIsSaved(true); // Mark as saved
      // No toast notification (silent auto-save)
    },
    onError: (error) => {
      console.error("Auto list creation failed:", error);
      // Silent failure - don't show error to user
    },
  });

  // Mutation for updating existing list
  const updateListMutation = useMutation({
    mutationFn: async () => {
      if (!currentQuery || !currentResults || !currentListId) {
        console.error('Update list validation failed:', {
          hasQuery: !!currentQuery,
          hasResults: !!currentResults,
          hasListId: !!currentListId,
          currentListId
        });
        throw new Error('Missing required data for list update');
      }
      
      console.log('Starting list update:', {
        listId: currentListId,
        query: currentQuery,
        companyCount: currentResults.length,
        companyIds: currentResults.map(c => c.id)
      });
      
      // Get current contact search config from localStorage
      const savedConfig = localStorage.getItem('contactSearchConfig');
      let contactSearchConfig = null;
      if (savedConfig) {
        try {
          contactSearchConfig = JSON.parse(savedConfig);
        } catch (error) {
          console.error('Error parsing contact search config:', error);
        }
      }
      
      const res = await apiRequest("PUT", `/api/lists/${currentListId}`, {
        companies: currentResults,
        prompt: currentQuery,
        contactSearchConfig: contactSearchConfig
      });
      return res.json();
    },
    onSuccess: (data) => {
      console.log('List update successful:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/lists"] });
      toast({
        title: "List Updated",
        description: "Your search results have been updated.",
      });
    },
    onError: (error) => {
      console.error('List update failed:', error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });



  // Mutation for saving and navigating to outreach
  const saveAndNavigateMutation = useMutation({
    mutationFn: async () => {
      if (!currentQuery || !currentResults) return null;
      
      // Get current contact search config from localStorage
      const savedConfig = localStorage.getItem('contactSearchConfig');
      let contactSearchConfig = null;
      if (savedConfig) {
        try {
          contactSearchConfig = JSON.parse(savedConfig);
        } catch (error) {
          console.error('Error parsing contact search config:', error);
        }
      }
      
      const res = await apiRequest("POST", "/api/lists", {
        companies: currentResults,
        prompt: currentQuery,
        contactSearchConfig: contactSearchConfig
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

  // Helper function to sort companies by contact count
  const sortCompaniesByContactCount = (companies: CompanyWithContacts[]): CompanyWithContacts[] => {
    return [...companies].sort((a, b) => {
      const contactsA = a.contacts?.length || 0;
      const contactsB = b.contacts?.length || 0;
      return contactsB - contactsA; // Descending order (most contacts first)
    });
  };

  // Unified helper function to persist search state to localStorage and sessionStorage
  const persistSearchState = (
    state: {
      currentResults: CompanyWithContacts[];
      emailSearchCompleted?: boolean;
      emailSearchTimestamp?: number | null;
      navigationRefreshTimestamp?: number;
    },
    currentValues: {
      currentQuery: string;
      currentListId: number | null;
      lastExecutedQuery: string | null;
    }
  ) => {
    const queryToSave = currentValues.lastExecutedQuery || currentValues.currentQuery;
    const stateToSave = {
      currentQuery: queryToSave,
      currentResults: state.currentResults,
      currentListId: currentValues.currentListId,
      lastExecutedQuery: currentValues.lastExecutedQuery || queryToSave,
      ...(state.emailSearchCompleted !== undefined && { emailSearchCompleted: state.emailSearchCompleted }),
      ...(state.emailSearchTimestamp !== undefined && { emailSearchTimestamp: state.emailSearchTimestamp }),
      ...(state.navigationRefreshTimestamp !== undefined && { navigationRefreshTimestamp: state.navigationRefreshTimestamp })
    };
    
    const stateString = JSON.stringify(stateToSave);
    localStorage.setItem('searchState', stateString);
    sessionStorage.setItem('searchState', stateString);
    
    console.log('Persisted search state to storage:', {
      companyCount: state.currentResults.length,
      emailCount: state.currentResults.reduce((total, company) => 
        total + (company.contacts?.filter(c => c.email && c.email.length > 0).length || 0), 0
      ),
      hasListId: !!currentValues.currentListId
    });
  };

  // Unified helper function to refresh and update results with sorting
  const refreshAndUpdateResults = async (
    companies: CompanyWithContacts[],
    stateValues: {
      currentQuery: string;
      currentListId: number | null;
      lastExecutedQuery: string | null;
    },
    options: {
      forceUiReset?: boolean;
      clearEmailSearchTimestamp?: boolean;
      forceFresh?: boolean;
      additionalStateFields?: {
        emailSearchCompleted?: boolean;
        emailSearchTimestamp?: number | null;
        navigationRefreshTimestamp?: number;
      };
    } = {}
  ): Promise<CompanyWithContacts[]> => {
    try {
      // Increment version to track this refresh operation
      const thisVersion = ++refreshVersionRef.current;
      
      // Refresh contact data from database with optional cache-busting
      const refreshedResults = await refreshContactDataFromDatabase(
        companies,
        { forceFresh: options.forceFresh }
      );
      
      // Check if this is still the latest refresh request
      if (thisVersion !== refreshVersionRef.current) {
        console.log('Skipping stale refresh result from version', thisVersion);
        return companies; // Return original without updating
      }
      
      // Apply sorting to ensure companies with contacts appear first
      const sortedResults = sortCompaniesByContactCount(refreshedResults);
      
      // Update state (with optional UI reset for animation effects)
      if (options.forceUiReset) {
        // Force UI re-render for animations and state resets
        setCurrentResults([]);
        setTimeout(() => {
          // Double-check version is still current before updating
          if (thisVersion === refreshVersionRef.current) {
            setCurrentResults(sortedResults);
          }
        }, 100);
      } else {
        // Normal state update
        setCurrentResults(sortedResults);
      }
      
      // Persist to storage
      persistSearchState({
        currentResults: sortedResults,
        ...options.additionalStateFields
      }, stateValues);
      
      // Clear email search timestamp if requested
      if (options.clearEmailSearchTimestamp) {
        localStorage.removeItem('lastEmailSearchTimestamp');
        console.log('Cleared lastEmailSearchTimestamp');
      }
      
      console.log('Refreshed and updated results:', {
        companyCount: sortedResults.length,
        companiesWithContacts: sortedResults.filter(c => c.contacts && c.contacts.length > 0).length
      });
      
      return sortedResults;
    } catch (error) {
      console.error('Failed to refresh and update results:', error);
      // Return original companies if refresh fails
      return companies;
    }
  };

  // New handler for initial companies data
  const handleCompaniesReceived = (query: string, companies: Company[]) => {
    console.log('Companies received:', companies.length);
    // Mark that we've received session-restored data
    hasSessionRestoredDataRef.current = true;
    // Update the UI with just the companies data
    setCurrentQuery(query);
    // Convert Company[] to CompanyWithContacts[] with empty contacts arrays
    const companiesWithEmptyContacts = companies.map(company => ({ ...company, contacts: [] }));
    // Apply sorting even though all have 0 contacts - maintains consistency
    const sortedCompanies = sortCompaniesByContactCount(companiesWithEmptyContacts);
    setCurrentResults(sortedCompanies);
    setIsSaved(false);
    setIsLoadingContacts(true);
    setContactsLoaded(false);
  };

  // Modified search results handler for the full data with contacts
  const handleSearchResults = (query: string, results: CompanyWithContacts[]) => {
    console.log('=== PARENT COMPONENT: handleSearchResults called ===');
    console.log('Received query:', query);
    console.log('Received results count:', results.length);
    console.log('Current component state - query:', currentQuery);
    console.log('Current component state - results count:', currentResults?.length || 0);
    console.log('Complete results received with contacts:', results.length);
    
    // Clear any stale localStorage data that might conflict with new search results
    if (currentQuery !== query) {
      console.log('New search detected - clearing stale localStorage data');
      localStorage.removeItem('searchState');
      sessionStorage.removeItem('searchState');
    }
    
    // Mark that we've received session-restored data
    hasSessionRestoredDataRef.current = true;
    
    // Sort companies by contact count (most contacts first)
    const sortedResults = sortCompaniesByContactCount(results);
    
    console.log('Companies reordered by contact count:', 
      sortedResults.map(c => ({ name: c.name, contacts: c.contacts?.length || 0 }))
    );
    
    setCurrentQuery(query);
    setCurrentResults(sortedResults);
    setIsSaved(false);
    setIsLoadingContacts(false);
    
    console.log('=== PARENT COMPONENT: State updated ===');
    console.log('New state - query:', query);
    console.log('New state - results count:', sortedResults.length);
    console.log('handleSearchResults completed');
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
    
    // Auto-create list after search completes with contacts
    if (sortedResults.length > 0) {
      setTimeout(() => autoCreateListMutation.mutate(), 1000); // Small delay
    }
    
    // Keep isFromLandingPage true until email button is clicked
    // (removed automatic reset to allow email tooltip to show)
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
    mutationFn: async ({ contactId, silent = false, searchContext = 'manual' }: { contactId: number; silent?: boolean; searchContext?: 'manual' | 'automated' }) => {
      // Add this contact ID to the set of pending contacts
      setPendingContactIds(prev => {
        const newSet = new Set(prev);
        newSet.add(contactId);
        return newSet;
      });
      const response = await apiRequest("POST", `/api/contacts/${contactId}/enrich`);
      return {data: await response.json(), contactId, silent, searchContext};
    },
    onSuccess: async (result) => {
      // The data, contactId, silent flag, and searchContext that was processed
      const {data, contactId, silent = false, searchContext = 'manual'} = result;
      
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
      
      // Mark list as needing update since contact data changed
      if (currentListId) {
        setIsSaved(false);
      }

      // CREDIT BILLING ON EMAIL SUCCESS (only for manual searches, not automated/comprehensive)
      if (data.email && searchContext === 'manual') {
        try {
          const creditResponse = await apiRequest("POST", "/api/credits/deduct-individual-email", {
            contactId,
            searchType: 'perplexity',
            emailFound: true
          });
          const creditResult = await creditResponse.json();
          
          console.log('Perplexity credit billing result:', creditResult);

          // Refresh credits display
          if (creditResult.success) {
            await queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
          }
        } catch (error) {
          console.error('Perplexity credit billing failed:', error);
        }
      }
      
      // Only show notifications if not silent
      if (!silent) {
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
      }
    },
    onError: (error, variables) => {
      const { contactId, silent = false } = variables; // Destructure from variables
      
      // Remove this contact ID from the set of pending contacts
      setPendingContactIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId as number);
        return newSet;
      });
      
      if (!silent) {
        toast({
          title: "Email Search Failed",
          description: error instanceof Error ? error.message : "Failed to find contact's email",
          variant: "destructive",
        });
      }
    },
  });

  // PRE-SEARCH CREDIT CHECK (same as other APIs)
  const handleEnrichContact = async (contactId: number, silent: boolean = false, searchContext: 'manual' | 'automated' = 'manual') => {
    // Only prevent if this specific contact is already being processed
    if (pendingContactIds.has(contactId)) return;
    
    // Check credits before manual search (automated searches bypass this)
    if (!isAutomatedSearchRef.current) {
      try {
        const creditResponse = await apiRequest("GET", "/api/credits");
        const creditData = await creditResponse.json();
        
        if (creditData.isBlocked || creditData.balance < 20) {
          toast({
            title: "Insufficient Credits",
            description: `You need 20 credits for individual email search. Current balance: ${creditData.balance}`,
            variant: "destructive"
          });
          return;
        }
      } catch (error) {
        console.error('Credit check failed:', error);
        // Continue with search if credit check fails
      }
    }
    
    enrichContactMutation.mutate({ contactId, silent, searchContext });
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

  // Handle loading a saved search from the drawer
  const handleLoadSavedSearch = async (list: List) => {
    try {
      // First fetch the companies
      const companies = await queryClient.fetchQuery({
        queryKey: [`/api/lists/${list.listId}/companies`]
      }) as Company[];
      
      // Then fetch contacts for each company
      const companiesWithContacts = await Promise.all(
        companies.map(async (company) => {
          try {
            const contacts = await queryClient.fetchQuery({
              queryKey: [`/api/companies/${company.id}/contacts`]
            }) as Contact[];
            // Add companyName and companyId to each contact
            const contactsWithCompanyInfo: ContactWithCompanyInfo[] = contacts.map(contact => ({
              ...contact,
              companyName: company.name,
              companyId: company.id
            }));
            return { ...company, contacts: contactsWithCompanyInfo };
          } catch (error) {
            console.error(`Failed to load contacts for company ${company.id}:`, error);
            return { ...company, contacts: [] };
          }
        })
      );
      
      // Set all state for loaded search
      setCurrentQuery(list.prompt);
      setLastExecutedQuery(list.prompt); // Update lastExecutedQuery to sync the search input
      setCurrentResults(companiesWithContacts);
      setCurrentListId(list.listId);
      setIsSaved(true);
      setSavedSearchesDrawerOpen(false);
      
      // Force input change flag to false after a small delay to ensure proper state update
      setTimeout(() => {
        setInputHasChanged(false);
      }, 0);
      
      const totalContacts = companiesWithContacts.reduce((sum, company) => 
        sum + (company.contacts?.length || 0), 0);
      
      toast({
        title: "Search Loaded",
        description: `Loaded "${list.prompt}" with ${list.resultCount} companies and ${totalContacts} contacts`,
      });
    } catch (error) {
      toast({
        title: "Failed to load search",
        description: "Could not load the selected search.",
        variant: "destructive"
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

  // Enhanced Hunter.io mutation with improved error handling
  const hunterMutation = useMutation({
    mutationFn: async ({ contactId, searchContext = 'manual', silent = false }: { contactId: number; searchContext?: 'manual' | 'automated'; silent?: boolean }) => {
      // Add this contact ID to the set of pending searches
      setPendingHunterIds(prev => {
        const newSet = new Set(prev);
        newSet.add(contactId);
        return newSet;
      });
      
      const response = await apiRequest("POST", `/api/contacts/${contactId}/hunter`);
      const responseData = await response.json();
      
      // Handle both success and "no email found" responses
      if (response.status === 422) {
        // 422 means search completed but no email found
        return {
          data: responseData.contact,
          contactId,
          searchContext,
          silent,
          searchMetadata: responseData.searchMetadata,
          success: true,
          emailFound: false
        };
      } else if (!response.ok) {
        throw new Error(responseData.message || "Search failed");
      }
      
      return {
        data: responseData,
        contactId,
        searchContext,
        silent,
        success: true,
        emailFound: !!responseData.email
      };
    },
    onSuccess: async (result) => {
      const {data, contactId, searchContext, searchMetadata, emailFound, silent = false} = result;
      
      // Process credit billing for successful email discoveries (only for manual searches)
      if (emailFound && searchContext === 'manual') {
        try {
          const creditResponse = await apiRequest("POST", "/api/credits/deduct-individual-email", {
            contactId,
            searchType: 'hunter',
            emailFound: true
          });
          
          const creditResult = await creditResponse.json();
          console.log('Hunter credit billing result:', creditResult);
          
          // Refresh credits display
          if (creditResult.success) {
            queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
          }
        } catch (creditError) {
          console.error('Hunter credit billing failed:', creditError);
          // Don't block user experience for billing errors
        }
      }
      
      // Update the contact in the results
      let updatedResults: CompanyWithContacts[] | null = null;
      setCurrentResults(prev => {
        if (!prev) return null;
        
        updatedResults = prev.map(company => {
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
        
        return updatedResults;
      });
      
      // Immediately update localStorage to prevent losing emails on quick navigation
      if (updatedResults) {
        // Save lastExecutedQuery as currentQuery to ensure consistency
        const queryToSave = lastExecutedQuery || currentQuery;
        const stateToSave: SavedSearchState = {
          currentQuery: queryToSave,
          currentResults: updatedResults,
          currentListId,
          lastExecutedQuery
        };
        localStorage.setItem('searchState', JSON.stringify(stateToSave));
        sessionStorage.setItem('searchState', JSON.stringify(stateToSave));
        console.log('Hunter.io: Immediately saved email to localStorage for persistence');
      }
      
      // If we have a saved list, update it in the database to ensure persistence
      if (currentListId && updatedResults) {
        console.log('Hunter.io: Updating list in database with new email');
        // Use silent update without toast notification
        apiRequest("PUT", `/api/lists/${currentListId}`, {
          companies: updatedResults,
          prompt: currentQuery,
          contactSearchConfig: (() => {
            const savedConfig = localStorage.getItem('contactSearchConfig');
            if (savedConfig) {
              try {
                return JSON.parse(savedConfig);
              } catch (error) {
                return null;
              }
            }
            return null;
          })()
        }).then(() => {
          console.log('Hunter.io: List updated in database successfully');
        }).catch(error => {
          console.error('Hunter.io: Failed to update list in database:', error);
        });
      }
      
      // Remove this contact ID from the set of pending searches
      setPendingHunterIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Enhanced toast notifications with search metadata
      if (!silent) {
        if (searchContext === 'manual') {
          const confidence = searchMetadata?.confidence || data.nameConfidenceScore;
          const retryInfo = searchMetadata?.retryCount > 0 ? ` (${searchMetadata.retryCount + 1} attempts)` : '';
          
          toast({
            title: "Hunter.io Search Complete",
            description: `${data.name}: ${emailFound 
              ? `Found email with ${confidence || 'unknown'} confidence${retryInfo}.`
              : `No email found${retryInfo}.`}`,
          });
        } else if (searchContext === 'automated' && emailFound) {
          toast({
            title: "Email Found",
            description: `${data.name}: Successfully found email address.`,
          });
        }
      }
    },
    onError: (error, variables) => {
      const { contactId, searchContext, silent = false } = variables;
      
      // Remove this contact ID from the set of pending searches
      setPendingHunterIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Enhanced error handling with retry suggestions
      if (!silent) {
        if (searchContext === 'manual') {
          const isRetryable = error instanceof Error && 
            (error.message.includes('rate limit') || error.message.includes('network'));
          
          toast({
            title: "Hunter.io Search Failed",
            description: `${error instanceof Error ? error.message : "Failed to find contact email"}${
              isRetryable ? ' - You can try again in a moment.' : ''
            }`,
            variant: "destructive",
          });
        }
      }
    },
  });
  
  // Handler for Hunter.io search with credit checking
  const handleHunterSearch = async (contactId: number, searchContext: 'manual' | 'automated' = 'manual', silent: boolean = false) => {
    // Allow multiple searches to run in parallel
    if (pendingHunterIds.has(contactId)) return; // Only prevent if this specific contact is already being processed
    
    // Check credits before starting search (only for manual searches)
    if (searchContext === 'manual') {
      try {
        const creditsResponse = await apiRequest("GET", "/api/credits");
        const creditsData = await creditsResponse.json();
        
        if (creditsData.currentBalance < 20) { // 20 credits needed for individual email search
          toast({
            title: "Insufficient Credits",
            description: `You need 20 credits for Hunter email search. Current balance: ${creditsData.currentBalance}`,
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        console.error('Credit check failed:', error);
        // Continue with search if credit check fails to avoid blocking user
      }
    }
    
    hunterMutation.mutate({ contactId, searchContext, silent });
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
  const [lastEmailSearchCount, setLastEmailSearchCount] = useState(0);
  const [lastSourceBreakdown, setLastSourceBreakdown] = useState<SourceBreakdown | undefined>(undefined);

  // Time-based progress queue system with realistic timing
  const progressQueue = [
    { name: "Starting Key Emails Search", duration: 1000 }, // 1 second
    { name: "Processing Companies", duration: 2000 },       // 2 seconds  
    { name: "Searching for Emails", duration: 3000 },      // 3 seconds
    { name: "Finalizing Results", duration: 1500 }         // 1.5 seconds
  ];

  const [progressState, setProgressState] = useState({
    currentPhase: 0,
    startTime: 0,
    backendCompleted: false
  });

  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startProgressTimer = () => {
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
    }

    let currentPhase = 0;
    const totalDuration = progressQueue.reduce((sum, phase) => sum + phase.duration, 0);
    
    const updateProgress = () => {
      if (currentPhase < progressQueue.length) {
        const currentPhaseData = progressQueue[currentPhase];
        
        // Update progress display
        setSearchProgress({
          phase: currentPhaseData.name,
          completed: currentPhase + 1,
          total: progressQueue.length
        });
        
        // Schedule next phase
        if (currentPhase < progressQueue.length - 1) {
          progressTimerRef.current = setTimeout(() => {
            currentPhase++;
            updateProgress();
          }, currentPhaseData.duration);
        } else {
          // Final phase - wait for backend completion or timeout
          const finalPhaseTimeout = setTimeout(() => {
            // Force completion if backend takes too long
            if (!progressState.backendCompleted) {
              setProgressState(prev => ({ ...prev, backendCompleted: true }));
            }
          }, currentPhaseData.duration);
          
          // Clear timeout if backend completes early
          const checkBackendCompletion = () => {
            if (progressState.backendCompleted) {
              clearTimeout(finalPhaseTimeout);
            } else {
              setTimeout(checkBackendCompletion, 200);
            }
          };
          checkBackendCompletion();
        }
      }
    };
    
    // Start progress sequence
    updateProgress();
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    };
  }, []);
  

  // Email tooltip timing effect
  useEffect(() => {
    // Show email tooltip 5 seconds after first search completes (only once per session)
    if (currentResults && currentResults.length > 0 && !isAnalyzing && !hasShownEmailTooltip) {
      const timer = setTimeout(async () => {
        setShowEmailTooltip(true);
        setHasShownEmailTooltip(true); // Mark as shown
        
        // Mark email tooltip as shown for authenticated users
        if (auth?.user) {
          try {
            await fetch('/api/notifications/mark-shown', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(localStorage.getItem('authToken') && { 
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}` 
                })
              },
              credentials: 'include',
              body: JSON.stringify({ notificationId: 3 })
            });
          } catch (error) {
            console.error('Failed to mark email tooltip as shown:', error);
          }
        }
        
        setTimeout(() => {
          setShowEmailTooltip(false);
        }, 5000);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [currentResults, isAnalyzing, hasShownEmailTooltip, auth?.user]);

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

  // Resize handle for email drawer
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      // Constrain width between 320px and 600px
      const constrainedWidth = Math.max(320, Math.min(600, newWidth));
      setDrawerWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection during resize
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  // Helper to get the best contact from a company for email search
  const getBestContact = (company: any) => {
    return getTopContacts(company, 1)[0];
  };

  // Helper function to finish search with cache invalidation
  const finishSearch = async () => {
    try {
      // Clear browser cache to force fresh requests
      Object.keys(localStorage).forEach(key => {
        if (key.includes('contact') || key.includes('company') || key.includes('search')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
      
      // Fetch fresh contact data with cache-busting timestamp
      const cacheTimestamp = Date.now();
      
      if (currentResults && currentResults.length > 0) {
        // Use unified refresh helper with UI reset for animation effects
        await refreshAndUpdateResults(
          currentResults,
          {
            currentQuery: currentQuery,
            currentListId: currentListId,
            lastExecutedQuery: lastExecutedQuery
          },
          {
            forceUiReset: true,  // Force UI re-render for animations
            forceFresh: true  // Enable cache-busting
          }
        );
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error("Cache refresh failed:", error);
    }
    
    // Clean up progress timer
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    
    // Original finish logic
    setIsConsolidatedSearching(false);
    isAutomatedSearchRef.current = false;
    setSummaryVisible(true);
  };

  // Helper function to finish search without triggering list creation
  const finishSearchWithoutSave = async () => {
    try {
      // All the cache refresh logic from finishSearch() but without save operations
      if (currentResults && currentResults.length > 0) {
        // Use unified refresh helper with UI reset for animation effects
        await refreshAndUpdateResults(
          currentResults,
          {
            currentQuery: currentQuery,
            currentListId: currentListId,
            lastExecutedQuery: lastExecutedQuery
          },
          {
            forceUiReset: true,  // Force UI re-render for animations
            forceFresh: true  // Enable cache-busting
          }
        );
        
        console.log('finishSearchWithoutSave: Updated localStorage with refreshed data');
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error("Cache refresh failed:", error);
    }
    
    // Clean up progress timer and complete search UI
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    
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
  
  // Backend-orchestrated email search function with session persistence
  const runConsolidatedEmailSearch = async () => {
    if (!currentResults || currentResults.length === 0) return;
    
    setIsConsolidatedSearching(true);
    isAutomatedSearchRef.current = true;
    setSummaryVisible(false);
    

    
    // Initialize progress state
    setProgressState({
      currentPhase: 0,
      startTime: Date.now(),
      backendCompleted: false
    });
    
    // Set initial progress
    setSearchProgress({
      phase: progressQueue[0].name,
      completed: 1,
      total: progressQueue.length
    });
    
    // Start realistic progress timer
    startProgressTimer();
    
    try {
      // First, check if we need to refresh contact data from recent email searches
      const updatedResults = await refreshContactDataIfNeeded(currentResults);
      
      // Get companies without emails (only check top 3 contacts) using refreshed data
      const companiesNeedingEmails = updatedResults.filter(company => 
        !getTopContacts(company, 3).some(contact => contact.email && contact.email.length > 5)
      );
      
      if (companiesNeedingEmails.length === 0) {
        console.log('No companies need email searches - all companies have sufficient emails');
        setIsConsolidatedSearching(false);
        setSummaryVisible(true);
        return;
      }
      
      // Extract company IDs for backend orchestration
      const companyIds = companiesNeedingEmails.map(company => company.id);
      
      console.log(`Starting backend email orchestration for ${companyIds.length} companies`);
      
      // Mark email search as started in session (if we have a session)
      if (currentSessionId) {
        SearchSessionManager.markEmailSearchStarted(currentSessionId);
      }
      

      
      // Call backend orchestration endpoint with session ID
      const response = await apiRequest("POST", "/api/companies/find-all-emails", {
        companyIds,
        searchConfig: {},
        sessionId: currentSessionId
      });
      
      if (!response.ok) {
        throw new Error(`Backend orchestration failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log(`Backend orchestration completed:`, data.summary);
      
      // Mark email search as completed in session
      if (currentSessionId) {
        SearchSessionManager.markEmailSearchCompleted(currentSessionId);
      }
      
      // Mark backend as completed
      setProgressState(prev => ({ ...prev, backendCompleted: true }));
      
      // Store the backend email count and source breakdown for summary display
      setLastEmailSearchCount(data.summary.emailsFound);
      setLastSourceBreakdown(data.summary.sourceBreakdown);
      
      // Complete search immediately - show credit deduction if available
      const creditInfo = data.summary.creditsCharged ? ` (${data.summary.creditsCharged} credits used)` : '';
      toast({
        title: "Email Search Complete",
        description: `Found ${data.summary.emailsFound} emails for ${data.summary.contactsProcessed} contacts across ${data.summary.companiesProcessed} companies${creditInfo}`,
      });
      
      // Refresh credits display if credits were charged
      if (data.summary.creditsCharged) {
        await queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
      }
      
      // COMPLETE RELOAD APPROACH: Clear localStorage and reload fresh from database
      console.log('EMAIL SEARCH COMPLETE: Starting complete database reload to ensure email persistence');
      
      // Step 1: Clear all localStorage to prevent stale data
      localStorage.removeItem('searchState');
      sessionStorage.removeItem('searchState');
      localStorage.removeItem('lastEmailSearchTimestamp');
      localStorage.removeItem('emailPreservationData');
      console.log('Cleared all localStorage state');
      
      // Step 2: Wait for backend to fully complete (ensure database consistency)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: Fetch completely fresh data from database with sorting
      console.log('Fetching complete fresh data from database...');
      const freshResults = await refreshAndUpdateResults(
        currentResults,
        {
          currentQuery: currentQuery,
          currentListId: currentListId,
          lastExecutedQuery: lastExecutedQuery
        },
        {
          forceFresh: true,  // Force fresh data
          additionalStateFields: {
            emailSearchCompleted: true,
            emailSearchTimestamp: Date.now()
          }
        }
      );
      
      // Step 4: Count emails to verify success
      const emailCount = freshResults.reduce((total, company) => 
        total + (company.contacts?.filter(c => c.email && c.email.length > 0).length || 0), 0
      );
      
      console.log(`Database reload completed with ${emailCount} emails found`);
      console.log(`Complete state saved to localStorage with ${emailCount} emails`);
      console.log('Email search completion: Database reload approach successful');
      
      // Smart list update logic - only update existing lists, never create during email search
      if (currentListId) {
        console.log('Updating existing list after email search completion:', currentListId);
        updateListMutation.mutate();
      } else {
        console.log('No existing list to update - email results will be available for manual save');
        // Don't auto-create during email search to prevent duplicates
        // The first auto-creation from search completion will handle list creation
      }

      // Call finishSearch without auto-save trigger (will do additional refresh)
      await finishSearchWithoutSave();
      
    } catch (error) {
      console.error("Backend email orchestration error:", error);
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "Failed to complete email search",
        variant: "destructive"
      });
      setIsConsolidatedSearching(false);
      isAutomatedSearchRef.current = false;
      
      // Clear progress timer on error
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    }
  };

  const getApolloButtonClass = (contact: Contact) => {
    if (isApolloSearchComplete(contact)) {
      return contact.email ? "text-purple-500" : "text-muted-foreground opacity-50";
    }
    return "";
  };
  
  // Enhanced Apollo.io mutation with improved error handling
  const apolloMutation = useMutation({
    mutationFn: async ({ contactId, searchContext = 'manual', silent = false }: { contactId: number; searchContext?: 'manual' | 'automated'; silent?: boolean }) => {
      // Add this contact ID to the set of pending searches
      setPendingApolloIds(prev => {
        const newSet = new Set(prev);
        newSet.add(contactId);
        return newSet;
      });
      
      const response = await apiRequest("POST", `/api/contacts/${contactId}/apollo`);
      const responseData = await response.json();
      
      // Handle both success and "no email found" responses
      if (response.status === 422) {
        // 422 means search completed but no email found
        return {
          data: responseData.contact,
          contactId,
          searchContext,
          silent,
          searchMetadata: responseData.searchMetadata,
          success: true,
          emailFound: false
        };
      } else if (!response.ok) {
        throw new Error(responseData.message || "Search failed");
      }
      
      return {
        data: responseData,
        contactId,
        searchContext,
        silent,
        success: true,
        emailFound: !!responseData.email
      };
    },
    onSuccess: async (result) => {
      const {data, contactId, searchContext, searchMetadata, emailFound, silent = false} = result;
      
      // Process credit billing for successful email discoveries (only for manual searches)
      if (emailFound && searchContext === 'manual') {
        try {
          const creditResponse = await apiRequest("POST", "/api/credits/deduct-individual-email", {
            contactId,
            searchType: 'apollo',
            emailFound: true
          });
          
          const creditResult = await creditResponse.json();
          console.log('Apollo credit billing result:', creditResult);
          
          // Refresh credits display
          if (creditResult.success) {
            queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
          }
        } catch (creditError) {
          console.error('Apollo credit billing failed:', creditError);
          // Don't block user experience for billing errors
        }
      }
      
      // Update the contact in the results
      let updatedResults: CompanyWithContacts[] | null = null;
      setCurrentResults(prev => {
        if (!prev) return null;
        
        updatedResults = prev.map(company => {
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
        
        return updatedResults;
      });
      
      // Immediately update localStorage to prevent losing emails on quick navigation
      if (updatedResults) {
        // Save lastExecutedQuery as currentQuery to ensure consistency
        const queryToSave = lastExecutedQuery || currentQuery;
        const stateToSave: SavedSearchState = {
          currentQuery: queryToSave,
          currentResults: updatedResults,
          currentListId,
          lastExecutedQuery
        };
        localStorage.setItem('searchState', JSON.stringify(stateToSave));
        sessionStorage.setItem('searchState', JSON.stringify(stateToSave));
        console.log('Apollo.io: Immediately saved email to localStorage for persistence');
      }
      
      // If we have a saved list, update it in the database to ensure persistence
      if (currentListId && updatedResults) {
        console.log('Apollo.io: Updating list in database with new email');
        // Use silent update without toast notification
        apiRequest("PUT", `/api/lists/${currentListId}`, {
          companies: updatedResults,
          prompt: currentQuery,
          contactSearchConfig: (() => {
            const savedConfig = localStorage.getItem('contactSearchConfig');
            if (savedConfig) {
              try {
                return JSON.parse(savedConfig);
              } catch (error) {
                return null;
              }
            }
            return null;
          })()
        }).then(() => {
          console.log('Apollo.io: List updated in database successfully');
        }).catch(error => {
          console.error('Apollo.io: Failed to update list in database:', error);
        });
      }
      
      // Remove this contact ID from the set of pending searches
      setPendingApolloIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Enhanced toast notifications with search metadata
      if (!silent) {
        if (searchContext === 'manual') {
          const confidence = searchMetadata?.confidence || data.nameConfidenceScore;
          const retryInfo = searchMetadata?.retryCount > 0 ? ` (${searchMetadata.retryCount + 1} attempts)` : '';
          const additionalData = data.linkedinUrl || data.phoneNumber ? ' + profile data' : '';
          
          toast({
            title: "Apollo.io Search Complete",
            description: `${data.name}: ${emailFound 
              ? `Found email with ${confidence || 'unknown'} confidence${additionalData}${retryInfo}.`
              : `No email found${additionalData ? ', but found other profile data' : ''}${retryInfo}.`}`,
          });
        } else if (searchContext === 'automated' && emailFound) {
          toast({
            title: "Email Found",
            description: `${data.name}: Successfully found email address.`,
          });
        }
      }
    },
    onError: (error, variables) => {
      const { contactId, searchContext, silent = false } = variables;
      
      // Remove this contact ID from the set of pending searches
      setPendingApolloIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Enhanced error handling with retry suggestions
      if (!silent) {
        if (searchContext === 'manual') {
          const isRetryable = error instanceof Error && 
            (error.message.includes('rate limit') || error.message.includes('network'));
          
          toast({
            title: "Apollo.io Search Failed",
            description: `${error instanceof Error ? error.message : "Failed to find contact email"}${
              isRetryable ? ' - You can try again in a moment.' : ''
            }`,
            variant: "destructive",
          });
        }
      }
    },
  });
  
  // Handler for Apollo.io search with credit checking
  const handleApolloSearch = async (contactId: number, searchContext: 'manual' | 'automated' = 'manual', silent: boolean = false) => {
    // Allow multiple searches to run in parallel
    if (pendingApolloIds.has(contactId)) return; // Only prevent if this specific contact is already being processed
    
    // Check credits before starting search (only for manual searches)
    if (searchContext === 'manual') {
      try {
        const creditsResponse = await apiRequest("GET", "/api/credits");
        const creditsData = await creditsResponse.json();
        
        if (creditsData.currentBalance < 20) { // 20 credits needed for individual email search
          toast({
            title: "Insufficient Credits",
            description: `You need 20 credits for Apollo email search. Current balance: ${creditsData.currentBalance}`,
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        console.error('Credit check failed:', error);
        // Continue with search if credit check fails to avoid blocking user
      }
    }
    
    apolloMutation.mutate({ contactId, searchContext, silent });
  };

  // Wrapper function for comprehensive email search using the shared hook
  const handleComprehensiveEmailSearch = async (contactId: number) => {
    // Get contact data from current results
    const contact = currentResults?.flatMap(c => c.contacts || []).find(ct => ct.id === contactId);
    if (!contact) return;
    
    // Get company data for search context
    const company = currentResults?.find(c => c.contacts?.some(ct => ct.id === contactId));
    
    // Call the shared hook function
    await comprehensiveSearchHook(contactId, contact, {
      companyName: company?.name,
      companyWebsite: company?.website || undefined,
      companyDescription: company?.description || undefined
    });
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
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden relative">
      {/* Backdrop for mobile */}
      {emailDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => {
            setEmailDrawerOpen(false);
            setSelectedEmailContact(null);
            setSelectedEmailCompany(null);
            setSelectedCompanyContacts([]);
            // Expand search section when closing drawer
            setSearchSectionCollapsed(false);
          }}
        />
      )}
      
      {/* Main Content Container - will be compressed when drawer opens on desktop */}
      <div className={`flex-1 overflow-y-auto main-content-compressed ${emailDrawerOpen ? 'compressed-view' : ''}`}>
        <div className="container mx-auto py-6 px-0 md:px-6">
          {/* Intro tour modal has been removed */}

          <div className="grid grid-cols-12 gap-3 md:gap-6">
            {/* Main Content Area - full width */}
            <div className="col-span-12 space-y-2 md:space-y-4 mt-[-10px]">
          {/* Search Section - Collapsible with Focus State */}
          <div className="relative transition-all duration-300 ease-in-out">
            {/* Collapsed Header - Only visible when collapsed */}
            {searchSectionCollapsed && (
              <button
                onClick={() => setSearchSectionCollapsed(false)}
                className="w-full px-3 md:px-6 py-2 bg-background border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors flex items-center justify-between group mb-2"
                data-testid="button-expand-search"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  {currentQuery && (
                    <span className="text-sm text-muted-foreground truncate max-w-[200px] md:max-w-[400px]">
                      {currentQuery}
                    </span>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            )}
            
            {/* Expandable Search Content */}
            <div 
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                searchSectionCollapsed 
                  ? 'max-h-0 opacity-0 pointer-events-none' 
                  : 'max-h-[500px] opacity-100'
              }`}
            >
              <div className="px-3 md:px-6 py-1"> {/* Reduced mobile padding, matched desktop padding with CardHeader (p-6) */}
                {/* Collapse button when expanded */}
                {!searchSectionCollapsed && emailDrawerOpen && (
                  <button
                    onClick={() => setSearchSectionCollapsed(true)}
                    className="absolute right-3 md:right-6 top-2 z-10 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                    data-testid="button-collapse-search"
                    title="Minimize search"
                  >
                    <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                  </button>
                )}
                
                {!currentResults && (
                  <div className="flex flex-col-reverse md:flex-row items-center gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <EggAnimation />
                      <h2 className="text-2xl mt-2 md:mt-0">Search for target businesses</h2>
                    </div>
                  </div>
                )}
                <Suspense fallback={<div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>}>
                  <PromptEditor
                    onAnalyze={() => setIsAnalyzing(true)}
                    onComplete={handleAnalysisComplete}
                    onSearchResults={handleSearchResults}
                    onCompaniesReceived={handleCompaniesReceived}
                    isAnalyzing={isAnalyzing}
                    value={currentQuery || ""}
                    onChange={(newValue) => {
                      setCurrentQuery(newValue);
                      setInputHasChanged(newValue !== lastExecutedQuery);
                    }}
                    isFromLandingPage={isFromLandingPage}
                    onDismissLandingHint={() => setIsFromLandingPage(false)}
                    lastExecutedQuery={lastExecutedQuery}
                    onSearchSuccess={() => {
                      const selectedSearchType = localStorage.getItem('searchType') || 'contacts';
                      if (selectedSearchType === 'emails') {
                        // Auto-trigger email search for full flow
                        setTimeout(() => runConsolidatedEmailSearch(), 500);
                      } else {
                        // Standard behavior - highlight email button
                        setHighlightEmailButton(true);
                        setTimeout(() => setHighlightEmailButton(false), 25000);
                      }
                    }}
                    hasSearchResults={currentResults ? currentResults.length > 0 : false}
                    onSessionIdChange={setCurrentSessionId}
                    hideRoleButtons={!!(currentResults && currentResults.length > 0 && !inputHasChanged)}
                  />
                </Suspense>
                
                {/* Action buttons menu - Moved here from search results, Hidden in focus mode and active search state */}
                {currentResults && currentResults.length > 0 && !inputHasChanged && !emailDrawerOpen && (
                  <div className="px-0 py-3 flex items-center justify-between bg-white dark:bg-transparent transition-all duration-300">
                    <div className="flex items-center gap-2">
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
                            <span className="hidden md:inline">5 More</span>
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
                            <span className="hidden md:inline">Expand</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">Expand or collapse all company rows of contacts</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Companies Analysis Section - Moved to top */}
          {currentResults && currentResults.length > 0 ? (
            <Card className={`w-full rounded-none md:rounded-lg border-0 transition-all duration-300 ${emailDrawerOpen ? 'shadow-none' : ''}`}>
              
              {/* Contact Discovery Report - with reduced padding */}
              {contactReportVisible && (
                <div className="px-0 md:px-4 pt-0 pb-2">
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
                <div className="px-0 md:px-4 pt-1 pb-0">
                  <EmailSearchSummary 
                    companiesWithEmails={currentResults?.filter(company => 
                      getTopContacts(company, 3).some(contact => contact.email && contact.email.length > 5)).length || 0}
                    totalCompanies={currentResults?.length || 0}
                    totalEmailsFound={lastEmailSearchCount || currentResults?.reduce((total, company) => 
                      total + (getTopContacts(company, 3).filter(contact => contact.email && contact.email.length > 5).length), 0) || 0}
                    sourceBreakdown={lastSourceBreakdown || undefined}
                    onClose={() => setSummaryVisible(false)}
                    isVisible={summaryVisible}
                  />
                </div>
              )}
              
              {/* Email Search Progress - with reduced padding */}
              {isConsolidatedSearching && (
                <div className="px-0 md:px-4 pt-0 pb-3">
                  <SearchProgress 
                    phase={searchProgress.phase}
                    completed={searchProgress.completed}
                    total={searchProgress.total}
                    isVisible={isConsolidatedSearching}
                  />
                </div>
              )}
              
              <CardContent className="p-0">
                <div className="px-0 md:px-4 pb-4">
                  <Suspense fallback={<TableSkeleton />}>
                    <CompanyCards
                      companies={currentResults || []}
                      handleCompanyView={handleCompanyView}
                      handleHunterSearch={handleHunterSearch}
                      handleApolloSearch={handleApolloSearch}
                      handleEnrichContact={handleEnrichContact}
                      handleComprehensiveEmailSearch={handleComprehensiveEmailSearch}
                      pendingHunterIds={pendingHunterIds}
                      pendingApolloIds={pendingApolloIds}
                      pendingContactIds={pendingContactIds}
                      pendingComprehensiveSearchIds={pendingComprehensiveSearchIds}
                      onContactClick={handleContactClick}
                      onViewModeChange={setCompaniesViewMode}
                      selectedEmailContact={selectedEmailContact}
                  />
                  </Suspense>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Top Prospects Section - Moved below Companies Analysis - Hidden in slides view */}
          {currentResults && currentResults.length > 0 && companiesViewMode !== 'slides' && (
            <Card className="w-full rounded-none md:rounded-lg">
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
                        <TableHead className="w-10 hidden">
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
                          <TableCell className="w-10 hidden">
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
                            <Badge variant="secondary">
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
          
                                handleApolloSearch={handleApolloSearch}
                                pendingContactIds={pendingContactIds}
                                pendingHunterIds={pendingHunterIds}
          
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

          {/* Fixed position saved searches drawer */}
          <SavedSearchesDrawer 
            open={savedSearchesDrawerOpen}
            onOpenChange={setSavedSearchesDrawerOpen}
            onLoadSearch={handleLoadSavedSearch}
          />
        </div>
      </div>
      
      {/* Email Drawer Container - keeps column aligned */}
      <div className={`duplicate-full-height-drawer-to-keep-column-aligned ${
        emailDrawerOpen 
          ? 'hidden md:block md:relative md:h-full' 
          : 'hidden md:block md:relative w-0'
      }`} style={{ ...(emailDrawerOpen && window.innerWidth >= 768 ? { width: `${drawerWidth}px` } : {}) }}>
        {/* Actual Email Drawer with dynamic height - Overlay on mobile, absolute on desktop */}
        <div className={`${!isResizing ? 'email-drawer-transition' : ''} ${
          emailDrawerOpen 
            ? 'fixed md:absolute top-[2.5rem] md:top-0 right-0 bottom-auto max-h-[calc(100vh-2.5rem)] md:max-h-screen w-[90%] sm:w-[400px] z-50' 
            : 'fixed md:absolute w-0 right-0 top-0'
        } overflow-hidden border-l border-t border-b rounded-tl-lg rounded-bl-lg bg-background shadow-xl`} 
        style={{ 
          ...(emailDrawerOpen && window.innerWidth >= 768 ? { width: `${drawerWidth}px` } : {}),
          ...(isResizing ? { transition: 'none' } : {})
        }}>
          {/* Resize Handle - Only show on desktop */}
          {emailDrawerOpen && (
            <div
              onMouseDown={handleMouseDown}
              className="hidden md:block absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-10 group"
            >
              <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-12 bg-muted-foreground/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
          <div className="overflow-y-auto max-h-[calc(100vh-2.5rem)] md:max-h-screen pb-4" style={{ minWidth: emailDrawerOpen ? '320px' : '0' }}>
            {/* Header */}
            <div className="sticky top-0 bg-background px-4 py-1.5 z-10">
              {/* Top row - Compose and close */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  Compose
                </h3>
                <button
                  onClick={() => {
                    setEmailDrawerOpen(false);
                    setSelectedEmailContact(null);
                    setSelectedEmailCompany(null);
                    setSelectedCompanyContacts([]);
                    // Expand search section when closing drawer
                    setSearchSectionCollapsed(false);
                  }}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close email panel"
                >
                  <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              
              {/* Contact row with navigation */}
              {selectedEmailContact && (
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-sm truncate flex-1 min-w-0">
                    <span className="font-medium">{selectedEmailContact.name}</span>
                    <span className="text-xs text-muted-foreground"> • {selectedEmailCompany?.name}</span>
                  </p>
                  
                  {/* Contact navigation */}
                  {selectedCompanyContacts.length > 1 && (
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <button
                        onClick={() => {
                          const currentIndex = selectedCompanyContacts.findIndex(c => c.id === selectedEmailContact?.id);
                          const prevIndex = currentIndex > 0 ? currentIndex - 1 : selectedCompanyContacts.length - 1;
                          handleEmailContactChange(selectedCompanyContacts[prevIndex]);
                        }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {selectedCompanyContacts.findIndex(c => c.id === selectedEmailContact?.id) + 1} / {selectedCompanyContacts.length}
                      </span>
                      <button
                        onClick={() => {
                          const currentIndex = selectedCompanyContacts.findIndex(c => c.id === selectedEmailContact?.id);
                          const nextIndex = currentIndex < selectedCompanyContacts.length - 1 ? currentIndex + 1 : 0;
                          handleEmailContactChange(selectedCompanyContacts[nextIndex]);
                        }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* Email Composer */}
          {emailDrawerOpen && (
            <div className="p-4">
              <EmailComposer
                selectedContact={selectedEmailContact}
                selectedCompany={selectedEmailCompany}
                onContactChange={handleEmailContactChange}
              />
            </div>
          )}
        </div>
      </div>
      </div>

      {/* For mobile: Render drawer without wrapper since it's fixed positioned */}
      <div className={`md:hidden email-drawer-transition ${
        emailDrawerOpen 
          ? 'fixed top-[2.5rem] right-0 bottom-auto max-h-[calc(100vh-2.5rem)] w-[90%] sm:w-[400px] z-50' 
          : 'fixed w-0 right-0 top-[2.5rem]'
      } overflow-hidden border-l border-t border-b rounded-tl-lg rounded-bl-lg bg-background shadow-xl`}>
        {emailDrawerOpen && (
          <>
            <div className="overflow-y-auto max-h-[calc(100vh-2.5rem)]" style={{ minWidth: '320px' }}>
              <div className="flex flex-col min-h-full pb-24">
                {/* Same header content */}
                <div className="sticky top-0 bg-background px-4 py-1.5 z-10">
                  {/* Top row - Compose and close */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs text-muted-foreground font-normal flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      Compose
                    </h3>
                    <button
                      onClick={() => {
                        setEmailDrawerOpen(false);
                        setSelectedEmailContact(null);
                        setSelectedEmailCompany(null);
                        setSelectedCompanyContacts([]);
                        setSearchSectionCollapsed(false);
                      }}
                      className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                      aria-label="Close email panel"
                    >
                      <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                  
                  {/* Contact row with navigation */}
                  {selectedEmailContact && (
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm truncate flex-1 min-w-0">
                        <span className="font-medium">{selectedEmailContact.name}</span>
                        <span className="text-xs text-muted-foreground"> • {selectedEmailCompany?.name}</span>
                      </p>
                      
                      {/* Contact navigation */}
                      {selectedCompanyContacts.length > 1 && (
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <button
                            onClick={() => {
                              const currentIndex = selectedCompanyContacts.findIndex(c => c.id === selectedEmailContact?.id);
                              const prevIndex = currentIndex > 0 ? currentIndex - 1 : selectedCompanyContacts.length - 1;
                              handleEmailContactChange(selectedCompanyContacts[prevIndex]);
                            }}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {selectedCompanyContacts.findIndex(c => c.id === selectedEmailContact?.id) + 1} / {selectedCompanyContacts.length}
                          </span>
                          <button
                            onClick={() => {
                              const currentIndex = selectedCompanyContacts.findIndex(c => c.id === selectedEmailContact?.id);
                              const nextIndex = currentIndex < selectedCompanyContacts.length - 1 ? currentIndex + 1 : 0;
                              handleEmailContactChange(selectedCompanyContacts[nextIndex]);
                            }}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              {/* Email Composer for mobile */}
              <div className="p-4">
                <EmailComposer
                  selectedContact={selectedEmailContact}
                  selectedCompany={selectedEmailCompany}
                  onContactChange={handleEmailContactChange}
                />
              </div>
            </div>
            </div>
          </>
        )}
      </div>

      {/* Notification System - Outside flex container */}
      <NotificationToast
        notificationState={notificationState}
        onClose={closeNotification}
      />
    </div>
  );
}