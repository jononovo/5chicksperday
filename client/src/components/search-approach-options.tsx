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
  }, [approachId]);
  
  // If no approach is selected or no options available, don't render anything
  if (!approachId || !APPROACH_OPTIONS[approachId] || APPROACH_OPTIONS[approachId].length === 0) {
    return null;
  }
  
  // Get the options for this approach
  const options = APPROACH_OPTIONS[approachId];
  
  // Handle toggle change (simplified and more direct)
  const handleToggleChange = (id: string, checked: boolean) => {
    console.log(`Toggle changed for ${id}: ${checked}`);
    
    // Create a new state object
    const newState = { ...optionStates, [id]: checked };
    
    // Update local state
    setOptionStates(newState);
    
    // Notify parent component
    if (onOptionsChange) {
      onOptionsChange(newState);
    }
  };
  
  return (
    <Card className="mt-3 p-3">
      <h3 className="text-sm font-medium mb-2">Search Options</h3>
      <Separator className="mb-3" />
      <div className="space-y-3">
        {options.map((option) => (
          <div key={option.id} className="flex items-center space-x-2 cursor-pointer" 
               onClick={() => handleToggleChange(option.id, !optionStates[option.id])}>
            <Switch 
              id={`option-${option.id}`} 
              checked={!!optionStates[option.id]}
              onCheckedChange={(checked) => handleToggleChange(option.id, checked)}
            />
            <div className="grid gap-0.5">
              <Label 
                htmlFor={`option-${option.id}`} 
                className="text-sm font-medium cursor-pointer"
              >
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