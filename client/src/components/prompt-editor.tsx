import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Cat, Rabbit, Anchor } from "lucide-react";
import type { SearchModuleConfig } from "@shared/schema";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      // Get active flows and their configurations
      const activeFlows = searchFlows
        .filter((flow) => flow.active)
        .map((flow) => ({
          id: flow.id,
          name: flow.name,
          moduleType: flow.moduleType,
          config: flow.config,
          completedSearches: flow.completedSearches || []
        }));

      // Ensure proper typing for the search request
      const res = await apiRequest("POST", "/api/companies/search", { 
        query: searchQuery,
        flows: activeFlows
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

  // Create mutations for external search providers
  const lionSearchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const res = await apiRequest("POST", "/api/external-provider/lion", { query: searchQuery });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lead-Gen Lion Search Started",
        description: `Search request sent. Results will be processed when available.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lion Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rabbitSearchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const res = await apiRequest("POST", "/api/external-provider/rabbit", { query: searchQuery });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lead-Gen Rabbit Search Started",
        description: `Search request sent. Results will be processed when available.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rabbit Search Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const donkeySearchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const res = await apiRequest("POST", "/api/external-provider/donkey", { query: searchQuery });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lead-Gen Donkey Search Started",
        description: `Search request sent. Results will be processed when available.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Donkey Search Failed",
        description: error.message,
        variant: "destructive",
      });
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
    searchMutation.mutate(query);
  };

  const handleLionSearch = () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a search query.",
        variant: "destructive",
      });
      return;
    }
    lionSearchMutation.mutate(query);
  };

  const handleRabbitSearch = () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a search query.",
        variant: "destructive",
      });
      return;
    }
    rabbitSearchMutation.mutate(query);
  };

  const handleDonkeySearch = () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a search query.",
        variant: "destructive",
      });
      return;
    }
    donkeySearchMutation.mutate(query);
  };

  return (
    <Card className="p-3">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a search query (e.g., 'mid-sized plumbers in Atlanta')..."
            className="flex-1"
          />
          <Button 
            onClick={handleSearch} 
            disabled={isAnalyzing || searchMutation.isPending}
          >
            {(isAnalyzing || searchMutation.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleLionSearch} 
            disabled={lionSearchMutation.isPending}
          >
            {lionSearchMutation.isPending && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            <Cat className="mr-1 h-3 w-3" />
            Lion
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRabbitSearch} 
            disabled={rabbitSearchMutation.isPending}
          >
            {rabbitSearchMutation.isPending && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            <Rabbit className="mr-1 h-3 w-3" />
            Rabbit
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDonkeySearch} 
            disabled={donkeySearchMutation.isPending}
          >
            {donkeySearchMutation.isPending && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            <Anchor className="mr-1 h-3 w-3" />
            Donkey
          </Button>
        </div>
      </div>
    </Card>
  );
}