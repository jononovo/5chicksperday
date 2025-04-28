import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Define the config option type
export interface ConfigOption {
  id: string;
  label: string;
  description: string;
  defaultValue: boolean;
}

// Hard-coded options for specific search approaches
const APPROACH_OPTIONS: Record<number, ConfigOption[]> = {
  // Options for "Advanced Key Contact Discovery" (ID: 1)
  1: [
    {
      id: "excludeFranchises",
      label: "Exclude Franchises",
      description: "Filter out franchise businesses from the search results",
      defaultValue: false
    },
    {
      id: "highValue",
      label: "High-Value Mode",
      description: "Double-down on each option to improve ultimate outcome",
      defaultValue: false
    },
    {
      id: "triplePrompt",
      label: "Triple Prompt",
      description: "Makes 3 separate prompts to improve results and outcomes",
      defaultValue: false
    }
  ],
  // Options for "Standard Contact Search" (ID: 2)
  2: [
    {
      id: "focusOnSeniorRoles",
      label: "Focus on Senior Roles",
      description: "Prioritize finding contacts with senior/leadership positions",
      defaultValue: true
    },
    {
      id: "includePatternMatching",
      label: "Enhanced Pattern Matching",
      description: "Use advanced pattern matching to find more potential contact emails",
      defaultValue: false
    }
  ]
};

interface SearchApproachOptionsProps {
  approachId: number | null;
  onOptionsChange?: (options: Record<string, boolean>) => void;
}

export function SearchApproachOptions({ approachId, onOptionsChange }: SearchApproachOptionsProps) {
  const [optionStates, setOptionStates] = useState<Record<string, boolean>>({});
  
  // Load default options when the approach changes
  useEffect(() => {
    if (!approachId || !APPROACH_OPTIONS[approachId]) {
      setOptionStates({});
      if (onOptionsChange) onOptionsChange({});
      return;
    }
    
    // Initialize with default values
    const initialStates: Record<string, boolean> = {};
    APPROACH_OPTIONS[approachId].forEach(option => {
      initialStates[option.id] = option.defaultValue;
    });
    
    setOptionStates(initialStates);
    if (onOptionsChange) onOptionsChange(initialStates);
  }, [approachId, onOptionsChange]);
  
  // Handle toggle change
  const handleToggleChange = (id: string, checked: boolean) => {
    const updatedStates = { ...optionStates, [id]: checked };
    setOptionStates(updatedStates);
    if (onOptionsChange) onOptionsChange(updatedStates);
  };
  
  // If no approach is selected or no options available, don't render anything
  if (!approachId || !APPROACH_OPTIONS[approachId]) {
    return null;
  }
  
  // Get the options for this approach
  const options = APPROACH_OPTIONS[approachId];
  
  return (
    <Card className="mt-3 p-3">
      <h3 className="text-sm font-medium mb-2">Search Options</h3>
      <Separator className="mb-3" />
      <div className="space-y-3">
        {options.map((option) => (
          <div key={option.id} className="flex items-center space-x-2">
            <Switch 
              id={`option-${option.id}`} 
              checked={optionStates[option.id] || false}
              onCheckedChange={(checked) => handleToggleChange(option.id, checked)}
            />
            <div className="grid gap-0.5">
              <Label htmlFor={`option-${option.id}`} className="text-sm font-medium">
                {option.label}
              </Label>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}