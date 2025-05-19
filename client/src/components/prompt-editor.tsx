import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, HelpCircle } from "lucide-react";
import type { SearchModuleConfig, SearchApproach } from "@shared/schema";
import { useConfetti } from "@/hooks/use-confetti";
import { useSearchStrategy } from "@/lib/search-strategy-context";
import SearchSettingsDrawer from "./search-settings-drawer";
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
}

export default function PromptEditor({ 
  onAnalyze, 
  onComplete, 
  onSearchResults, 
  onCompaniesReceived,
  isAnalyzing,
  initialPrompt = ""
}: PromptEditorProps) {
  const [query, setQuery] = useState(initialPrompt);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { triggerConfetti } = useConfetti();

  // Fetch active search flows with proper typing
  const { data: searchFlows = [] } = useQuery<Array<{
    id: number;
    name: string;
    active: boolean;
    config: SearchModuleConfig;
    completedSearches: string[];
    moduleType: string;
  }>>({
    queryKey: ["/api/search-approaches"],
  });

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
      // Use the standard search but optimize for quick company results
      const activeFlows = searchFlows
        .filter((flow) => flow.active)
        .map((flow) => ({
          id: flow.id,
          name: flow.name,
          moduleType: flow.moduleType,
          config: flow.config,
          completedSearches: flow.completedSearches || []
        }));

      // Find the selected strategy if one is selected
      const selectedStrategy = selectedStrategyId ? 
        searchFlows.find(flow => flow.id.toString() === selectedStrategyId) : null;
      
      console.log(`Quick search with strategy: ${selectedStrategy?.name || "Default"} (ID: ${selectedStrategyId || "none"})`);

      // Get companies quickly without waiting for contact enrichment
      const res = await apiRequest("POST", "/api/companies/quick-search", { 
        query: searchQuery,
        flows: activeFlows,
        strategyId: selectedStrategyId ? parseInt(selectedStrategyId) : undefined
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      
      // Pass companies immediately to the parent component
      console.log("Quick search found companies:", data.companies.length);
      onCompaniesReceived(data.query, data.companies);
      
      toast({
        title: "Companies Found",
        description: `Found ${data.companies.length} companies. Loading contacts...`,
      });
      
      // Start the full search with contacts
      fullContactSearchMutation.mutate(data.query);
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
      // Use the standard search
      const activeFlows = searchFlows
        .filter((flow) => flow.active)
        .map((flow) => ({
          id: flow.id,
          name: flow.name,
          moduleType: flow.moduleType,
          config: flow.config,
          completedSearches: flow.completedSearches || []
        }));

      // Ensure proper typing for the full search request with contacts
      const res = await apiRequest("POST", "/api/companies/search", { 
        query: searchQuery,
        flows: activeFlows,
        strategyId: selectedStrategyId ? parseInt(selectedStrategyId) : undefined,
        includeContacts: true
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Send full results with contacts to parent component
      onSearchResults(data.query, data.companies);
      
      toast({
        title: "Search Complete",
        description: "Contact discovery has been completed successfully.",
      });
      
      // Trigger confetti animation on successful search
      triggerConfetti();
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
    onAnalyze();
    // Use quickSearchMutation to first get companies without waiting for contact enrichment
    quickSearchMutation.mutate(query);
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
    <Card className="p-3">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !(isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending)) {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="Enter a search query (e.g., 'mid-sized plumbers in Atlanta')..."
            className="flex-1"
          />
          <div className="flex items-center">
            <Button 
              onClick={handleSearch} 
              disabled={isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending}
            >
              {(isAnalyzing || quickSearchMutation.isPending || fullContactSearchMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            
            {/* Settings drawer trigger with custom search props */}
            <SearchSettingsDrawer 
              approaches={searchFlows as SearchApproach[]} 
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
      </div>
    </Card>
  );
}