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
import { SearchApproachOptions } from "@/components/search-approach-options";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  isAnalyzing: boolean;
  initialPrompt?: string;
}

export default function PromptEditor({ 
  onAnalyze, 
  onComplete, 
  onSearchResults, 
  isAnalyzing,
  initialPrompt = ""
}: PromptEditorProps) {
  const [query, setQuery] = useState(initialPrompt);
  const [searchOptions, setSearchOptions] = useState<Record<string, boolean>>({});
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
  const { selectedStrategyId, setSelectedStrategyId } = useSearchStrategy();
  
  // Fetch all search approaches for the dropdown
  const { data: searchApproaches = [] } = useQuery<SearchApproach[]>({
    queryKey: ["/api/search-approaches"],
    select: (data) => data
      .filter(approach => approach.active !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });
  
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
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Workflow Search Failed",
        description: error.message,
        variant: "destructive",
      });
      onComplete();
    },
  });

  // Original search mutation (standard search without workflow)
  const searchMutation = useMutation({
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

      // Find the selected strategy if one is selected
      const selectedStrategy = selectedStrategyId ? 
        searchFlows.find(flow => flow.id.toString() === selectedStrategyId) : null;
      
      console.log(`Searching with strategy: ${selectedStrategy?.name || "Default"} (ID: ${selectedStrategyId || "none"})`);
      console.log("Search options:", searchOptions);

      // Ensure proper typing for the search request
      const res = await apiRequest("POST", "/api/companies/search", { 
        query: searchQuery,
        flows: activeFlows,
        strategyId: selectedStrategyId ? parseInt(selectedStrategyId) : undefined,
        options: searchOptions // Include the search options
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      onSearchResults(data.query, data.companies);
      toast({
        title: "Search Complete",
        description: "Company analysis has been completed successfully.",
      });
      // Trigger confetti animation on successful search
      triggerConfetti();
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Search Failed",
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
    
    if (!selectedStrategyId) {
      toast({
        title: "No Search Approach Selected",
        description: "Please select a search approach before searching.",
        variant: "destructive",
      });
      return;
    }
    
    onAnalyze();
    searchMutation.mutate(query);
  };
  
  // Handle search approach selection
  const handleStrategyChange = (value: string) => {
    console.log(`Strategy changed to: ${value}`);
    setSelectedStrategyId(value);
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
        {/* Search input field */}
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a search query (e.g., 'mid-sized plumbers in Atlanta')..."
            className="flex-1"
          />
          <Button 
            onClick={handleSearch} 
            disabled={isAnalyzing || searchMutation.isPending || !selectedStrategyId}
          >
            {(isAnalyzing || searchMutation.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>
        
        {/* Search approach selector */}
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Select
              value={selectedStrategyId || undefined}
              onValueChange={handleStrategyChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a search approach" />
              </SelectTrigger>
              <SelectContent>
                {searchApproaches.map((approach) => (
                  <SelectItem key={approach.id} value={approach.id.toString()}>
                    {approach.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Search approach options */}
        {selectedStrategyId && (
          <SearchApproachOptions 
            approachId={parseInt(selectedStrategyId)} 
            onOptionsChange={setSearchOptions}
          />
        )}
        
        {/* Custom Workflow Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
          <div className="col-span-1 relative">
            <div className="flex items-center">
              <Input
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="Target URL"
                className="w-full pr-8"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6">
                      <HelpCircle className="h-4 w-4" />
                      <span className="sr-only">Target URL Info</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Enter the URL where search requests should be sent. This endpoint should accept a JSON payload with query and callbackUrl fields.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="col-span-1 relative">
            <div className="flex items-center">
              <Input
                value={resultsUrl}
                onChange={(e) => setResultsUrl(e.target.value)}
                placeholder="Results URL (optional)"
                className="w-full pr-8"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6">
                      <HelpCircle className="h-4 w-4" />
                      <span className="sr-only">Results URL Info</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Enter the URL where search results should be sent back. This is included in the payload as callbackUrl. If left empty, the default webhook endpoint will be used.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="col-span-1">
            <Button
              variant={customSelected ? 'default' : 'outline'}
              size="sm"
              className="flex items-center gap-1 w-full"
              onClick={handleCustomWorkflowSearch}
              disabled={isAnalyzing || workflowSearchMutation.isPending}
            >
              {(isAnalyzing || workflowSearchMutation.isPending && customSelected) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M12 18L12 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M4 12L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M18 12L20 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path 
                  d="M7 7L9 9M15 15L17 17M15 9L17 7M7 17L9 15" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round"/>
                <circle 
                  cx="12" 
                  cy="12" 
                  r="4" 
                  fill={customSelected ? 'currentColor' : 'none'} 
                  stroke="currentColor" 
                  strokeWidth="1.5"/>
              </svg>
              Custom
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}