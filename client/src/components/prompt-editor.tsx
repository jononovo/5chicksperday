import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, HelpCircle, Crown, Building, Users, Target, Settings } from "lucide-react";


import { useConfetti } from "@/hooks/use-confetti";
import { SearchSessionManager } from "@/lib/search-session-manager";

import { useAuth } from "@/hooks/use-auth";
import { useRegistrationModal } from "@/hooks/use-registration-modal";
import { useNotifications } from "@/features/user-account-settings";
import { SearchProgress } from "./search-progress";
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
  value: string; // Controlled value from parent
  onChange: (value: string) => void; // Direct setter from parent
  isFromLandingPage?: boolean; // Flag to indicate if user came from landing page
  onDismissLandingHint?: () => void; // Callback to dismiss landing page hint
  lastExecutedQuery?: string | null; // Last executed search query
  onSearchSuccess?: () => void; // Callback when search completes successfully
  hasSearchResults?: boolean; // Flag to indicate if search results exist
  onSessionIdChange?: (sessionId: string | null) => void; // Callback for session ID changes
  hideRoleButtons?: boolean; // Flag to hide role selection buttons when search is inactive
  onSearchMetricsUpdate?: (metrics: any, showSummary: boolean) => void; // Callback to update search metrics in parent
  onOpenSearchDrawer?: () => void; // Callback to open the search management drawer
}

export default function PromptEditor({ 
  onAnalyze, 
  onComplete, 
  onSearchResults, 
  onCompaniesReceived,
  isAnalyzing,
  value,
  onChange,
  isFromLandingPage = false,
  onDismissLandingHint,
  lastExecutedQuery = null,
  onSearchSuccess,
  hasSearchResults = false,
  onSessionIdChange,
  hideRoleButtons = false,
  onSearchMetricsUpdate,
  onOpenSearchDrawer
}: PromptEditorProps) {
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
    totalEmails: 0,
    searchDuration: 0,
    startTime: 0,
    companies: [] as any[]
  });
  
  // Add auth hooks for semi-protected functionality
  const { user } = useAuth();
  const { openForProtectedRoute } = useRegistrationModal();
  
  // Notification system for persistent tooltip tracking
  const { triggerNotification } = useNotifications();
  
  // Track if search tooltip has been shown for authenticated users
  const [hasShownSearchTooltip, setHasShownSearchTooltip] = useState(false);

  // Check if user has already seen search tooltip
  useEffect(() => {
    const checkSearchTooltipStatus = async () => {
      if (user) {
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
          if (data.notifications && data.notifications[2] === 1) {
            setHasShownSearchTooltip(true);
          }
        } catch (error) {
          console.error('Failed to check search tooltip status:', error);
        }
      }
    };
    
    checkSearchTooltipStatus();
  }, [user]);
  
  // Track if input has changed from last executed query
  const [inputHasChanged, setInputHasChanged] = useState(false);
  
  // Contact search configuration state - initialize from localStorage
  const [contactSearchConfig, setContactSearchConfig] = useState<ContactSearchConfig>(() => {
    const saved = localStorage.getItem('contactSearchConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('Error loading saved contact search config:', error);
      }
    }
    // Default config if nothing saved
    return {
      enableCoreLeadership: true,
      enableDepartmentHeads: false,
      enableMiddleManagement: false,
      enableCustomSearch: false,
      customSearchTarget: "",
      enableCustomSearch2: false,
      customSearchTarget2: ""
    };
  });

  // Role selector visibility state
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const roleAutoHideTimerRef = useRef<NodeJS.Timeout | null>(null);


  // Search type configuration state - initialize with localStorage or default to contacts
  const [searchType, setSearchType] = useState<SearchType>(() => {
    const saved = localStorage.getItem('searchType');
    return (saved as SearchType) || 'contacts';
  });

  // Set auth-based default and handle guest-to-registered upgrades
  useEffect(() => {
    const saved = localStorage.getItem('searchType');
    const wasGuest = !localStorage.getItem('hasEverBeenRegistered');
    
    if (user && wasGuest) {
      // User just registered - upgrade from guest default to full feature set
      localStorage.setItem('hasEverBeenRegistered', 'true');
      setSearchType('emails');
    } else if (!saved) {
      // First-time defaults based on auth status
      setSearchType(user ? 'emails' : 'contacts');
    }
  }, [user]);

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
      if (roleAutoHideTimerRef.current) {
        clearTimeout(roleAutoHideTimerRef.current);
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
          onChange(session.query);
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
        
        onChange(recentCompleteSession.query);
        
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

  // Toggle role selector visibility with 12-second auto-hide
  const toggleRoleSelector = useCallback(() => {
    const newState = !showRoleSelector;
    setShowRoleSelector(newState);
    
    // Clear any existing timer
    if (roleAutoHideTimerRef.current) {
      clearTimeout(roleAutoHideTimerRef.current);
      roleAutoHideTimerRef.current = null;
    }
    
    // If showing the selector, set 12-second auto-hide timer
    if (newState) {
      roleAutoHideTimerRef.current = setTimeout(() => {
        setShowRoleSelector(false);
        roleAutoHideTimerRef.current = null;
      }, 12000);
    }
  }, [showRoleSelector]);

  // Handle contact search config changes
  const handleContactSearchConfigChange = useCallback((config: ContactSearchConfig) => {
    console.log('PromptEditor received config update:', config);
    setContactSearchConfig(config);
    
    // Clear any existing timer
    if (roleAutoHideTimerRef.current) {
      clearTimeout(roleAutoHideTimerRef.current);
      roleAutoHideTimerRef.current = null;
    }
    
    // Auto-hide role selector 1.5 seconds after selection
    roleAutoHideTimerRef.current = setTimeout(() => {
      setShowRoleSelector(false);
      roleAutoHideTimerRef.current = null;
    }, 1500);
  }, []);

  // Track input changes to update UI accordingly
  useEffect(() => {
    if (lastExecutedQuery !== null && value !== lastExecutedQuery) {
      setInputHasChanged(true);
    }
  }, [value, lastExecutedQuery]);
  
  // State to track if we should apply the gradient text effect
  const [showGradientText, setShowGradientText] = useState(false);
  
  // Apply gradient text effect when coming from landing page
  useEffect(() => {
    if (isFromLandingPage) {
      setShowGradientText(true);
      
      // Reset after 3 seconds
      const timer = setTimeout(() => {
        setShowGradientText(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isFromLandingPage]);

  // Handle tooltip dismissal
  useEffect(() => {
    const handleTooltipDismiss = async () => {
      if (onDismissLandingHint) {
        onDismissLandingHint();
      }
      
      // Mark search tooltip as shown for authenticated users
      if (user && !hasShownSearchTooltip) {
        setHasShownSearchTooltip(true);
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
            body: JSON.stringify({ notificationId: 2 })
          });
        } catch (error) {
          console.error('Failed to mark search tooltip as shown:', error);
        }
      }
    };

    window.addEventListener('dismissTooltip', handleTooltipDismiss);
    return () => window.removeEventListener('dismissTooltip', handleTooltipDismiss);
  }, [onDismissLandingHint, user, hasShownSearchTooltip]);


  // Use our search strategy context
  

  

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
        undefined,
        contactSearchConfig
      ).id;
      
      setCurrentSessionId(sessionId);
      console.log(`Created session ${sessionId} for query: ${searchQuery}`);
      
      // Use the standard search but optimize for quick company results
      console.log('Quick search initiated');

      // Get companies quickly without waiting for contact enrichment
      const res = await apiRequest("POST", "/api/companies/quick-search", { 
        query: searchQuery,
        strategyId: undefined,
        contactSearchConfig: contactSearchConfig,
        sessionId: sessionId,
        searchType: searchType
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Now we get a jobId instead of companies directly
      console.log(`Job created with ID: ${data.jobId}`);
      
      // Reset input changed state since job is created
      setInputHasChanged(false);
      
      // Update session with job ID and start polling for completion
      if (currentSessionId) {
        SearchSessionManager.updateSessionWithJob(currentSessionId, data.jobId);
        setIsPolling(true);
        console.log(`Started polling for job ${data.jobId} completion`);
      }
      
      // Start polling the job status immediately with very short intervals
      const pollJobStatus = async () => {
        if (!isPollingRef.current) return;
        
        try {
          const response = await apiRequest("GET", `/api/search-jobs/${data.jobId}`);
          if (response.ok) {
            const jobData = await response.json();
            
            // Display partial results even when processing
            if ((jobData.status === 'processing' || jobData.status === 'completed') && jobData.results) {
              const companies = jobData.results?.companies || [];
              const totalContacts = companies.reduce((sum: number, company: any) => 
                sum + (company.contacts?.length || 0), 0);
              
              // Update UI with current results (progressive display)
              if (companies.length > 0) {
                if (currentSessionId) {
                  if (searchType === 'companies') {
                    SearchSessionManager.updateWithQuickResults(currentSessionId, companies);
                    onCompaniesReceived(value, companies);
                  } else {
                    SearchSessionManager.updateWithFullResults(currentSessionId, companies);
                    onSearchResults(value, companies);
                  }
                }
                
                console.log(`Progressive update: ${companies.length} companies, ${totalContacts} contacts`);
              }
            }
            
            if (jobData.status === 'completed') {
              console.log(`Job ${data.jobId} completed`);
              isPollingRef.current = false;
              setIsPolling(false);
              
              // Process final results
              const companies = jobData.results?.companies || [];
              const totalContacts = companies.reduce((sum: number, company: any) => 
                sum + (company.contacts?.length || 0), 0);
              
              console.log(`Final results: ${companies.length} companies with ${totalContacts} contacts`);
              
              // Final update to session
              if (currentSessionId) {
                if (searchType === 'companies') {
                  SearchSessionManager.markQuickResultsComplete(currentSessionId);
                }
              }
              
              // Handle completion
              if (searchType === 'companies') {
                toast({
                  title: "Search Complete",
                  description: `Found ${companies.length} companies.`,
                });
                setSearchProgress(prev => ({ ...prev, phase: "Search Complete", completed: 5, total: 5 }));
              } else {
                const searchDuration = Math.round((Date.now() - searchMetrics.startTime) / 1000);
                
                // Count emails from contacts
                const totalEmails = companies.reduce((sum: number, company: any) => {
                  if (!company.contacts) return sum;
                  return sum + company.contacts.filter((contact: any) => 
                    contact.email && contact.email.length > 5
                  ).length;
                }, 0);
                
                const updatedMetrics = {
                  ...searchMetrics,
                  totalCompanies: companies.length,
                  totalContacts: totalContacts,
                  totalEmails: totalEmails,
                  searchDuration: searchDuration,
                  companies: companies,
                  searchType: searchType, // Include search type to know if emails were searched
                  sourceBreakdown: jobData.results?.sourceBreakdown // Include source breakdown from backend
                };
                
                setSearchMetrics(updatedMetrics);
                
                // Pass metrics to parent and show summary
                if (onSearchMetricsUpdate) {
                  setTimeout(() => {
                    onSearchMetricsUpdate(updatedMetrics, true);
                    // Auto-hide after 15 seconds
                    setTimeout(() => {
                      onSearchMetricsUpdate(updatedMetrics, false);
                    }, 15000);
                  }, 1000);
                }
                
                // Trigger confetti for contact/email searches
                triggerConfetti();
              }
              
              // Refresh credits display
              if (user) {
                queryClient.invalidateQueries({ queryKey: ['/api/credits'] });
              }
              
              onComplete();
            } else if (jobData.status === 'failed') {
              console.error(`Job ${data.jobId} failed:`, jobData.error);
              isPollingRef.current = false;
              setIsPolling(false);
              
              toast({
                title: "Search Failed",
                description: jobData.error || "An error occurred during search",
                variant: "destructive",
              });
              
              onComplete();
            } else {
              // Job still processing, continue polling quickly
              if (jobData.progress) {
                setSearchProgress(prev => ({ 
                  ...prev, 
                  phase: jobData.progress.phase || "Processing",
                  completed: jobData.progress.completed || 0,
                  total: jobData.progress.total || 5
                }));
              }
              
              // Poll very quickly for immediate feedback
              setTimeout(pollJobStatus, 500); // Poll every 500ms for fast updates
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
          if (isPollingRef.current) {
            setTimeout(pollJobStatus, 1000); // Retry after 1 second on error
          }
        }
      };
      
      // Start polling immediately
      isPollingRef.current = true;
      pollJobStatus();
      
      // Show initial progress
      setSearchProgress(prev => ({ ...prev, phase: "Starting Search", completed: 1 }));
      
      // Update progress indicators based on search type
      setTimeout(() => {
        setSearchProgress(prev => ({ ...prev, phase: "Finding Companies", completed: 2 }));
      }, 1000);
      
      // Show search phase notifications conditionally based on configuration
      if (searchType === 'contacts' || searchType === 'emails') {
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
        }, 15000);
      }
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

  const handleSearch = async () => {
    if (!value.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a search query.",
        variant: "destructive",
      });
      return;
    }

    // Easter egg check - intercept before normal search
    const trimmedQuery = value.trim().toLowerCase();
    if (trimmedQuery === "5ducks" || trimmedQuery === "free palestine" || trimmedQuery === "he is risen") {
      try {
        const response = await apiRequest("POST", "/api/credits/easter-egg", { query: value.trim() });
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
      query: value,
      totalCompanies: 0,
      totalContacts: 0,
      totalEmails: 0,
      searchDuration: 0,
      startTime: Date.now(),
      companies: []
    });
    
    console.log("Analyzing search query...");
    console.log(`Preparing to search for ${searchType === 'companies' ? 'companies only' : searchType === 'contacts' ? 'companies and contacts' : searchType === 'individual' ? 'specific individual' : 'companies, contacts, and emails'}...`);
    onAnalyze();
    
    // Choose search strategy based on selected search type
    if (searchType === 'companies') {
      // Companies-only search - use quick search without contact enrichment
      quickSearchMutation.mutate(value);
    } else {
      // Full search with contacts (and potentially emails)
      quickSearchMutation.mutate(value);
    }
    
    // Semi-protected logic: Show registration modal after 35 seconds if not authenticated
    if (!user) {
      setTimeout(() => {
        openForProtectedRoute();
      }, 35000);
    }
  };



  return (
    <div className="pl-0 pr-1 pt-1 pb-1 shadow-none"> {/* Container with no padding */}
      <div className="flex flex-col gap-0 md:gap-2">
        <div className="relative">
          {/* Component tooltip version for comparison */}
          <LandingPageTooltip
            message="If you are happy with this prompt, click search."
            visible={isFromLandingPage && (!user || !hasShownSearchTooltip) && !(isAnalyzing || quickSearchMutation.isPending)}
            position="custom"
            offsetX={0}
            offsetY={-20}
          />
          
          <Textarea
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !(isAnalyzing || quickSearchMutation.isPending)) {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="Recently exited startups in Miami "
            rows={2}
            className={`md:rounded-md rounded-md resize-none pb-12 text-base md:text-lg text-gray-700 hover:border-gray-300 md:focus-visible:border-gray-400 ${isFromLandingPage ? 'racing-light-effect' : ''} ${showGradientText ? 'gradient-text-input' : ''}`}
          />
          
          {/* Bottom controls container - positioned inside textarea */}
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between pointer-events-none">
            {/* Left side: Search type selector and role indicator */}
            <div className="pointer-events-auto flex items-center gap-2">
              <SearchTypeSelector
                selectedType={searchType}
                onTypeChange={setSearchType}
                disabled={isAnalyzing || quickSearchMutation.isPending}
              />
              
              {/* Active role indicator button - always grayed out */}
              {(() => {
                // Determine which role is active and display it
                if (contactSearchConfig.enableCoreLeadership) {
                  return (
                    <button
                      onClick={toggleRoleSelector}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      <Crown className="h-3.5 w-3.5" />
                      <span className="font-medium">Leadership</span>
                    </button>
                  );
                } else if (contactSearchConfig.enableDepartmentHeads) {
                  return (
                    <button
                      onClick={toggleRoleSelector}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      <Building className="h-3.5 w-3.5" />
                      <span className="font-medium">Marketing</span>
                    </button>
                  );
                } else if (contactSearchConfig.enableMiddleManagement) {
                  return (
                    <button
                      onClick={toggleRoleSelector}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span className="font-medium">CTO</span>
                    </button>
                  );
                } else if (contactSearchConfig.enableCustomSearch && contactSearchConfig.customSearchTarget) {
                  return (
                    <button
                      onClick={toggleRoleSelector}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      <Target className="h-3.5 w-3.5" />
                      <span className="font-medium">{contactSearchConfig.customSearchTarget}</span>
                    </button>
                  );
                } else if (contactSearchConfig.enableCustomSearch2 && contactSearchConfig.customSearchTarget2) {
                  return (
                    <button
                      onClick={toggleRoleSelector}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors cursor-pointer"
                    >
                      <Target className="h-3.5 w-3.5" />
                      <span className="font-medium">{contactSearchConfig.customSearchTarget2}</span>
                    </button>
                  );
                }
                return null;
              })()}

              {/* Search Management Gear Icon */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onOpenSearchDrawer}
                      className="flex items-center justify-center p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                      aria-label="Search Management"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Manage Search Queue</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {/* Right side: Search button */}
            <div className="pointer-events-auto">
              <Button 
                type="submit"
                onClick={handleSearch} 
                disabled={isAnalyzing || quickSearchMutation.isPending}
                className={`
                  rounded-md
                  transition-all duration-300 flex items-center gap-2
                  ${lastExecutedQuery && !inputHasChanged 
                    ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-400 dark:hover:bg-gray-500 shadow-md hover:shadow-lg text-gray-700 dark:text-gray-900' 
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-md hover:shadow-lg'
                  }
                `}
                aria-label="Search"
              >
                {(isAnalyzing || quickSearchMutation.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    <span>Search</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile layout: Contact chips - only shown when showRoleSelector is true */}
        {!hideRoleButtons && showRoleSelector && (
          <div className="md:hidden">
            <ContactSearchChips
              config={contactSearchConfig}
              onConfigChange={handleContactSearchConfigChange}
              disabled={isAnalyzing || quickSearchMutation.isPending}
              isSearching={quickSearchMutation.isPending}
              hasSearchResults={hasSearchResults}
              inputHasChanged={hasSearchResults && value !== lastExecutedQuery}
            />
          </div>
        )}
        
        {/* Desktop Contact Search Chips - positioned below search input, only shown when showRoleSelector is true */}
        {!hideRoleButtons && showRoleSelector && (
          <div className="hidden md:block">
            <ContactSearchChips
              config={contactSearchConfig}
              onConfigChange={handleContactSearchConfigChange}
              disabled={isAnalyzing || quickSearchMutation.isPending}
              isSearching={quickSearchMutation.isPending}
              hasSearchResults={hasSearchResults}
              inputHasChanged={hasSearchResults && value !== lastExecutedQuery}
            />
          </div>
        )}
        
        {/* Progress Bar - moved below search input/button */}
        {quickSearchMutation.isPending && (
          <SearchProgress 
            phase={searchProgress.phase}
            completed={searchProgress.completed}
            total={searchProgress.total}
            isVisible={quickSearchMutation.isPending}
          />
        )}


      </div>

    </div>
  );
}