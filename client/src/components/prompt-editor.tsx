import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, HelpCircle } from "lucide-react";

import { useConfetti } from "@/hooks/use-confetti";
import { useSearchStrategy } from "@/lib/search-strategy-context";
import SearchSettingsDrawer from "./search-settings-drawer";
import { SearchSessionManager } from "@/lib/search-session-manager";
import { NotificationDialog } from "@/components/ui/notification-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useRegistrationModal } from "@/hooks/use-registration-modal";
import { SearchProgress } from "./search-progress";
import { MainSearchSummary } from "./main-search-summary";
import { LandingPageTooltip } from "@/components/ui/landing-page-tooltip";
import ContactSearchChips, { ContactSearchConfig } from "./contact-search-chips";
import SearchTypeSelector, { SearchType } from "./search-type-selector";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PromptEditorProps {
  onAnalyze: () => void;
  onComplete: () => void;
  onSearchResults: (query: string, results: any[]) => void;
  onCompaniesReceived: (query: string, companies: any[]) => void; // New callback for quick results
  isAnalyzing: boolean;
  initialPrompt?: string;
  isFromLandingPage?: boolean; // Flag to indicate if user came from landing page
  onDismissLandingHint?: () => void; // Callback to dismiss landing page hint
  lastExecutedQuery?: string | null; // Last executed search query
  onInputChange?: (newValue: string) => void; // Callback for input changes
  onSearchSuccess?: () => void; // Callback when search completes successfully
  hasSearchResults?: boolean; // Flag to indicate if search results exist
  onSessionIdChange?: (sessionId: string | null) => void; // Callback for session ID changes
}

export default function PromptEditor({ 
  onAnalyze, 
  onComplete, 
  onSearchResults, 
  onCompaniesReceived,
  isAnalyzing,
  initialPrompt = "",
  isFromLandingPage = false,
  onDismissLandingHint,
  lastExecutedQuery = null,
  onInputChange,
  onSearchSuccess,
  hasSearchResults = false,
  onSessionIdChange
}: PromptEditorProps) {
  const [query, setQuery] = useState(initialPrompt);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { triggerConfetti } = useConfetti();
  
  // Progress tracking state
  const [searchProgress, setSearchProgress] = useState({
    phase: "",
    completed: 0,
    total: 5 // Total phases: Starting-up, Companies Found, Analyzing, Contact Discovery, Scoring
  });
  
  // Summary state
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [searchMetrics, setSearchMetrics] = useState({
    query: "",
    totalCompanies: 0,
    totalContacts: 0,
    searchDuration: 0,
    startTime: 0,
    companies: [] as any[]
  });
  
  // Add auth hooks for semi-protected functionality
  const { user } = useAuth();
  const { openForProtectedRoute } = useRegistrationModal();
  
  // Track if input has changed from last executed query
  const [inputHasChanged, setInputHasChanged] = useState(false);
  
  // Contact search configuration state
  const [contactSearchConfig, setContactSearchConfig] = useState<ContactSearchConfig>({
    enableCoreLeadership: true,
    enableDepartmentHeads: true,
    enableMiddleManagement: true,
    enableCustomSearch: false,
    customSearchTarget: "",
    enableCustomSearch2: false,
    customSearchTarget2: ""
  });

  // Search type configuration state - initialize with localStorage or default to contacts
  const [searchType, setSearchType] = useState<SearchType>(() => {
    const saved = localStorage.getItem('searchType');
    return (saved as SearchType) || 'contacts';
  });

  // Welcome dialog state for new registered users
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);

  // Set auth-based default and handle guest-to-registered upgrades
  useEffect(() => {
    const saved = localStorage.getItem('searchType');
    const wasGuest = !localStorage.getItem('hasEverBeenRegistered');
    
    if (user && wasGuest) {
      console.log('Guest-to-registered user transition detected');
      
      // Show welcome dialog
      setShowWelcomeDialog(true);
      
      // Mark as registered user and upgrade search type
      localStorage.setItem('hasEverBeenRegistered', 'true');
      setSearchType('emails');
    } else if (!saved) {
      // First-time defaults based on auth status
      setSearchType(user ? 'emails' : 'contacts');
    }
  }, [user, onInputChange]);

  // Save search type to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('searchType', searchType);
  }, [searchType]);

  // Session management state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  
  // Stable refs for session management
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stable callback refs to prevent useEffect dependencies
  const stableOnSearchResults = useRef(onSearchResults);
  const stableOnCompaniesReceived = useRef(onCompaniesReceived);
  const stableOnSearchSuccess = useRef(onSearchSuccess);
  const stableToast = useRef(toast);
  
  // Update refs when props change
  useEffect(() => {
    stableOnSearchResults.current = onSearchResults;
    stableOnCompaniesReceived.current = onCompaniesReceived;
    stableOnSearchSuccess.current = onSearchSuccess;
    stableToast.current = toast;
  });

  // Function to refresh contact data using outreach page pattern (cache invalidation + fresh queries)
  const refreshContactDataFromCache = async (session: any) => {
    try {
      // Get saved search state from localStorage
      const savedState = localStorage.getItem('searchState');
      if (!savedState) return;
      
      const { currentResults } = JSON.parse(savedState);
      if (!currentResults || currentResults.length === 0) return;
      
      console.log('[Email Refresh] Starting database sync for', currentResults.length, 'companies');
      
      // STEP 1: Force cache invalidation (outreach page pattern)
      console.log('[Email Refresh] Invalidating React Query cache...');
      currentResults.forEach((company: any) => {
        queryClient.invalidateQueries({ queryKey: [`/api/companies/${company.id}/contacts`] });
      });
      
      // STEP 2: Wait for cache invalidation to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // STEP 3: Fetch fresh contact data directly from database
      console.log('[Email Refresh] Fetching fresh contact data from database...');
      const refreshedResults = await Promise.all(
        currentResults.map(async (company: any) => {
          try {
            const response = await fetch(`/api/companies/${company.id}/contacts`);
            if (response.ok) {
              const freshContacts = await response.json();
              return {
                ...company,
                contacts: freshContacts
              };
            } else {
              console.error(`Failed to refresh contacts for company ${company.id}:`, response.status);
              return company;
            }
          } catch (error) {
            console.error(`Failed to refresh contacts for company ${company.id}:`, error);
            return company;
          }
        })
      );
      
      // STEP 4: Update localStorage with fresh database data
      const updatedState = {
        currentQuery: session.query,
        currentResults: refreshedResults
      };
      const stateString = JSON.stringify(updatedState);
      localStorage.setItem('searchState', stateString);
      sessionStorage.setItem('searchState', stateString);
      
      // STEP 5: Force UI update with fresh database data
      stableOnSearchResults.current(session.query, refreshedResults);
      
      console.log('[Email Refresh] Database sync completed - all emails reflected');
      
      stableToast.current({
        title: "Email Search Complete",
        description: "Contact data updated with fresh email discoveries",
      });
      
    } catch (error) {
      console.error('[Email Refresh] Database sync failed:', error);
    }
  };

  // Polling effect with proper cleanup
  useEffect(() => {
    if (!currentSessionId || !isPolling || isPollingRef.current) return;

    isPollingRef.current = true;

    const pollForCompletion = async () => {
      if (!isPollingRef.current) return; // Exit if polling was stopped
      
      try {
        const response = await fetch(`/api/search-sessions/${currentSessionId}/status`);
        if (response.ok) {
          // Validate that response is actually JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.warn('Session polling response is not JSON, skipping...');
            return;
          }
          
          const responseData = await response.json();
          
          // Validate response structure
          if (!responseData.success || !responseData.session) {
            console.warn('Invalid session response structure:', responseData);
            return;
          }
          
          const session = responseData.session;
          
          // Check for email search completion first
          if (session.emailSearchStatus === 'completed' && session.emailSearchCompleted) {
            console.log('Email search completed, refreshing contact data');
            
            // Check if we need to refresh contact data
            const lastCacheUpdate = localStorage.getItem('lastCacheUpdate') ? 
              parseInt(localStorage.getItem('lastCacheUpdate') || '0') : 0;
            
            if (session.emailSearchCompleted > lastCacheUpdate) {
              console.log('Email search newer than cache, refreshing data');
              refreshContactDataFromCache(session);
              localStorage.setItem('lastCacheUpdate', session.emailSearchCompleted.toString());
            }
          }
          
          if (session.status === 'contacts_complete' && session.fullResults) {
            console.log('Session completed, restoring results:', session);
            
            // Stop polling before restoration
            isPollingRef.current = false;
            setIsPolling(false);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            
            // Clean up the completed session to prevent re-restoration
            SearchSessionManager.cleanupSession(session.id);
            
            // Restore the complete results
            stableOnSearchResults.current(session.query, session.fullResults);
            stableOnSearchSuccess.current?.();
            
            stableToast.current({
              title: "Search completed!",
              description: `Found results for "${session.query}"`,
            });
          } else if (session.status === 'failed') {
            console.log('Session failed:', session);
            
            isPollingRef.current = false;
            setIsPolling(false);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            
            SearchSessionManager.cleanupSession(session.id);
            
            stableToast.current({
              title: "Search failed",
              description: session.error || "An error occurred during search",
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        console.error('Error polling session:', error);
        // If polling fails repeatedly, stop polling to prevent spam
        if (isPollingRef.current) {
          isPollingRef.current = false;
          setIsPolling(false);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      }
    };

    pollingIntervalRef.current = setInterval(pollForCompletion, 3000);
    
    return () => {
      isPollingRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [currentSessionId, isPolling]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clear all timeouts and intervals
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      isPollingRef.current = false;
    };
  }, []);

  // Helper function to check if session data has complete contact information
  const isSessionDataComplete = (session: any): boolean => {
    if (!session.fullResults || !Array.isArray(session.fullResults)) return false;
    
    // Check if at least one company has contacts
    return session.fullResults.some((company: any) => 
      company.contacts && Array.isArray(company.contacts) && company.contacts.length > 0
    );
  };

  // Check for existing sessions on mount - run only once
  useEffect(() => {
    if (hasRestoredSession) return; // Prevent multiple executions
    
    const handleSessionRestore = async () => {
      const activeSessions = SearchSessionManager.getActiveSessions();
      const recentCompleteSession = SearchSessionManager.getMostRecentCompleteSession();
      
      if (activeSessions.length > 0) {
        // Check if we have multiple active sessions - clean them up first
        if (activeSessions.length > 1) {
          console.log(`[Session Conflict] Found ${activeSessions.length} active sessions, cleaning up older ones...`);
          
          // Keep only the most recent session, terminate others
          const mostRecentSession = activeSessions[0];
          const olderSessions = activeSessions.slice(1);
          
          for (const oldSession of olderSessions) {
            await SearchSessionManager.terminateSession(oldSession.id);
          }
          
          console.log(`[Session Conflict] Terminated ${olderSessions.length} older sessions, keeping ${mostRecentSession.id}`);
        }
        
        // Resume the most recent active session
        const session = activeSessions[0];
        console.log('Resuming active session:', session);
        
        setCurrentSessionId(session.id);
        setIsPolling(true);
        setHasRestoredSession(true);
        
        // Notify parent component of session ID
        onSessionIdChange?.(session.id);
        
        // If we have quick results, show them immediately
        if (session.quickResults && session.quickResults.length > 0) {
          stableOnCompaniesReceived.current(session.query, session.quickResults);
          setQuery(session.query);
        }
        
        stableToast.current({
          title: "Search in progress",
          description: `Continuing search for "${session.query}"`,
        });
      } else if (recentCompleteSession) {
        // Check if session has complete data with contacts
        const sessionHasCompleteData = isSessionDataComplete(recentCompleteSession);
        
        console.log('Restoring recent complete session:', recentCompleteSession);
        console.log('Session has complete contact data:', sessionHasCompleteData);
        
        setQuery(recentCompleteSession.query);
        
        if (recentCompleteSession.fullResults && sessionHasCompleteData) {
          // Full search with contacts completed - use session data
          console.log('Using complete session data with contacts');
          stableOnSearchResults.current(recentCompleteSession.query, recentCompleteSession.fullResults);
          setHasRestoredSession(true);
        } else {
          // Session has incomplete data - allow localStorage fallback in Home component
          console.log('Session has incomplete data - allowing localStorage fallback');
        }
      }
    };
    
    handleSessionRestore();
  }, [hasRestoredSession]);

  // Handle contact search config changes
  const handleContactSearchConfigChange = useCallback((config: ContactSearchConfig) => {
    console.log('PromptEditor received config update:', config);
    setContactSearchConfig(config);
  }, []);

  // Track input changes to update UI accordingly
  useEffect(() => {
    if (lastExecutedQuery !== null && query !== lastExecutedQuery) {
      setInputHasChanged(true);
      if (onInputChange) {
        onInputChange(query);
      }
    }
  }, [query, lastExecutedQuery, onInputChange]);
  
  // State to track if we should apply the gradient text effect
  const [showGradientText, setShowGradientText] = useState(false);
  
  // Set initial query only once when component mounts or when coming from landing page
  useEffect(() => {
    if (initialPrompt && query === "") {
      setQuery(initialPrompt);
      
      // If we're coming from the landing page, apply the gradient text effect temporarily
      if (isFromLandingPage) {
        setShowGradientText(true);
        
        // Reset after 6 seconds or when the user changes the input
        const timer = setTimeout(() => {
          setShowGradientText(false);
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [initialPrompt, isFromLandingPage]);

  // Handle tooltip dismissal
  useEffect(() => {
    const handleTooltipDismiss = () => {
      if (onDismissLandingHint) {
        onDismissLandingHint();
      }
    };

    window.addEventListener('dismissTooltip', handleTooltipDismiss);
    return () => window.removeEventListener('dismissTooltip', handleTooltipDismiss);
  }, [onDismissLandingHint]);


  // Use our search strategy context
  const { selectedStrategyId } = useSearchStrategy();
  

  
  // Mutation for workflow-based search
  const workflowSearchMutation = useMutation({
    mutationFn: async ({ 
      query, 
      strategyId, 
      provider,
      targetUrl,
      resultsUrl
    }: { 
      query: string; 
      strategyId?: number;
      provider?: string;
      targetUrl?: string;
      resultsUrl?: string;
    }) => {
      console.log(`Sending workflow search request: ${query} (Provider: ${provider || 'default'})`);
      if (targetUrl) {
        console.log(`Target URL: ${targetUrl}`);
      }
      if (resultsUrl) {
        console.log(`Results URL: ${resultsUrl}`);
      }
      
      const res = await apiRequest("POST", "/api/workflow-search", { 
        query,
        strategyId,
        provider,
        targetUrl,
        resultsUrl
      });
      return res.json();
    },
    onSuccess: (data) => {
      console.log("Workflow search started:", data);
      toast({
        title: "Search Started",
        description: `Search request sent to workflow. SearchID: ${data.searchId}`,
      });
      // Note: Results will come back through the webhook
      setIsCustomLoading(false);
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Workflow Search Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsCustomLoading(false);
      onComplete();
    },
  });

  // Quick search mutation - gets companies immediately
  const quickSearchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      console.log("Initiating company search process...");
      console.log("Sending request to company discovery API...");
      
      // First, clean up any existing active sessions to prevent conflicts
      console.log("[Session Management] Cleaning up active sessions before starting new search...");
      await SearchSessionManager.cleanupActiveSessions();
      
      // Create a new session for this search
      const sessionId = SearchSessionManager.createSession(
        searchQuery, 
        selectedStrategyId ? parseInt(selectedStrategyId) : undefined,
        contactSearchConfig
      ).id;
      
      setCurrentSessionId(sessionId);
      console.log(`Created session ${sessionId} for query: ${searchQuery}`);
      
      // Use the standard search but optimize for quick company results
      console.log(`Quick search with strategy: ${selectedStrategyId || "Default"}`);

      // Get companies quickly without waiting for contact enrichment
      const res = await apiRequest("POST", "/api/companies/quick-search", { 
        query: searchQuery,
        strategyId: selectedStrategyId ? parseInt(selectedStrategyId) : undefined,
        contactSearchConfig: contactSearchConfig,
        sessionId: sessionId,
        searchType: searchType
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      
      // Pass companies immediately to the parent component
      console.log("Processing company results...");
      console.log(`Found ${data.companies.length} companies matching your search`);
      
      // Reset input changed state since we have initial results
      setInputHasChanged(false);
      
      // Update session with quick results and start polling for completion
      if (currentSessionId) {
        SearchSessionManager.updateWithQuickResults(currentSessionId, data.companies);
        // Mark quick results as restorable immediately
        SearchSessionManager.markQuickResultsComplete(currentSessionId);
        setIsPolling(true);
        console.log(`Started polling for session ${currentSessionId} completion`);
      }
      
      onCompaniesReceived(query, data.companies);
      
      // Handle search completion based on selected search type
      if (searchType === 'companies') {
        toast({
          title: "Search Complete",
          description: `Found ${data.companies.length} companies.`,
        });
        
        setSearchProgress(prev => ({ ...prev, phase: "Search Complete", completed: 5, total: 5 }));
        
        // Complete the search for companies-only mode
        onComplete();
        return;
      }
      
      toast({
        title: "Companies Found",
        description: `Found ${data.companies.length} companies. Loading contacts...`,
      });
      
      setSearchProgress(prev => ({ ...prev, phase: "Companies Found", completed: 1 }));
      
      // Start the full search with contacts
      fullContactSearchMutation.mutate(data.query);
      
      // Update progress to analyzing companies phase
      setTimeout(() => {
        setSearchProgress(prev => ({ ...prev, phase: "Analyzing Companies", completed: 2 }));
      }, 2000);
      
      // Show search phase notifications conditionally based on configuration
      const showPhaseNotifications = () => {
        // 3s: Leadership (only if enabled)
        if (contactSearchConfig?.enableCoreLeadership) {
          setTimeout(() => {
            toast({
              title: "Leadership Search",
              description: "Searching for C-level executives and founders...",
            });
            setSearchProgress(prev => ({ ...prev, phase: "Contact Discovery", completed: 3 }));
          }, 3000);
        }
        
        // 5s: Department heads (only if enabled)  
        if (contactSearchConfig?.enableDepartmentHeads) {
          setTimeout(() => {
            toast({
              title: "Department Search",
              description: "Identifying department leaders and key managers...",
            });
          }, 5000);
        }
        
        // 7s: Middle management (only if enabled)
        if (contactSearchConfig?.enableMiddleManagement) {
          setTimeout(() => {
            toast({
              title: "Senior Staff Search",
              description: "Finding senior staff and decision makers...",
            });
          }, 7000);
        }
        
        // 9s: First custom search (only if enabled)
        if (contactSearchConfig?.enableCustomSearch && contactSearchConfig?.customSearchTarget) {
          setTimeout(() => {
            toast({
              title: "Custom Search",
              description: `Searching for ${contactSearchConfig.customSearchTarget} specialists...`,
            });
          }, 9000);
        }
        
        // 11s: Second custom search (only if enabled)
        if (contactSearchConfig?.enableCustomSearch2 && contactSearchConfig?.customSearchTarget2) {
          setTimeout(() => {
            toast({
              title: "Custom Search",
              description: `Searching for ${contactSearchConfig.customSearchTarget2} specialists...`,
            });
          }, 11000);
        }
      };
      
      // Execute the conditional notification system
      showPhaseNotifications();
      
      // Update progress to scoring contacts phase
      setTimeout(() => {
        setSearchProgress(prev => ({ ...prev, phase: "Scoring Contacts", completed: 4 }));
      }, 14000);
    },
    onError: (error: Error) => {
      // Check if it's a credit blocking error (402 status)
      if (error.message.includes("402:") || error.message.includes("insufficient credits")) {
        toast({
          title: "Account Blocked",
          description: "Account blocked due to insufficient credits.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Company Search Failed",
          description: error.message,
          variant: "destructive",
        });
      }
      onComplete();
    },
  });
  
  // Full search mutation - gets contacts after companies are displayed
  const fullContactSearchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      console.log("Starting contact discovery process...");
      console.log("Searching for key decision makers and contacts...");
      
      // Ensure proper typing for the full search request with contacts
      console.log("Sending comprehensive search request to API...");
      console.log("This process may take a moment while we find the most relevant contacts...");
      
      const res = await apiRequest("POST", "/api/companies/search", { 
        query: searchQuery,
        strategyId: selectedStrategyId ? parseInt(selectedStrategyId) : undefined,
        includeContacts: true,
        contactSearchConfig: contactSearchConfig,
        sessionId: currentSessionId
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Calculate total contacts found
      const totalContacts = data.companies.reduce((sum: number, company: any) => 
        sum + (company.contacts?.length || 0), 0);
      
      console.log("Contact discovery completed successfully");
      console.log(`Found ${totalContacts} contacts across ${data.companies.length} companies`);
      
      console.log("Processing and organizing results...");
      
      // Reset input changed state since search is complete
      setInputHasChanged(false);
      
      // Update session with complete results and stop polling
      if (currentSessionId) {
        SearchSessionManager.updateWithFullResults(currentSessionId, data.companies);
        setIsPolling(false);
        console.log(`Session ${currentSessionId} completed with full results`);
      }
      
      // Force fresh database queries by invalidating React Query cache
      // This replicates the outreach page behavior that works perfectly
      console.log("[Database Sync] Invalidating cache to force fresh queries...");
      
      // Invalidate all company and contact queries to force database refresh
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      data.companies.forEach((company: any) => {
        queryClient.invalidateQueries({ queryKey: [`/api/companies/${company.id}/contacts`] });
      });
      
      // Small delay to ensure cache invalidation completes before UI update
      setTimeout(() => {
        console.log("[Database Sync] Cache invalidated, sending results to UI...");
        onSearchResults(query, data.companies);
      }, 100);
      
      // Calculate search duration and show summary
      const searchDuration = Math.round((Date.now() - searchMetrics.startTime) / 1000);
      setSearchMetrics(prev => ({
        ...prev,
        totalCompanies: data.companies.length,
        totalContacts: totalContacts,
        searchDuration: searchDuration,
        companies: data.companies
      }));
      
      // Show summary after a brief delay
      setTimeout(() => {
        setSummaryVisible(true);
        // Auto-hide summary after 8 seconds
        setTimeout(() => {
          setSummaryVisible(false);
        }, 8000);
      }, 1000);
      
      console.log("Search process completed!");
      
      // Trigger confetti animation on successful search
      triggerConfetti();
      // Call the onSearchSuccess callback to highlight the email button (if provided)
      if (onSearchSuccess) {
        onSearchSuccess();
      }
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Contact Search Failed",
        description: error.message,
        variant: "destructive",
      });
      onComplete();
    },
  });

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a search query.",
        variant: "destructive",
      });
      return;
    }

    // Easter egg check - intercept before normal search
    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery === "5ducks" || trimmedQuery === "free palestine" || trimmedQuery === "he is risen") {
      try {
        const response = await apiRequest("POST", "/api/credits/easter-egg", { query: query.trim() });
        const result = await response.json();
        
        toast({
          title: `${result.easterEgg.emoji} Easter Egg Found!`,
          description: `${result.easterEgg.description} - +${result.easterEgg.reward} credits added!`,
        });
        
        // Refresh credits display
        queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
        onComplete();
        return; // Skip normal search
      } catch (error: any) {
        const errorData = await error.response?.json();
        toast({
          title: "Easter Egg",
          description: errorData?.message || "Already claimed!",
          variant: "destructive",
        });
        onComplete();
        return; // Skip normal search
      }
    }
    
    // Dismiss the landing page hint if active
    if (isFromLandingPage && onDismissLandingHint) {
      onDismissLandingHint();
    }
    
    // Don't reset inputHasChanged here - wait until search completes
    
    // Reset and initialize progress
    setSearchProgress({ phase: "Starting-up Search Requests", completed: 0, total: 5 });
    
    // Initialize search metrics
    setSearchMetrics({
      query: query,
      totalCompanies: 0,
      totalContacts: 0,
      searchDuration: 0,
      startTime: Date.now(),
      companies: []
    });
    
    console.log("Analyzing search query...");
    console.log(`Preparing to search for ${searchType === 'companies' ? 'companies only' : searchType === 'contacts' ? 'companies and contacts' : 'companies, contacts, and emails'}...`);
    onAnalyze();
    
    // Choose search strategy based on selected search type
    if (searchType === 'companies') {
      // Companies-only search - use quick search without contact enrichment
      quickSearchMutation.mutate(query);
    } else {
      // Full search with contacts (and potentially emails)
      quickSearchMutation.mutate(query);
    }
    
    // Semi-protected logic: Show registration modal after 14 seconds if not authenticated
    if (!user) {
      setTimeout(() => {
        openForProtectedRoute();
      }, 14000);
    }
  };

  // State for custom workflow configuration with localStorage persistence
  const [targetUrl, setTargetUrl] = useState<string>(() => {
    // Try to get the value from localStorage
    const savedValue = localStorage.getItem('5ducks_target_url');
    return savedValue || "";
  });
  
  const [resultsUrl, setResultsUrl] = useState<string>(() => {
    // Try to get the value from localStorage
    const savedValue = localStorage.getItem('5ducks_results_url');
    return savedValue || "";
  });
  
  const [customSelected, setCustomSelected] = useState<boolean>(false);
  
  // Separate loading states for search and custom buttons
  const [isCustomLoading, setIsCustomLoading] = useState<boolean>(false);
  
  // Save values to localStorage when they change
  useEffect(() => {
    localStorage.setItem('5ducks_target_url', targetUrl);
  }, [targetUrl]);
  
  useEffect(() => {
    localStorage.setItem('5ducks_results_url', resultsUrl);
  }, [resultsUrl]);

  // Function to handle custom workflow search
  const handleCustomWorkflowSearch = () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a search query.",
        variant: "destructive",
      });
      return;
    }

    if (!targetUrl.trim()) {
      toast({
        title: "Missing Target URL",
        description: "Please enter a target URL for the workflow.",
        variant: "destructive",
      });
      return;
    }

    console.log(`Executing custom workflow search with target: ${targetUrl}`);
    setCustomSelected(true);
    setIsCustomLoading(true);
    
    // Execute the search with custom URLs
    onAnalyze();
    workflowSearchMutation.mutate({ 
      query, 
      provider: 'custom',
      targetUrl,
      resultsUrl: resultsUrl.trim() || undefined
    });
  };

  return (
    <div className="pl-0 pr-1 pt-1 pb-1 shadow-none"> {/* Container with no padding */}
      <div className="flex flex-col gap-0 md:gap-2">
        {/* Main Search Summary */}
        <MainSearchSummary
          query={searchMetrics.query}
          totalCompanies={searchMetrics.totalCompanies}
          totalContacts={searchMetrics.totalContacts}
          searchDuration={searchMetrics.searchDuration}
          isVisible={summaryVisible}
          onClose={() => setSummaryVisible(false)}
          companies={searchMetrics.companies}
        />
        
        <div className="flex flex-row md:gap-2 gap-0 pl-0">
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (onInputChange) {
                  onInputChange(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !(isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending)) {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Series-A Fintech companies in NYC "
              className={`md:rounded-md rounded-l-md rounded-r-none md:pr-20 pr-4 text-base md:text-lg text-gray-700 hover:border-gray-300 md:focus-visible:border-gray-400 mobile-input-border ${isFromLandingPage ? 'racing-light-effect' : ''} ${showGradientText ? 'gradient-text-input' : ''}`}
            />
            {/* Desktop search type selector - inside input field */}
            <div className="hidden md:block absolute right-2 top-1/2 transform -translate-y-1/2">
              <SearchTypeSelector
                selectedType={searchType}
                onTypeChange={setSearchType}
                disabled={isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending}
              />
            </div>
          </div>
          <div className="flex items-center justify-end md:justify-start relative">

            
            {/* Component tooltip version for comparison */}
            <LandingPageTooltip
              message="If you are happy with this prompt, click search."
              visible={isFromLandingPage && !(isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending)}
              position="custom"
              offsetX={0}
              offsetY={-20}
            />
            
            {/* Enhanced search button with dynamic styling based on state */}
            <Button 
              type="submit"
              onClick={handleSearch} 
              disabled={isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending}
              className={`
                md:rounded-md rounded-l-none rounded-r-md
                transition-all duration-300 flex items-center sm:gap-2
                ${lastExecutedQuery && !inputHasChanged 
                  ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-400 dark:hover:bg-gray-500 shadow-md hover:shadow-lg' 
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-md hover:shadow-lg'
                }
              `}
              aria-label="Search"
            >
              {(isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Searching...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Search</span>
                </>
              )}
            </Button>
            

          </div>
        </div>

        {/* Mobile layout: Search type selector and Contact chips on same row */}
        <div className="md:hidden flex items-start justify-between">
          <div className="flex-1">
            <ContactSearchChips
              onConfigChange={handleContactSearchConfigChange}
              disabled={isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending}
              isSearching={quickSearchMutation.isPending || fullContactSearchMutation.isPending}
              hasSearchResults={hasSearchResults}
              inputHasChanged={hasSearchResults && query !== lastExecutedQuery}
            />
          </div>
          <div className="ml-2 mt-5">
            <SearchTypeSelector
              selectedType={searchType}
              onTypeChange={setSearchType}
              disabled={isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending}
            />
          </div>
        </div>
        
        {/* Desktop Contact Search Chips - positioned below search input */}
        <div className="hidden md:block">
          <ContactSearchChips
            onConfigChange={handleContactSearchConfigChange}
            disabled={isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending}
            isSearching={quickSearchMutation.isPending || fullContactSearchMutation.isPending}
            hasSearchResults={hasSearchResults}
            inputHasChanged={hasSearchResults && query !== lastExecutedQuery}
          />
        </div>
        
        {/* Progress Bar - moved below search input/button */}
        {(quickSearchMutation.isPending || fullContactSearchMutation.isPending) && (
          <SearchProgress 
            phase={searchProgress.phase}
            completed={searchProgress.completed}
            total={searchProgress.total}
            isVisible={quickSearchMutation.isPending || fullContactSearchMutation.isPending}
          />
        )}

        {/* Settings drawer trigger - positioned in lower right corner */}
        <div className="absolute bottom-8 right-4">
          <SearchSettingsDrawer 
            targetUrl={targetUrl}
            setTargetUrl={setTargetUrl}
            resultsUrl={resultsUrl}
            setResultsUrl={setResultsUrl}
            customSelected={customSelected}
            isCustomLoading={isCustomLoading}
            handleCustomWorkflowSearch={handleCustomWorkflowSearch}
          />
        </div>

      </div>

      {/* Welcome dialog for new registered users */}
      <NotificationDialog
        open={showWelcomeDialog}
        onOpenChange={setShowWelcomeDialog}
        title="Congrats Hatchling!"
        description={
          <>
            You have joined the <strong>"Wildling-Duck-Family"</strong> and have unlocked access to <strong>Email Search</strong>.
            <br /><br />
            Run a search now to see complete results including emails of 1-2 Key Contacts per company.
          </>
        }
        buttonText="Yaaay! I Feel so Alive."
        badge={{
          text: "Hatchling",
          variant: "default"
        }}
      />
    </div>
  );
}