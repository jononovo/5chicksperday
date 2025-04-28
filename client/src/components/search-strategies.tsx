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

// Strategies to display in the dropdown
const VALID_STRATEGIES = [
  "Advanced Key Contact Discovery",
  "Small Business Contacts",
  "Enhanced Contact Discovery",
  "Legacy Search (v1)",
  "Comprehensive Search"
];

// Modules that should NOT be shown as strategies
const EXCLUDED_MODULES = [
  "Company Overview",
  "Email Discovery",
  "Enrich Email",
  "Email Deepdive"
];

export function SearchStrategies({ onStrategyChange, defaultStrategy }: SearchStrategyProps) {
  // Use the defaultStrategy from props for local state
  const [selectedStrategy, setSelectedStrategy] = useState<string | undefined>(defaultStrategy);

  // Properly type the data and query
  const { data: strategies = [] } = useQuery<SearchApproach[], Error, SearchApproach[]>({
    queryKey: ["/api/search-approaches"],
    select: (data) => data
      .filter(s => s.active && VALID_STRATEGIES.includes(s.name) && !EXCLUDED_MODULES.includes(s.name))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });
  
  // Update local state when defaultStrategy changes (from parent context)
  useEffect(() => {
    if (defaultStrategy && defaultStrategy !== selectedStrategy) {
      setSelectedStrategy(defaultStrategy);
      console.log(`SearchStrategies: Updated from parent context to ${defaultStrategy}`);
    }
  }, [defaultStrategy, selectedStrategy]);
  
  // Initialize the strategy if needed - but ONLY if no strategy is selected at all
  useEffect(() => {
    // Only set a default if we have strategies loaded AND no strategy at all is selected
    // This should only happen on first load, not when changing strategies
    if (strategies.length > 0 && !selectedStrategy && !defaultStrategy) {
      // Find default strategy - Advanced Key Contact Discovery
      const advancedStrategy = strategies.find(s => s.name === "Advanced Key Contact Discovery");
      if (advancedStrategy) {
        const strategyId = advancedStrategy.id.toString();
        setSelectedStrategy(strategyId);
        onStrategyChange(strategyId);
        console.log(`Auto-selecting initial default strategy: ${advancedStrategy.name} (${strategyId})`);
      }
    }
  }, [strategies, selectedStrategy, defaultStrategy, onStrategyChange]);

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