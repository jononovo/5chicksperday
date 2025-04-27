import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lion, Rabbit } from "lucide-react";
import { FaDonkey } from "react-icons/fa";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function WorkflowSearchTrigger() {
  const [query, setQuery] = useState("");
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Workflow providers
  const providers = [
    { id: "lion", name: "Lion", icon: <Lion className="h-4 w-4 mr-2" /> },
    { id: "rabbit", name: "Rabbit", icon: <Rabbit className="h-4 w-4 mr-2" /> },
    { id: "donkey", name: "Donkey", icon: <FaDonkey className="h-4 w-4 mr-2" /> }
  ];

  // Fetch available search strategies
  const { data: strategies, isLoading: strategiesLoading } = useQuery({
    queryKey: ["/api/search-approaches"],
    retry: 1,
  });

  // Mutation for initiating a search
  const searchMutation = useMutation({
    mutationFn: async (data: { query: string; strategyId: number; provider?: string }) => {
      return apiRequest("/api/workflow/search", {
        method: "POST",
        data,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Search initiated",
        description: `Search ID: ${data.searchId}. Results will be available soon.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
    onError: (error: any) => {
      toast({
        title: "Search failed",
        description: error?.message || "Failed to initiate search",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast({
        title: "Validation error",
        description: "Please enter a search query",
        variant: "destructive",
      });
      return;
    }

    if (!selectedStrategyId) {
      toast({
        title: "Validation error",
        description: "Please select a search strategy",
        variant: "destructive",
      });
      return;
    }

    searchMutation.mutate({
      query: query.trim(),
      strategyId: parseInt(selectedStrategyId, 10),
      provider: selectedProvider || undefined
    });
  };

  const handleProviderClick = (providerId: string) => {
    setSelectedProvider(providerId);
    
    toast({
      title: `${providerId.charAt(0).toUpperCase() + providerId.slice(1)} selected`,
      description: `Search will be processed by the ${providerId} workflow provider.`,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Workflow-Based Search</CardTitle>
        <CardDescription>
          Use external workflow automation to find companies and contacts
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="query">Search Query</Label>
            <Input
              id="query"
              placeholder="E.g., Software companies in San Francisco"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={searchMutation.isPending}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="strategy">Search Strategy</Label>
            <Select
              value={selectedStrategyId}
              onValueChange={setSelectedStrategyId}
              disabled={strategiesLoading || searchMutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a search strategy" />
              </SelectTrigger>
              <SelectContent>
                {strategiesLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading strategies...
                  </SelectItem>
                ) : (
                  strategies?.map((strategy: any) => (
                    <SelectItem key={strategy.id} value={strategy.id.toString()}>
                      {strategy.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="provider">Workflow Provider</Label>
            <div className="flex gap-2 mt-1">
              {providers.map((provider) => (
                <Button
                  key={provider.id}
                  type="button"
                  variant={selectedProvider === provider.id ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => handleProviderClick(provider.id)}
                  disabled={searchMutation.isPending}
                >
                  {provider.icon}
                  {provider.name}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedProvider 
                ? `Using ${selectedProvider} provider for this search` 
                : "Select a workflow provider (optional)"}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full"
            disabled={searchMutation.isPending}
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Initiating Search...
              </>
            ) : (
              "Start Search"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}