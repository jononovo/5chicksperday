import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function WorkflowSearchTrigger() {
  const [query, setQuery] = useState("");
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch available search strategies
  const { data: strategies, isLoading: strategiesLoading } = useQuery({
    queryKey: ["/api/search-approaches"],
    retry: 1,
  });

  // Mutation for initiating a search
  const searchMutation = useMutation({
    mutationFn: async (data: { query: string; strategyId: number }) => {
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