import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import type { SearchApproach } from "@shared/schema";

interface SearchStrategyProps {
  onStrategyChange: (strategyId: string) => void;
  defaultStrategy?: string;
}

// Adding comments to explain the new approach
// We no longer need these hardcoded lists as we now use the isStrategy field
// from the database to distinguish between modules and strategies
//
// Keeping this comment for documentation of what previously existed
/*
Previous implementation used hardcoded lists:
VALID_STRATEGIES = [
  "Advanced Key Contact Discovery",
  "Small Business Contacts",
  "Enhanced Contact Discovery",
  "Legacy Search (v1)",
  "Comprehensive Search"
];
EXCLUDED_MODULES = [
  "Company Overview",
  "Email Discovery",
  "Enrich Email",
  "Email Deepdive"
];
*/

export function SearchStrategies({ onStrategyChange, defaultStrategy }: SearchStrategyProps) {
  // We'll use local state but initialized with defaultStrategy or "17" (Advanced Key Contact Discovery)
  const [selectedStrategy, setSelectedStrategy] = useState<string | undefined>(defaultStrategy || "17");

  // Properly type the data and query - now using isStrategy field
  const { data: strategies = [] } = useQuery<SearchApproach[], Error, SearchApproach[]>({
    queryKey: ["/api/search-approaches"],
    select: (data) => data
      .filter(s => s.active && s.isStrategy) // Only show active strategies using the database field
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });
  
  // Ensure the strategy ID is properly initialized when the component loads
  useEffect(() => {
    // If we have strategies loaded and our current ID is not in the list, 
    // find Advanced Key Contact Discovery
    if (strategies.length > 0) {
      if (!selectedStrategy || !strategies.some(s => s.id.toString() === selectedStrategy)) {
        const advancedStrategy = strategies.find(s => s.name === "Advanced Key Contact Discovery");
        if (advancedStrategy) {
          const strategyId = advancedStrategy.id.toString();
          setSelectedStrategy(strategyId);
          onStrategyChange(strategyId);
          console.log(`Auto-selecting default strategy: ${advancedStrategy.name} (${strategyId})`);
        }
      } else if (selectedStrategy) {
        // Make sure parent component has the current strategy ID
        onStrategyChange(selectedStrategy);
        console.log(`Using already selected strategy ID: ${selectedStrategy}`);
      }
    }
  }, [strategies, selectedStrategy, onStrategyChange]);

  const handleStrategyChange = (value: string) => {
    setSelectedStrategy(value);
    onStrategyChange(value);
  };

  if (!strategies?.length) return null;

  // Find the selected strategy object
  const selectedStrategyObj = strategies.find(s => s.id.toString() === selectedStrategy);

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">
            Search Strategy
          </label>
          <Select
            value={selectedStrategy}
            onValueChange={handleStrategyChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a search strategy" />
            </SelectTrigger>
            <SelectContent>
              {strategies.map((strategy) => (
                <SelectItem key={strategy.id} value={strategy.id.toString()}>
                  <div className="flex items-center gap-2">
                    {strategy.name}
                    {(strategy.config as any)?.validationStrategy === 'strict' && (
                      <Badge variant="secondary" className="ml-2">Strict</Badge>
                    )}
                    {strategy.name === "Advanced Key Contact Discovery" && (
                      <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 ml-2">Advanced</Badge>
                    )}
                    {strategy.name === "Enhanced Contact Discovery" && (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700 ml-2">Enhanced</Badge>
                    )}
                    {strategy.name === "Small Business Contacts" && (
                      <Badge variant="outline" className="ml-2">Standard</Badge>
                    )}
                    {strategy.name === "Legacy Search (v1)" && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-200 ml-2">Legacy</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <InfoIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">
                Choose different search strategies optimized for specific business types and roles.
                Each strategy uses a different configuration of our four core search modules:
                Company Overview → Email Discovery → Enrich Email → Email Deepdive.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {selectedStrategy && selectedStrategyObj && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            {selectedStrategyObj.prompt}
          </p>
          
          {/* Strategy-specific descriptions */}
          {selectedStrategyObj.name === "Advanced Key Contact Discovery" && (
            <p className="text-xs text-muted-foreground mt-1">
              Uses leadership-focused algorithms with role-based scoring multipliers to prioritize key decision makers. Features enhanced validation for founder and C-level executive identification.
            </p>
          )}
          
          {selectedStrategyObj.name === "Enhanced Contact Discovery" && (
            <p className="text-xs text-muted-foreground mt-1">
              Uses advanced name parsing, enhanced pattern prediction, and cross-reference validation to improve contact discovery accuracy.
            </p>
          )}
          
          {selectedStrategyObj.name === "Small Business Contacts" && (
            <p className="text-xs text-muted-foreground mt-1">
              Uses standard validation techniques to find contacts at small businesses with conventional email patterns.
            </p>
          )}
          
          {selectedStrategyObj.name === "Legacy Search (v1)" && (
            <p className="text-xs text-muted-foreground mt-1">
              Uses the original search algorithm with direct website extraction and simpler validation. May find contacts that newer methods miss.
            </p>
          )}
          
          <div className="flex flex-wrap gap-2 mt-2">
            {/* Show modules utilized */}
            <Badge variant="outline" className="text-xs bg-blue-50">
              Core Modules (4)
            </Badge>
            
            {/* Show validation type */}
            {((selectedStrategyObj.config as any)?.sequence?.validationStrategy) && (
              <Badge variant="outline" className="text-xs">
                {((selectedStrategyObj.config as any)?.sequence?.validationStrategy)} validation
              </Badge>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default SearchStrategies;