import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import type { SearchApproach, SearchModuleConfig } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Save, X, InfoIcon, AlertCircle, Mail } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import SearchStrategies from "./search-strategies";

// Fixed approach order mapping
const APPROACH_ORDER = {
  'company_overview': 1,
  'decision_maker': 2,
  'email_discovery': 3,
  'email_enrichment': 4,
  'email_deepdive': 5
};

interface SearchFlowNewProps {
  approaches: SearchApproach[];
}

function ApproachEditor({ approach }: { approach: SearchApproach }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(approach.prompt);
  const [editedTechnicalPrompt, setEditedTechnicalPrompt] = useState(
    approach.technicalPrompt || ""
  );
  const [editedResponseStructure, setEditedResponseStructure] = useState(
    approach.responseStructure || ""
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const config = approach.config as SearchModuleConfig || {
    subsearches: {},
    searchOptions: {},
    searchSections: {},
    validationRules: {
      requiredFields: [],
      scoreThresholds: {},
      minimumConfidence: 0,
    },
  };

  const toggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const response = await apiRequest(
        "PATCH",
        `/api/search-approaches/${approach.id}`,
        {
          active,
          config: approach.config,
        }
      );
      if (!response.ok) {
        throw new Error("Failed to toggle approach");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search-approaches"] });
      toast({
        title: approach.active ? "Approach Disabled" : "Approach Enabled",
        description: approach.moduleType === 'email_enrichment'
          ? `Email enrichment ${approach.active ? 'disabled' : 'enabled'}. ${!approach.active ? 'Top prospects will be automatically enriched after search.' : ''}`
          : `Search approach has been ${approach.active ? "disabled" : "enabled"}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Toggle Failed",
        description: error instanceof Error ? error.message : "Failed to toggle approach",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<SearchApproach>) => {
      if (!editedPrompt.trim()) {
        throw new Error("Prompt cannot be empty");
      }

      if (editedPrompt.length < 10) {
        throw new Error("Prompt must be at least 10 characters long");
      }

      const response = await apiRequest(
        "PATCH",
        `/api/search-approaches/${approach.id}`,
        updates
      );
      if (!response.ok) {
        throw new Error("Failed to update approach");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search-approaches"] });
      setIsEditing(false);
      setValidationError(null);
      toast({
        title: "Approach Updated",
        description: "Search approach updated successfully.",
      });
    },
    onError: (error) => {
      setValidationError(error instanceof Error ? error.message : "Failed to update approach");
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update approach",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      prompt: editedPrompt,
      technicalPrompt: editedTechnicalPrompt || null,
      responseStructure: editedResponseStructure || null,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedPrompt(approach.prompt);
    setEditedTechnicalPrompt(approach.technicalPrompt || "");
    setEditedResponseStructure(approach.responseStructure || "");
    setValidationError(null);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return "bg-emerald-500";
    if (confidence >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 85) return "High Confidence";
    if (confidence >= 70) return "Medium Confidence";
    return "Low Confidence";
  };

  // Fix the isCompleted check by providing a default empty array if completedSearches is null
  const isCompleted = approach.completedSearches && approach.moduleType ? 
    approach.completedSearches.includes(approach.moduleType) : 
    false;

  const minimumConfidence = config.validationRules?.minimumConfidence || 0;

  const isEmailEnrichment = approach.moduleType === 'email_enrichment';

  return (
    <AccordionItem value={approach.id.toString()} className={`border-b transition-colors duration-200 ${approach.active ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}>
      <div className="flex items-center gap-4 px-4 py-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`approach-${approach.id}`}
                  checked={approach.active ?? false}
                  onCheckedChange={(checked) => toggleMutation.mutate(checked as boolean)}
                  disabled={toggleMutation.isPending}
                  className={cn(
                    "transition-colors duration-200",
                    isCompleted && approach.active && "data-[state=checked]:bg-emerald-500 data-[state=checked]:text-emerald-50 dark:data-[state=checked]:bg-emerald-500"
                  )}
                />
                {isEmailEnrichment && approach.active && (
                  <Mail className="h-4 w-4 ml-2" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isCompleted
                ? "Search completed"
                : isEmailEnrichment
                  ? approach.active
                    ? "Email enrichment enabled - will process top prospects after search"
                    : "Enable email enrichment for top prospects"
                  : approach.active
                    ? "Disable approach"
                    : "Enable approach"
              }
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex-1">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-medium text-base">{approach.name}</span>
          </AccordionTrigger>
        </div>
      </div>

      <AccordionContent className="px-4 py-2">
        {validationError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {/* Confidence Threshold Section */}
        {minimumConfidence > 0 && (
          <div className="mb-4 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Confidence Threshold</h4>
            <div className="flex items-center gap-2">
              <div className="flex-1 max-w-[200px]">
                <Progress
                  value={minimumConfidence}
                  className={`h-2 ${getConfidenceColor(minimumConfidence)}`}
                />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">
                        {minimumConfidence}%
                      </span>
                      <InfoIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">
                      {getConfidenceLabel(minimumConfidence)}: Requires {minimumConfidence}%
                      confidence in search results
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Results below this confidence threshold will be filtered out
            </p>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                User-Facing Prompt
              </label>
              <Textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                placeholder="Enter the user-facing prompt..."
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use [COMPANY] as a placeholder for the target company name
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Technical Implementation
              </label>
              <Textarea
                value={editedTechnicalPrompt}
                onChange={(e) => setEditedTechnicalPrompt(e.target.value)}
                placeholder="Enter the technical implementation details..."
                className="min-h-[100px] font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Response Structure
              </label>
              <Textarea
                value={editedResponseStructure}
                onChange={(e) => setEditedResponseStructure(e.target.value)}
                placeholder="Enter the expected JSON response structure..."
                className="min-h-[100px] font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending || !editedPrompt.trim()}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Description</h4>
              <p className="text-sm text-muted-foreground">{approach.prompt}</p>
            </div>

            {approach.technicalPrompt && (
              <div className="space-y-2">
                <h4 className="font-medium">Technical Details</h4>
                <p className="text-sm text-muted-foreground font-mono">
                  {approach.technicalPrompt}
                </p>
              </div>
            )}

            {approach.responseStructure && (
              <div className="space-y-2">
                <h4 className="font-medium">Expected Response</h4>
                <pre className="text-sm bg-muted p-2 rounded-md font-mono">
                  {approach.responseStructure}
                </pre>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit Approach
            </Button>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

import { useSearchStrategy } from "@/lib/search-strategy-context";

export default function SearchFlowNew({ approaches }: SearchFlowNewProps) {
  // Use the global strategy context
  const { selectedStrategyId, setSelectedStrategyId } = useSearchStrategy();
  const [localSelectedStrategy, setLocalSelectedStrategy] = useState<string>();

  // Sort approaches by fixed order
  const sortedApproaches = [...approaches].sort((a, b) => {
    const orderA = APPROACH_ORDER[a.moduleType as keyof typeof APPROACH_ORDER] || 999;
    const orderB = APPROACH_ORDER[b.moduleType as keyof typeof APPROACH_ORDER] || 999;
    return orderA - orderB;
  });

  // Find default strategy (company_overview type)
  const defaultStrategy = approaches.find(a => 
    a.name === "Advanced Key Contact Discovery" || 
    a.moduleType === 'company_overview')?.id.toString() || approaches[0]?.id.toString();

  // Only set a default strategy if none is selected, and only sync local state with global
  useEffect(() => {
    // Only set the default on first mount when absolutely no strategy is selected
    if (!selectedStrategyId && !localSelectedStrategy && defaultStrategy) {
      // This should only happen on first page load
      setSelectedStrategyId(defaultStrategy);
      setLocalSelectedStrategy(defaultStrategy);
      console.log(`SearchFlowNew: Setting initial default strategy to ${defaultStrategy}`);
    } else if (selectedStrategyId && selectedStrategyId !== localSelectedStrategy) {
      // Update local state if global state changed (from the dropdown elsewhere)
      // This ensures the dropdown shows the correct value
      setLocalSelectedStrategy(selectedStrategyId || undefined);
      console.log(`SearchFlowNew: Syncing with global context, strategy is now ${selectedStrategyId}`);
    }
  }, [defaultStrategy, selectedStrategyId, localSelectedStrategy, setSelectedStrategyId]);

  const handleStrategyChange = (strategyId: string) => {
    setLocalSelectedStrategy(strategyId);
    setSelectedStrategyId(strategyId); // Update the global context
    console.log(`Strategy changed to: ${strategyId}`);
  };

  return (
    <div className="space-y-4">
      <SearchStrategies
        onStrategyChange={handleStrategyChange}
        defaultStrategy={selectedStrategyId || defaultStrategy}
      />
      <Accordion type="single" collapsible className="w-full">
        {sortedApproaches.map((approach) => (
            <ApproachEditor key={approach.id} approach={approach} />
        ))}
      </Accordion>
    </div>
  );
}