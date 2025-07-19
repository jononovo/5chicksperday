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
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationToast } from "@/components/ui/notification-toast";
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

// Extend Company type to include contacts
interface CompanyWithContacts extends Company {
  contacts?: ContactWithCompanyInfo[];
}

// Define interface for the saved state
interface SavedSearchState {
  currentQuery: string | null;
  currentResults: CompanyWithContacts[] | null;
  currentListId: number | null;
  emailSearchCompleted?: boolean;
  emailSearchTimestamp?: number;
  navigationRefreshTimestamp?: number;
}

// Define SourceBreakdown interface
interface SourceBreakdown {
  [source: string]: number;
}

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentQuery, setCurrentQuery] = useState<string | null>(null);
  const [currentResults, setCurrentResults] = useState<CompanyWithContacts[] | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [currentListId, setCurrentListId] = useState<number | null>(null);
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
  const [highlightStartSellingButton, setHighlightStartSellingButton] = useState(false);
  const [showEmailTooltip, setShowEmailTooltip] = useState(false);
  const [hasShownEmailTooltip, setHasShownEmailTooltip] = useState(false);
  const [showStartSellingTooltip, setShowStartSellingTooltip] = useState(false);
  const [hasShownStartSellingTooltip, setHasShownStartSellingTooltip] = useState(false);
  // Tour modal has been removed
  const [pendingAeroLeadsIds, setPendingAeroLeadsIds] = useState<Set<number>>(new Set());
  const [pendingHunterIds, setPendingHunterIds] = useState<Set<number>>(new Set());
  const [pendingApolloIds, setPendingApolloIds] = useState<Set<number>>(new Set());
  const [savedSearchesDrawerOpen, setSavedSearchesDrawerOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const registrationModal = useRegistrationModal();
  const auth = useAuth();
  const { notificationState, triggerNotification, closeNotification } = useNotifications();

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

  // Check if user has already seen start selling tooltip
  useEffect(() => {
    const checkStartSellingTooltipStatus = async () => {
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
          if (data.notifications && data.notifications[4] === 1) {
            setHasShownStartSellingTooltip(true);
          }
        } catch (error) {
          console.error('Failed to check start selling tooltip status:', error);
        }
      }
    };
    
    checkStartSellingTooltipStatus();
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
      
      // Dismiss start selling tooltip
      if (showStartSellingTooltip) {
        setShowStartSellingTooltip(false);
        setHighlightStartSellingButton(false);
        setHasShownStartSellingTooltip(true); // Mark as shown
        
        // Mark start selling tooltip as shown for authenticated users
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
              body: JSON.stringify({ notificationId: 4 })
            });
          } catch (error) {
            console.error('Failed to mark start selling tooltip as shown:', error);
          }
        }
      }
    };

    window.addEventListener('dismissTooltip', handleTooltipDismiss);
    return () => window.removeEventListener('dismissTooltip', handleTooltipDismiss);
  }, [showEmailTooltip, showStartSellingTooltip, auth?.user, hasShownEmailTooltip, hasShownStartSellingTooltip]);
  
  // Track if component is mounted to prevent localStorage corruption during unmount
  const isMountedRef = useRef(true);
  const isInitializedRef = useRef(false);
  const hasSessionRestoredDataRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
          
          const refreshedResults = await refreshContactDataFromDatabase(companies);
          setCurrentResults(refreshedResults);
          
          // Update localStorage with refreshed data
          const stateToSave = {
            currentQuery,
            currentResults: refreshedResults,
            currentListId
          };
          localStorage.setItem('searchState', JSON.stringify(stateToSave));
          sessionStorage.setItem('searchState', JSON.stringify(stateToSave));
          
          // Clear the timestamp as we've refreshed the data
          localStorage.removeItem('lastEmailSearchTimestamp');
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
  const refreshContactDataFromDatabase = async (companies: CompanyWithContacts[]): Promise<CompanyWithContacts[]> => {
    try {
      console.log('Refreshing contact data from database for navigation persistence...');
      
      const refreshedResults = await Promise.all(
        companies.map(async (company) => {
          try {
            // Add cache-busting timestamp to ensure fresh data
            const timestamp = Date.now();
            const response = await apiRequest("GET", `/api/companies/${company.id}/contacts?t=${timestamp}`);
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
        setCurrentQuery(savedState.currentQuery);
        setCurrentResults(savedState.currentResults);
        setCurrentListId(savedState.currentListId);
        
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
        setCurrentQuery(savedState.currentQuery);
        setCurrentListId(savedState.currentListId);
        setCurrentResults(savedState.currentResults);
        
        // Always refresh from database to ensure fresh data (including emails)
        refreshContactDataFromDatabase(savedState.currentResults).then(refreshedResults => {
          const emailsAfterRefresh = refreshedResults.reduce((total, company) => 
            total + (company.contacts?.filter(c => c.email && c.email.length > 0).length || 0), 0
          );
          
          console.log(`NAVIGATION: Database refresh completed with ${emailsAfterRefresh} emails`);
          console.log('NAVIGATION: Companies after refresh:', refreshedResults.map(c => ({
            name: c.name,
            contactCount: c.contacts?.length || 0,
            contactsWithEmails: c.contacts?.filter(contact => contact.email && contact.email.length > 0).length || 0
          })));
          
          // Update state with refreshed data
          setCurrentResults(refreshedResults);
          
          // Update localStorage with complete fresh data
          const updatedState = {
            currentQuery: savedState.currentQuery,
            currentResults: refreshedResults,
            currentListId: savedState.currentListId,
            emailSearchCompleted: savedState.emailSearchCompleted || false,
            emailSearchTimestamp: savedState.emailSearchTimestamp || null,
            navigationRefreshTimestamp: Date.now()
          };
          localStorage.setItem('searchState', JSON.stringify(updatedState));
          sessionStorage.setItem('searchState', JSON.stringify(updatedState));
          
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
        const stateToSave: SavedSearchState = {
          currentQuery,
          currentResults,
          currentListId
        };
        console.log('Saving search state:', {
          query: currentQuery,
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
  }, [currentQuery, currentResults, currentListId]);



  const { data: searchApproaches = [] } = useQuery<any[]>({
    queryKey: ["/api/search-approaches"],
  });


  
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

  // Mutation for updating existing list and navigating to outreach
  const updateAndNavigateMutation = useMutation({
    mutationFn: async () => {
      if (!currentQuery || !currentResults || !currentListId) return;
      
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
      queryClient.invalidateQueries({ queryKey: ["/api/lists"] });
      toast({
        title: "List Updated",
        description: "Your search results have been updated. Redirecting to outreach...",
      });
      // Navigate to outreach page
      setTimeout(() => {
        window.location.href = '/outreach';
      }, 1000);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for auto-creating list and navigating to outreach
  const autoCreateAndNavigateMutation = useMutation({
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
      toast({
        title: "List Created",
        description: "Your search results have been saved. Redirecting to outreach...",
      });
      // Navigate to outreach page
      setTimeout(() => {
        window.location.href = '/outreach';
      }, 1000);
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

  // New handler for initial companies data
  const handleCompaniesReceived = (query: string, companies: Company[]) => {
    console.log('Companies received:', companies.length);
    // Mark that we've received session-restored data
    hasSessionRestoredDataRef.current = true;
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
    const sortedResults = [...results].sort((a, b) => {
      const contactsA = a.contacts?.length || 0;
      const contactsB = b.contacts?.length || 0;
      return contactsB - contactsA; // Descending order
    });
    
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

  const handleSaveList = () => {
    if (!currentResults || !currentQuery) {
      toast({
        title: "Cannot Save",
        description: "Please perform a search first.",
        variant: "destructive",
      });
      return;
    }

    if (currentListId) {
      console.log('Manual save: Updating existing list', currentListId);
      updateListMutation.mutate();
    } else {
      console.log('Manual save: Creating new list');
      autoCreateListMutation.mutate();
    }
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
      // Proceed with updating or auto-creating and navigating
      if (currentListId) {
        updateAndNavigateMutation.mutate();
      } else {
        autoCreateAndNavigateMutation.mutate();
      }
      return;
    }
    
    // Otherwise, check if we have 5+ emails already
    const emailCount = currentResults.reduce((count, company) => {
      return count + (company.contacts?.filter(contact => 
        contact.email && contact.email.length > 5
      ).length || 0);
    }, 0);
    
    if (emailCount >= 5) {
      // We have enough emails, proceed with auto-creation and navigation
      if (currentListId) {
        updateAndNavigateMutation.mutate();
      } else {
        autoCreateAndNavigateMutation.mutate();
      }
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
    onSuccess: async (result) => {
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
      
      // Mark list as needing update since contact data changed
      if (currentListId) {
        setIsSaved(false);
      }

      // CREDIT BILLING ON EMAIL SUCCESS (same as other APIs)
      if (data.email) {
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

  // PRE-SEARCH CREDIT CHECK (same as other APIs)
  const handleEnrichContact = async (contactId: number) => {
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
            return { ...company, contacts };
          } catch (error) {
            console.error(`Failed to load contacts for company ${company.id}:`, error);
            return { ...company, contacts: [] };
          }
        })
      );
      
      setCurrentQuery(list.prompt);
      setCurrentResults(companiesWithContacts);
      setCurrentListId(list.listId);
      setIsSaved(true);
      setSavedSearchesDrawerOpen(false);
      
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
    mutationFn: async ({ contactId, searchContext = 'manual' }: { contactId: number; searchContext?: 'manual' | 'automated' }) => {
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
        success: true,
        emailFound: !!responseData.email
      };
    },
    onSuccess: async (result) => {
      const {data, contactId, searchContext, searchMetadata, emailFound} = result;
      
      // Process credit billing for successful email discoveries
      if (emailFound) {
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
      setCurrentResults(prev => {
        if (!prev) return null;
        
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
      
      // Enhanced toast notifications with search metadata
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
    },
    onError: (error, variables) => {
      const { contactId, searchContext } = variables;
      
      // Remove this contact ID from the set of pending searches
      setPendingHunterIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Enhanced error handling with retry suggestions
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
    },
  });
  
  // Handler for Hunter.io search with credit checking
  const handleHunterSearch = async (contactId: number, searchContext: 'manual' | 'automated' = 'manual') => {
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
    onSuccess: async (result) => {
      const {data, contactId, searchContext} = result;
      
      // Process credit billing for successful email discoveries
      if (data.email) {
        try {
          const creditResponse = await apiRequest("POST", "/api/credits/deduct-individual-email", {
            contactId,
            searchType: 'aeroleads',
            emailFound: true
          });
          
          const creditResult = await creditResponse.json();
          console.log('AeroLeads credit billing result:', creditResult);
          
          // Refresh credits display
          if (creditResult.success) {
            queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
          }
        } catch (creditError) {
          console.error('AeroLeads credit billing failed:', creditError);
          // Don't block user experience for billing errors
        }
      }
      
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

  const handleAeroLeadsSearch = async (contactId: number, searchContext: 'manual' | 'automated' = 'manual') => {
    // Allow multiple searches to run in parallel
    if (pendingAeroLeadsIds.has(contactId)) return; // Only prevent if this specific contact is already being processed
    
    // Check credits before starting search (only for manual searches)
    if (searchContext === 'manual') {
      try {
        const creditsResponse = await apiRequest("GET", "/api/credits");
        const creditsData = await creditsResponse.json();
        
        if (creditsData.currentBalance < 20) { // 20 credits needed for individual email search
          toast({
            title: "Insufficient Credits",
            description: `You need 20 credits for AeroLeads email search. Current balance: ${creditsData.currentBalance}`,
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        console.error('Credit check failed:', error);
        // Continue with search if credit check fails to avoid blocking user
      }
    }
    
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
  
  // Effect to highlight Start Selling button when email search completes
  useEffect(() => {
    // If the consolidated search just finished (summary is visible and not searching)
    if (summaryVisible && !isConsolidatedSearching && !hasShownStartSellingTooltip) {
      // Add a 2-second delay before highlighting the Start Selling button
      const timer = setTimeout(async () => {
        // The search has completed and results are available, highlight the Start Selling button
        setHighlightStartSellingButton(true);
        setShowStartSellingTooltip(true);
        setHasShownStartSellingTooltip(true); // Mark as shown
        
        // Mark start selling tooltip as shown for authenticated users
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
              body: JSON.stringify({ notificationId: 4 })
            });
          } catch (error) {
            console.error('Failed to mark start selling tooltip as shown:', error);
          }
        }
        
        setTimeout(() => {
          setHighlightStartSellingButton(false);
          setShowStartSellingTooltip(false);
        }, 10000);
      }, 2000);
      
      // Clean up timer if component unmounts or dependencies change
      return () => clearTimeout(timer);
    }
  }, [summaryVisible, isConsolidatedSearching, hasShownStartSellingTooltip, auth?.user]);

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
        const refreshedResults = await Promise.all(
          currentResults.map(async (company) => {
            try {
              const response = await fetch(`/api/companies/${company.id}/contacts?t=${cacheTimestamp}`, {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache',
                  'Expires': '0',
                  'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
                }
              });
              
              if (response.ok) {
                const freshContacts = await response.json();
                return {
                  ...company,
                  contacts: freshContacts
                };
              } else {
                return company;
              }
            } catch (error) {
              return company;
            }
          })
        );
        
        // Update state with fresh data
        setCurrentResults([]);
        setTimeout(() => {
          setCurrentResults(refreshedResults);
        }, 100);
        
        // Update localStorage with fresh data
        const stateToSave = {
          currentQuery,
          currentResults: refreshedResults,
          currentListId
        };
        const stateString = JSON.stringify(stateToSave);
        localStorage.setItem('searchState', stateString);
        sessionStorage.setItem('searchState', stateString);
        
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
        const refreshedResults = await Promise.all(
          currentResults.map(async (company) => {
            // Fetch fresh contact data for ALL companies (removed faulty skip logic)
            try {
              const response = await apiRequest("GET", `/api/companies/${company.id}/contacts`);
              const freshContacts = await response.json();
              
              return {
                ...company,
                contacts: freshContacts
              };
            } catch (error) {
              console.error(`Failed to refresh contacts for ${company.name}:`, error);
              return company; // Return original if refresh fails
            }
          })
        );
        
        // Brief UI refresh to show updated data
        setCurrentResults([]);
        setTimeout(() => {
          setCurrentResults(refreshedResults);
        }, 100);
        
        // Update localStorage with fresh data (simplified)
        const stateToSave = {
          currentQuery,
          currentResults: refreshedResults,
          currentListId
        };
        const stateString = JSON.stringify(stateToSave);
        localStorage.setItem('searchState', stateString);
        sessionStorage.setItem('searchState', stateString);
        
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
      
      // Complete search immediately
      toast({
        title: "Email Search Complete",
        description: `Found ${data.summary.emailsFound} emails for ${data.summary.contactsProcessed} contacts across ${data.summary.companiesProcessed} companies`,
      });
      
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
      
      // Step 3: Fetch completely fresh data from database
      console.log('Fetching complete fresh data from database...');
      const freshResults = await refreshContactDataFromDatabase(currentResults);
      
      // Step 4: Count emails to verify success
      const emailCount = freshResults.reduce((total, company) => 
        total + (company.contacts?.filter(c => c.email && c.email.length > 0).length || 0), 0
      );
      
      console.log(`Database reload completed with ${emailCount} emails found`);
      
      // Step 5: Update UI with fresh data
      setCurrentResults(freshResults);
      
      // Step 6: Save complete fresh state to localStorage (single authoritative save)
      const completeState = {
        currentQuery,
        currentResults: freshResults,
        currentListId,
        emailSearchCompleted: true,
        emailSearchTimestamp: Date.now()
      };
      
      const stateString = JSON.stringify(completeState);
      localStorage.setItem('searchState', stateString);
      sessionStorage.setItem('searchState', stateString);
      
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
    mutationFn: async ({ contactId, searchContext = 'manual' }: { contactId: number; searchContext?: 'manual' | 'automated' }) => {
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
        success: true,
        emailFound: !!responseData.email
      };
    },
    onSuccess: async (result) => {
      const {data, contactId, searchContext, searchMetadata, emailFound} = result;
      
      // Process credit billing for successful email discoveries
      if (emailFound) {
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
      setCurrentResults(prev => {
        if (!prev) return null;
        
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
      
      // Enhanced toast notifications with search metadata
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
    },
    onError: (error, variables) => {
      const { contactId, searchContext } = variables;
      
      // Remove this contact ID from the set of pending searches
      setPendingApolloIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
      
      // Enhanced error handling with retry suggestions
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
    },
  });
  
  // Handler for Apollo.io search with credit checking
  const handleApolloSearch = async (contactId: number, searchContext: 'manual' | 'automated' = 'manual') => {
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
    <div className="container mx-auto py-6 px-0 md:px-6">
      {/* Intro tour modal has been removed */}

      <div className="grid grid-cols-12 gap-3 md:gap-6">
        {/* Main Content Area - full width */}
        <div className="col-span-12 space-y-2 md:space-y-4 mt-[-10px]">
          {/* Search Section - border removed and moved up */}
          <div className="px-3 md:px-6 py-1"> {/* Reduced mobile padding, matched desktop padding with CardHeader (p-6) */}
            {!currentResults && (
              <div className="flex flex-col-reverse md:flex-row items-center gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold mt-2 md:mt-0">Search for target businesses</h2>
                </div>
                <div>
                  <EggAnimation />
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
                initialPrompt={currentQuery || ""}
                isFromLandingPage={isFromLandingPage}
                onDismissLandingHint={() => setIsFromLandingPage(false)}
                lastExecutedQuery={lastExecutedQuery}
                onInputChange={(newValue) => {
                  setCurrentQuery(newValue);
                  setInputHasChanged(newValue !== lastExecutedQuery);
                }}
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
                      disabled={autoCreateListMutation.isPending || updateListMutation.isPending}
                      className="opacity-45 hover:opacity-100 hover:bg-white transition-all"
                    >
                      <ListPlus className="mr-2 h-4 w-4" />
                      {currentListId && isSaved ? "Saved" : currentListId ? "Update List" : "Save as List"}
                    </Button>
                  )}
                </div>
                {lastExecutedQuery && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Search: {lastExecutedQuery}
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
                          <span className="hidden md:inline">Start Selling</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Save list, open "Outreach" page & load this list</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <div className="relative">
                    <LandingPageTooltip
                      message="Ready to turn your research into results? Start your outreach!"
                      visible={showStartSellingTooltip}
                      position="custom"
                      offsetX={-40}
                      offsetY={-15}
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

      {/* Fixed position saved searches drawer */}
      <SavedSearchesDrawer 
        open={savedSearchesDrawerOpen}
        onOpenChange={setSavedSearchesDrawerOpen}
        onLoadSearch={handleLoadSavedSearch}
      />

      {/* Notification System */}
      <NotificationToast
        notificationState={notificationState}
        onClose={closeNotification}
      />
    </div>
  );
}