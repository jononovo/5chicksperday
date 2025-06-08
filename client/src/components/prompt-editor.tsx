import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, HelpCircle } from "lucide-react";


import { useConfetti } from "@/hooks/use-confetti";
import { useSearchStrategy } from "@/lib/search-strategy-context";
import SearchSettingsDrawer from "./search-settings-drawer";
import SearchProgressIndicator from "./search-progress-indicator";
import { useAuth } from "@/hooks/use-auth";
import { useRegistrationModal } from "@/hooks/use-registration-modal";
import { SearchProgress } from "./search-progress";
import { MainSearchSummary } from "./main-search-summary";
import { LandingPageTooltip } from "@/components/ui/landing-page-tooltip";
import ContactSearchChips, { ContactSearchConfig } from "./contact-search-chips";
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
  hasSearchResults = false
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

  // Handle contact search config changes
  const handleContactSearchConfigChange = (config: ContactSearchConfig) => {
    console.log('PromptEditor received config update:', config);
    setContactSearchConfig(config);
  };

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
      
      // Use the standard search but optimize for quick company results
      console.log(`Quick search with strategy: ${selectedStrategyId || "Default"}`);

      // Get companies quickly without waiting for contact enrichment
      const res = await apiRequest("POST", "/api/companies/quick-search", { 
        query: searchQuery,
        strategyId: selectedStrategyId ? parseInt(selectedStrategyId) : undefined,
        contactSearchConfig: contactSearchConfig
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
      
      onCompaniesReceived(query, data.companies);
      
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
      
      // Show core leadership search notification
      setTimeout(() => {
        toast({
          title: "Leadership Search",
          description: "Searching for C-level executives and founders...",
        });
        setSearchProgress(prev => ({ ...prev, phase: "Contact Discovery", completed: 3 }));
      }, 5000);
      
      // Show department heads search notification
      setTimeout(() => {
        toast({
          title: "Department Search",
          description: "Identifying department leaders and key managers...",
        });
      }, 8000);
      
      // Show middle management search notification
      setTimeout(() => {
        toast({
          title: "Senior Staff Search",
          description: "Finding senior staff and decision makers...",
        });
      }, 11000);
      
      // Update progress to scoring contacts phase
      setTimeout(() => {
        setSearchProgress(prev => ({ ...prev, phase: "Scoring Contacts", completed: 4 }));
      }, 14000);
    },
    onError: (error: Error) => {
      toast({
        title: "Company Search Failed",
        description: error.message,
        variant: "destructive",
      });
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
        contactSearchConfig: contactSearchConfig
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
      
      // Send full results with contacts to parent component
      onSearchResults(query, data.companies);
      

      
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

  const handleSearch = () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a search query.",
        variant: "destructive",
      });
      return;
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
    console.log("Preparing to search for companies and contacts...");
    onAnalyze();
    // Use quickSearchMutation to first get companies without waiting for contact enrichment
    quickSearchMutation.mutate(query);
    
    // Semi-protected logic: Show registration modal after 5 seconds if not authenticated
    if (!user) {
      setTimeout(() => {
        openForProtectedRoute();
      }, 5000);
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
      <div className="flex flex-col gap-2">
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
        
        <div className="flex flex-row gap-2 pl-0">
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
            placeholder="Enter a search query (e.g., 'High-rated Greek restaurants in Midtown NYC')..."
            className={`flex-1 text-base md:text-lg text-gray-700 hover:border-gray-300 focus-visible:border-gray-400 ${isFromLandingPage ? 'racing-light-effect' : ''} ${showGradientText ? 'gradient-text-input' : ''}`}
          />
          <div className="flex items-center justify-end md:justify-start relative">

            
            {/* Component tooltip version for comparison */}
            <LandingPageTooltip
              message="If you are happy with this prompt, click search."
              visible={isFromLandingPage && !(isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending)}
              position="custom"
              offsetX={0}
              offsetY={40}
            />
            
            {/* Enhanced search button with dynamic styling based on state */}
            <Button 
              type="submit"
              onClick={handleSearch} 
              disabled={isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending}
              className={`
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
            
            {/* Settings drawer trigger with custom search props */}
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
        
        {/* Contact Search Chips - positioned below search input */}
        <ContactSearchChips
          onConfigChange={handleContactSearchConfigChange}
          disabled={isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending}
          isSearching={quickSearchMutation.isPending || fullContactSearchMutation.isPending}
          hasSearchResults={hasSearchResults}
          inputHasChanged={inputHasChanged}
        />
        
        {/* Progress Bar - moved below search input/button */}
        {(quickSearchMutation.isPending || fullContactSearchMutation.isPending) && (
          <SearchProgress 
            phase={searchProgress.phase}
            completed={searchProgress.completed}
            total={searchProgress.total}
            isVisible={quickSearchMutation.isPending || fullContactSearchMutation.isPending}
          />
        )}
        
        {/* Search Progress Indicator */}
        <SearchProgressIndicator isSearching={isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending} />
      </div>
    </div>
  );
}