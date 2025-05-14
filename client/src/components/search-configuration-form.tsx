import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PlusCircle, XCircle, ArrowLeft, ArrowRight, Check, X, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { cn } from "@/lib/utils";

// WorkflowStep component for the progress indicator
function WorkflowStep({ 
  label, 
  step, 
  isActive, 
  isCompleted, 
  onClick 
}: { 
  label: string; 
  step: number; 
  isActive: boolean; 
  isCompleted: boolean; 
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center z-10">
      <button 
        type="button"
        onClick={onClick}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200 shadow-sm",
          isActive ? "bg-blue-500 text-white border-blue-500 scale-110" : 
          isCompleted ? "bg-blue-100 border-blue-400 text-blue-700" : 
          "bg-white border-gray-300 text-gray-500 hover:border-blue-300 hover:bg-gray-50"
        )}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-6 w-6" />
        ) : (
          <span className="text-sm font-semibold">{step}</span>
        )}
      </button>
      <span className={cn(
        "mt-2 text-sm font-medium",
        isActive ? "text-blue-700" : 
        isCompleted ? "text-blue-600" : 
        "text-gray-500"
      )}>
        {label}
      </span>
    </div>
  );
}

// Helper function for priority badge styling
function getPriorityBadgeClass(priority: string | number) {
  if (typeof priority === 'number') {
    // Convert numeric priority to string representation
    if (priority >= 8) return 'bg-red-100 text-red-800';
    if (priority >= 5) return 'bg-amber-100 text-amber-800';
    return 'bg-blue-100 text-blue-800';
  }
  
  switch(priority) {
    case 'high': return 'bg-red-100 text-red-800';
    case 'medium': return 'bg-amber-100 text-amber-800';
    case 'low': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

// Helper function to convert number priority to label
function getPriorityLabel(priority: number) {
  if (priority >= 8) return 'high';
  if (priority >= 5) return 'medium';
  return 'low';
}

// Card Button Component for Approach Selection
interface CardButtonProps {
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function CardButton({ isSelected, onClick, icon, title, description }: CardButtonProps) {
  return (
    <div 
      className={`relative rounded-lg border-2 p-5 cursor-pointer transition-all duration-300 w-full ${
        isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]' 
          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 hover:shadow-sm'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-full ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className={`font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {isSelected && (
        <div className="absolute top-3 right-3">
          <div className="bg-blue-500 text-white rounded-full p-1">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
      )}
    </div>
  );
}

// Types are imported from your config page or could be defined here
interface SearchConfigFormProps {
  form: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function SearchConfigurationForm({ form, onSubmit, onCancel, isSubmitting }: SearchConfigFormProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "company" | "contact" | "email">("basic");
  const [stepValue, setStepValue] = useState(1);
  
  // Map tabs to step numbers for the workflow indicator
  const tabToStep: Record<string, number> = {
    basic: 1,
    company: 2,
    contact: 3,
    email: 4
  };
  
  // Update step value when tab changes
  useEffect(() => {
    setStepValue(tabToStep[activeTab]);
  }, [activeTab]);

  // Field arrays for dynamic lists
  const companyCustomParams = useFieldArray({
    control: form.control,
    name: "companyConfig.customParameters"
  });

  const companyPromptAdditions = useFieldArray({
    control: form.control,
    name: "companyConfig.promptAdditions"
  });

  const companyScoringRules = useFieldArray({
    control: form.control,
    name: "companyConfig.scoringRules"
  });

  const contactCustomParams = useFieldArray({
    control: form.control,
    name: "contactConfig.customParameters"
  });

  const contactPromptAdditions = useFieldArray({
    control: form.control,
    name: "contactConfig.promptAdditions"
  });

  const contactScoringRules = useFieldArray({
    control: form.control,
    name: "contactConfig.scoringRules"
  });

  const emailCustomParams = useFieldArray({
    control: form.control,
    name: "emailConfig.customParameters"
  });

  const emailPromptAdditions = useFieldArray({
    control: form.control,
    name: "emailConfig.promptAdditions"
  });

  const emailScoringRules = useFieldArray({
    control: form.control,
    name: "emailConfig.scoringRules"
  });

  // Navigation handlers
  const goToNext = () => {
    if (activeTab === "basic") setActiveTab("company");
    else if (activeTab === "company") setActiveTab("contact");
    else if (activeTab === "contact") setActiveTab("email");
  };

  const goToPrevious = () => {
    if (activeTab === "email") setActiveTab("contact");
    else if (activeTab === "contact") setActiveTab("company");
    else if (activeTab === "company") setActiveTab("basic");
  };

  // Helper functions for dynamic form elements
  const addCompanyPrompt = () => {
    companyPromptAdditions.append("");
  };

  const addCompanyParameter = () => {
    companyCustomParams.append({
      name: "",
      description: "",
      value: "",
      priority: 5
    });
  };

  const addCompanyScoringRule = () => {
    companyScoringRules.append({
      parameter: "",
      condition: "equals",
      value: "",
      score: 50
    });
  };

  const addContactPrompt = () => {
    contactPromptAdditions.append("");
  };

  const addContactParameter = () => {
    contactCustomParams.append({
      name: "",
      description: "",
      value: "",
      priority: 5
    });
  };

  const addContactScoringRule = () => {
    contactScoringRules.append({
      parameter: "",
      condition: "equals",
      value: "",
      score: 50
    });
  };

  const addEmailPrompt = () => {
    emailPromptAdditions.append("");
  };

  const addEmailParameter = () => {
    emailCustomParams.append({
      name: "",
      description: "",
      value: "",
      priority: 5
    });
  };

  const addEmailScoringRule = () => {
    emailScoringRules.append({
      parameter: "",
      condition: "equals",
      value: "",
      score: 50
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">Search Configuration Workflow</h2>
            <div className="text-sm text-muted-foreground">Step {tabToStep[activeTab]} of 4</div>
          </div>
          
          {/* Enhanced Workflow Progress Indicator */}
          <div className="relative mt-8 mb-10">
            <div className="absolute top-[22px] left-[10%] right-[10%] h-1 bg-gray-200 -translate-y-1/2 z-0" />
            <div className="absolute top-[22px] left-[10%] right-[calc(90%_-_((stepValue-1)/3_*_80%))] h-1 bg-blue-400 -translate-y-1/2 z-0" 
                 style={{ right: `calc(90% - ${((stepValue-1)/3) * 80}%)` }} />
            <div className="relative flex justify-between">
              <WorkflowStep 
                label="Basic Info" 
                step={1} 
                isActive={activeTab === 'basic'} 
                isCompleted={stepValue > 1} 
                onClick={() => setActiveTab('basic')} 
              />
              <WorkflowStep 
                label="Company Search" 
                step={2} 
                isActive={activeTab === 'company'} 
                isCompleted={stepValue > 2} 
                onClick={() => setActiveTab('company')} 
              />
              <WorkflowStep 
                label="Contact Search" 
                step={3} 
                isActive={activeTab === 'contact'} 
                isCompleted={stepValue > 3} 
                onClick={() => setActiveTab('contact')} 
              />
              <WorkflowStep 
                label="Email Discovery" 
                step={4} 
                isActive={activeTab === 'email'} 
                isCompleted={stepValue > 4} 
                onClick={() => setActiveTab('email')} 
              />
            </div>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="hidden">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="company">Company Search</TabsTrigger>
            <TabsTrigger value="contact">Contact Search</TabsTrigger>
            <TabsTrigger value="email">Email Discovery</TabsTrigger>
          </TabsList>
          
          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Configuration</CardTitle>
                <CardDescription>
                  Enter the basic information for your search configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Configuration Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Default Search Profile" {...field} />
                      </FormControl>
                      <FormDescription>
                        A unique name to identify this search configuration
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe what this configuration is optimized for..." 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional description to help understand the purpose of this configuration
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="order"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Order</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                            value={field.value || 1}
                          />
                        </FormControl>
                        <FormDescription>
                          Order of appearance in lists
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="validationStrategy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Validation Strategy</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select validation strategy" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="strict">Strict</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="lenient">Lenient</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How strictly to validate search results
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-x-2 space-y-0 rounded-md border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Activate Configuration</FormLabel>
                        <FormDescription>
                          Enable this setting to make the configuration available for searches
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" type="button" onClick={onCancel}>
                  Cancel
                </Button>
                <Button type="button" onClick={goToNext}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* Company Search Tab */}
          <TabsContent value="company" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Company Search Configuration</CardTitle>
                <CardDescription>
                  Configure how company information is searched and validated
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div>
                    <FormLabel className="text-base font-medium">Core Search Approach</FormLabel>
                    <FormDescription>
                      Select the primary method used for company discovery
                    </FormDescription>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 mt-2">
                    <FormField
                      control={form.control}
                      name="companyConfig.coreApproach"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <div className="space-y-2">
                              <CardButton
                                isSelected={field.value === "single"}
                                onClick={() => field.onChange("single")}
                                icon={<div className="bg-blue-100 text-blue-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">S</span></div>}
                                title="Single"
                                description="Basic search with a single data source"
                              />
                              
                              <CardButton
                                isSelected={field.value === "double"}
                                onClick={() => field.onChange("double")}
                                icon={<div className="bg-green-100 text-green-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">D</span></div>}
                                title="Double"
                                description="Enhanced search with two data sources"
                              />
                              
                              <CardButton
                                isSelected={field.value === "triple"}
                                onClick={() => field.onChange("triple")}
                                icon={<div className="bg-purple-100 text-purple-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">T</span></div>}
                                title="Triple"
                                description="Comprehensive search with three data sources"
                              />
                              
                              <CardButton
                                isSelected={field.value === "perplexity"}
                                onClick={() => field.onChange("perplexity")}
                                icon={<div className="bg-amber-100 text-amber-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">P</span></div>}
                                title="Perplexity Search"
                                description="Advanced AI-powered search with deep context understanding"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Prompt Additions */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Prompt Additions</Label>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="ghost" 
                      onClick={addCompanyPrompt}
                    >
                      <PlusCircle className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {companyPromptAdditions.fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-start">
                        <FormField
                          control={form.control}
                          name={`companyConfig.promptAdditions.${index}`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input placeholder="e.g. Exclude Franchises" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => companyPromptAdditions.remove(index)}
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    
                    {companyPromptAdditions.fields.length === 0 && (
                      <div className="text-sm text-muted-foreground italic">
                        No prompt additions added yet. Click "Add" to include special instructions.
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Custom Parameters */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-medium">Custom Search Parameters</Label>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline"
                      onClick={addCompanyParameter}
                    >
                      <PlusCircle className="h-4 w-4 mr-1" /> Add Parameter
                    </Button>
                  </div>
                  
                  {/* Parameter Suggestions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    <div 
                      className="rounded-lg border p-3 hover:border-primary/50 hover:bg-gray-50 cursor-pointer transition-all"
                      onClick={() => companyCustomParams.append({
                        name: "company_size",
                        description: "Number of employees in the company",
                        value: "Number",
                        priority: 8
                      })}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-sm">Company Size</h4>
                          <p className="text-xs text-muted-foreground mt-1">Number of employees</p>
                        </div>
                        <Badge className={getPriorityBadgeClass('high')}>High Priority</Badge>
                      </div>
                    </div>
                    
                    <div 
                      className="rounded-lg border p-3 hover:border-primary/50 hover:bg-gray-50 cursor-pointer transition-all"
                      onClick={() => companyCustomParams.append({
                        name: "industry",
                        description: "Industry sector of the company",
                        value: "String",
                        priority: 8
                      })}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-sm">Industry</h4>
                          <p className="text-xs text-muted-foreground mt-1">Industry sector</p>
                        </div>
                        <Badge className={getPriorityBadgeClass('high')}>High Priority</Badge>
                      </div>
                    </div>
                    
                    <div 
                      className="rounded-lg border p-3 hover:border-primary/50 hover:bg-gray-50 cursor-pointer transition-all"
                      onClick={() => companyCustomParams.append({
                        name: "founded_year",
                        description: "Year the company was founded",
                        value: "Number",
                        priority: 5
                      })}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-sm">Founded Year</h4>
                          <p className="text-xs text-muted-foreground mt-1">Company establishment year</p>
                        </div>
                        <Badge className={getPriorityBadgeClass('medium')}>Medium Priority</Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* Improved Parameter Builder */}
                  <div className="space-y-4">
                    <div className="grid gap-3 mb-4">
                      {companyCustomParams.fields.length > 0 ? (
                        companyCustomParams.fields.map((field, index) => (
                          <div key={field.id} className="flex items-center gap-2 p-3 rounded-lg border group hover:border-blue-200 bg-gray-50">
                            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div>
                                <p className="text-xs text-gray-500">Parameter</p>
                                <FormField
                                  control={form.control}
                                  name={`companyConfig.customParameters.${index}.name`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-0 mt-1">
                                      <FormControl>
                                        <Input 
                                          className="h-7 p-1 text-sm border-0 bg-transparent hover:bg-gray-100 focus:bg-white focus:border"
                                          placeholder="e.g. company_size" 
                                          {...field}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Value Type</p>
                                <FormField
                                  control={form.control}
                                  name={`companyConfig.customParameters.${index}.value`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-0 mt-1">
                                      <FormControl>
                                        <Input 
                                          className="h-7 p-1 text-sm border-0 bg-transparent hover:bg-gray-100 focus:bg-white focus:border"
                                          placeholder="e.g. Number" 
                                          {...field}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Priority</p>
                                <FormField
                                  control={form.control}
                                  name={`companyConfig.customParameters.${index}.priority`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-0 mt-1">
                                      <FormControl>
                                        <Select 
                                          onValueChange={(value) => field.onChange(parseInt(value))}
                                          value={String(field.value || 5)}
                                        >
                                          <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-gray-100 focus:bg-white focus:border">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getPriorityBadgeClass(field.value || 5)}`}>
                                              {getPriorityLabel(field.value || 5)}
                                            </span>
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="10">High (10)</SelectItem>
                                            <SelectItem value="8">High (8)</SelectItem>
                                            <SelectItem value="5">Medium (5)</SelectItem>
                                            <SelectItem value="3">Low (3)</SelectItem>
                                            <SelectItem value="1">Low (1)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <div className="hidden sm:block">
                                <p className="text-xs text-gray-500">Description</p>
                                <FormField
                                  control={form.control}
                                  name={`companyConfig.customParameters.${index}.description`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-0 mt-1">
                                      <FormControl>
                                        <Input 
                                          className="h-7 p-1 text-sm border-0 bg-transparent hover:bg-gray-100 focus:bg-white focus:border"
                                          placeholder="What this parameter means" 
                                          {...field}
                                          value={field.value || ''}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="opacity-0 group-hover:opacity-100"
                              onClick={() => companyCustomParams.remove(index)}
                            >
                              <X size={16} className="text-red-500" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center p-4 bg-gray-50 border border-dashed rounded-lg text-gray-500">
                          No parameters added yet. Add your first parameter below.
                        </div>
                      )}
                    </div>


                  </div>
                </div>
                
                {/* Secondary Search Options */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-medium">Secondary Search Technologies</Label>
                    <div className="text-sm text-muted-foreground">
                      Select one or more options to enhance search results
                    </div>
                  </div>
                  
                  <div className="space-y-2 border rounded-lg p-3">
                    <FormField
                      control={form.control}
                      name="companyConfig.secondarySearch.fireCrawlStandard"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-x-2 space-y-0 p-2 hover:bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="font-medium text-sm cursor-pointer">
                                FireCrawl Standard
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Standard web crawling for company information
                              </FormDescription>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="companyConfig.secondarySearch.fireCrawlExtract"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-x-2 space-y-0 p-2 hover:bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="font-medium text-sm cursor-pointer">
                                FireCrawl Extract
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Advanced data extraction from company websites
                              </FormDescription>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="companyConfig.secondarySearch.serpApi"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-x-2 space-y-0 p-2 hover:bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="font-medium text-sm cursor-pointer">
                                Serp API
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Search engine results for company details
                              </FormDescription>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="companyConfig.secondarySearch.googleMyBusiness"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-x-2 space-y-0 p-2 hover:bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="font-medium text-sm cursor-pointer">
                                Google My Business
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Official business listings from Google
                              </FormDescription>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Scoring Rules */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-medium">Scoring Rules</Label>
                    <div className="text-sm text-muted-foreground">
                      Rules help rank and prioritize search results
                    </div>
                  </div>
                  
                  {/* Improved Scoring Rules Builder */}
                  <div className="space-y-4">
                    <div className="bg-card rounded-lg border">
                      {companyScoringRules.fields.length > 0 ? (
                        <div>
                          <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-muted rounded-t-lg border-b text-xs font-medium">
                            <div className="col-span-2">Parameter</div>
                            <div className="col-span-1">Condition</div>
                            <div className="col-span-1">Value</div>
                            <div className="col-span-1">Score</div>
                            <div className="col-span-1 text-right">Actions</div>
                          </div>
                          
                          <div className="divide-y">
                            {companyScoringRules.fields.map((field, index) => {
                              const score = form.watch(`companyConfig.scoringRules.${index}.score`) || 50;
                              const scoreColor = 
                                score >= 80 ? "bg-green-100 text-green-800" : 
                                score >= 50 ? "bg-blue-100 text-blue-800" : 
                                score >= 30 ? "bg-amber-100 text-amber-800" :
                                "bg-red-100 text-red-800";
                              
                              return (
                                <div key={field.id} className="px-4 py-3 flex items-center hover:bg-gray-50">
                                  <div className="grid grid-cols-6 gap-2 w-full">
                                    <div className="col-span-2">
                                      <FormField
                                        control={form.control}
                                        name={`companyConfig.scoringRules.${index}.parameter`}
                                        render={({ field }) => (
                                          <FormItem className="space-y-0 mb-1">
                                            <FormControl>
                                              <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                              >
                                                <SelectTrigger className="h-8 text-sm">
                                                  <SelectValue placeholder="Select parameter" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectGroup>
                                                    <SelectLabel>Custom Parameters</SelectLabel>
                                                    {companyCustomParams.fields.map((param, i) => (
                                                      <SelectItem 
                                                        key={param.id} 
                                                        value={form.watch(`companyConfig.customParameters.${i}.name`) || `param_${i}`}
                                                      >
                                                        {form.watch(`companyConfig.customParameters.${i}.name`) || `Parameter #${i+1}`}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectGroup>
                                                  <SelectGroup>
                                                    <SelectLabel>Core Parameters</SelectLabel>
                                                    <SelectItem value="company_size">company_size</SelectItem>
                                                    <SelectItem value="industry">industry</SelectItem>
                                                    <SelectItem value="revenue">revenue</SelectItem>
                                                    <SelectItem value="location">location</SelectItem>
                                                    <SelectItem value="tech_stack">tech_stack</SelectItem>
                                                  </SelectGroup>
                                                </SelectContent>
                                              </Select>
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    
                                    <div className="col-span-1">
                                      <FormField
                                        control={form.control}
                                        name={`companyConfig.scoringRules.${index}.condition`}
                                        render={({ field }) => (
                                          <FormItem className="space-y-0">
                                            <FormControl>
                                              <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                              >
                                                <SelectTrigger className="h-8 text-sm">
                                                  <SelectValue placeholder="Condition" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="equals">=</SelectItem>
                                                  <SelectItem value="notEquals">≠</SelectItem>
                                                  <SelectItem value="greaterThan">&gt;</SelectItem>
                                                  <SelectItem value="lessThan">&lt;</SelectItem>
                                                  <SelectItem value="contains">contains</SelectItem>
                                                  <SelectItem value="notContains">not contains</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    
                                    <div className="col-span-1">
                                      <FormField
                                        control={form.control}
                                        name={`companyConfig.scoringRules.${index}.value`}
                                        render={({ field }) => (
                                          <FormItem className="space-y-0">
                                            <FormControl>
                                              <Input 
                                                className="h-8 text-sm" 
                                                placeholder="Value" 
                                                {...field} 
                                              />
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    
                                    <div className="col-span-1">
                                      <FormField
                                        control={form.control}
                                        name={`companyConfig.scoringRules.${index}.score`}
                                        render={({ field }) => (
                                          <FormItem className="space-y-0">
                                            <FormControl>
                                              <div className="relative w-full">
                                                <div className="flex items-center gap-2">
                                                  <Input 
                                                    className="h-8 text-sm"
                                                    type="range" 
                                                    min="-100" 
                                                    max="100" 
                                                    step="5" 
                                                    {...field} 
                                                    onChange={e => field.onChange(parseInt(e.target.value) || 50)}
                                                    value={field.value || 50}
                                                  />
                                                  <div className={`px-2 py-1 rounded-md text-xs font-semibold ${
                                                    (field.value || 50) > 75 ? 'bg-green-100 text-green-800' : 
                                                    (field.value || 50) < 0 ? 'bg-red-100 text-red-800' : 
                                                    (field.value || 50) > 25 ? 'bg-blue-100 text-blue-800' : 
                                                    'bg-amber-100 text-amber-800'
                                                  }`}>
                                                    {(field.value || 50) > 0 ? `+${field.value || 50}` : (field.value || 50)}
                                                  </div>
                                                </div>
                                              </div>
                                            </FormControl>
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    
                                    <div className="col-span-1 flex justify-end items-center">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => companyScoringRules.remove(index)}
                                        className="h-7 w-7 p-0"
                                      >
                                        <X size={14} className="text-red-500" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-8 text-muted-foreground">
                          <div className="mb-2">No scoring rules defined yet</div>
                          <div className="text-sm">Add rules to prioritize specific company attributes</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Add new rule form */}
                    <div className="border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium">Add Scoring Rule</h3>
                        <Button 
                          type="button" 
                          size="sm"
                          variant="default"
                          onClick={addCompanyScoringRule}
                        >
                          <PlusCircle className="h-4 w-4 mr-1" /> Add Rule
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <h4 className="text-sm font-medium mb-2">Common Scoring Patterns</h4>
                          <div className="grid gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="justify-start h-auto py-2 text-left"
                              onClick={() => {
                                companyScoringRules.append({
                                  parameter: "company_size",
                                  condition: "greaterThan",
                                  value: "100",
                                  score: 75
                                });
                              }}
                            >
                              <div className="flex items-center">
                                <div className="mr-3">
                                  <Badge variant="outline" className="bg-blue-50">75 pts</Badge>
                                </div>
                                <div>
                                  <div className="font-medium">Company Size &gt; 100 employees</div>
                                  <div className="text-xs text-muted-foreground">Prioritize larger companies</div>
                                </div>
                              </div>
                            </Button>
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="justify-start h-auto py-2 text-left"
                              onClick={() => {
                                companyScoringRules.append({
                                  parameter: "industry",
                                  condition: "equals",
                                  value: "technology",
                                  score: 60
                                });
                              }}
                            >
                              <div className="flex items-center">
                                <div className="mr-3">
                                  <Badge variant="outline" className="bg-green-50">60 pts</Badge>
                                </div>
                                <div>
                                  <div className="font-medium">Industry = Technology</div>
                                  <div className="text-xs text-muted-foreground">Focus on tech companies</div>
                                </div>
                              </div>
                            </Button>
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="justify-start h-auto py-2 text-left"
                              onClick={() => {
                                companyScoringRules.append({
                                  parameter: "founded_year",
                                  condition: "greater_than",
                                  value: "2015",
                                  score: 40
                                });
                              }}
                            >
                              <div className="flex items-center">
                                <div className="mr-3">
                                  <Badge variant="outline" className="bg-amber-50">40 pts</Badge>
                                </div>
                                <div>
                                  <div className="font-medium">Founded Year &gt; 2015</div>
                                  <div className="text-xs text-muted-foreground">Newer companies</div>
                                </div>
                              </div>
                            </Button>
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="justify-start h-auto py-2 text-left"
                              onClick={() => {
                                companyScoringRules.append({
                                  parameter: "revenue",
                                  condition: "greater_than",
                                  value: "10000000",
                                  score: 80
                                });
                              }}
                            >
                              <div className="flex items-center">
                                <div className="mr-3">
                                  <Badge variant="outline" className="bg-purple-50">80 pts</Badge>
                                </div>
                                <div>
                                  <div className="font-medium">Revenue &gt; $10M</div>
                                  <div className="text-xs text-muted-foreground">Higher value accounts</div>
                                </div>
                              </div>
                            </Button>
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="justify-start h-auto py-2 text-left"
                              onClick={() => {
                                companyScoringRules.append({
                                  parameter: "industry",
                                  condition: "equals",
                                  value: "Technology",
                                  score: 85
                                });
                              }}
                            >
                              <div className="flex items-center">
                                <div className="mr-3">
                                  <Badge variant="outline" className="bg-green-50">85 pts</Badge>
                                </div>
                                <div>
                                  <div className="font-medium">Industry = Technology</div>
                                  <div className="text-xs text-muted-foreground">Target technology companies</div>
                                </div>
                              </div>
                            </Button>
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="justify-start h-auto py-2 text-left"
                              onClick={() => {
                                companyScoringRules.append({
                                  parameter: "location",
                                  condition: "contains",
                                  value: "California",
                                  score: 60
                                });
                              }}
                            >
                              <div className="flex items-center">
                                <div className="mr-3">
                                  <Badge variant="outline" className="bg-blue-50">60 pts</Badge>
                                </div>
                                <div>
                                  <div className="font-medium">Location contains California</div>
                                  <div className="text-xs text-muted-foreground">Prioritize companies in California</div>
                                </div>
                              </div>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" type="button" onClick={goToPrevious}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                <Button type="button" onClick={goToNext}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* Contact Search Tab */}
          <TabsContent value="contact" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Search Configuration</CardTitle>
                <CardDescription>
                  Configure how contact information is searched and validated
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Similar structure to Company tab, but for Contacts */}
                <div className="space-y-3">
                  <div>
                    <FormLabel className="text-base font-medium">Core Search Approach</FormLabel>
                    <FormDescription>
                      Select the primary method used for contact discovery
                    </FormDescription>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 mt-2">
                    <FormField
                      control={form.control}
                      name="contactConfig.coreApproach"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <div className="space-y-2">
                              <CardButton
                                isSelected={field.value === "single"}
                                onClick={() => field.onChange("single")}
                                icon={<div className="bg-blue-100 text-blue-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">S</span></div>}
                                title="Single"
                                description="Basic contact search with a single data source"
                              />
                              
                              <CardButton
                                isSelected={field.value === "double"}
                                onClick={() => field.onChange("double")}
                                icon={<div className="bg-green-100 text-green-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">D</span></div>}
                                title="Double"
                                description="Enhanced contact search with two data sources"
                              />
                              
                              <CardButton
                                isSelected={field.value === "triple"}
                                onClick={() => field.onChange("triple")}
                                icon={<div className="bg-purple-100 text-purple-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">T</span></div>}
                                title="Triple"
                                description="Comprehensive contact search with three data sources"
                              />
                              
                              <CardButton
                                isSelected={field.value === "perplexity"}
                                onClick={() => field.onChange("perplexity")}
                                icon={<div className="bg-amber-100 text-amber-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">P</span></div>}
                                title="Perplexity Search"
                                description="AI-powered contact search with deep verification"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Prompt Additions */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Prompt Additions</Label>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="ghost" 
                      onClick={addContactPrompt}
                    >
                      <PlusCircle className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {contactPromptAdditions.fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-start">
                        <FormField
                          control={form.control}
                          name={`contactConfig.promptAdditions.${index}`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input placeholder="e.g. Focus on technical leadership" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => contactPromptAdditions.remove(index)}
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    
                    {contactPromptAdditions.fields.length === 0 && (
                      <div className="text-sm text-muted-foreground italic">
                        No prompt additions added yet. Click "Add" to include special instructions.
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Secondary Search Options */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-medium">Secondary Search Technologies</Label>
                    <div className="text-sm text-muted-foreground">
                      Select one or more options to enhance contact discovery
                    </div>
                  </div>
                  
                  <div className="space-y-2 border rounded-lg p-3">
                    <FormField
                      control={form.control}
                      name="contactConfig.secondarySearch.searchGraphApi"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-x-2 space-y-0 p-2 hover:bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="font-medium text-sm cursor-pointer">
                                Search Graph API
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Professional network and connections data
                              </FormDescription>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="contactConfig.secondarySearch.hunterIo"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-x-2 space-y-0 p-2 hover:bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="font-medium text-sm cursor-pointer">
                                Hunter.io
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Professional contact finder with email verification
                              </FormDescription>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="contactConfig.secondarySearch.zoomInfo"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-x-2 space-y-0 p-2 hover:bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="font-medium text-sm cursor-pointer">
                                ZoomInfo
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Premium B2B contact and company database
                              </FormDescription>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Additional contact-specific fields can be added here */}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" type="button" onClick={goToPrevious}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                <Button type="button" onClick={goToNext}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* Email Discovery Tab */}
          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Discovery Configuration</CardTitle>
                <CardDescription>
                  Configure how email addresses are discovered and validated
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Similar structure to previous tabs, but for Email */}
                <div className="space-y-3">
                  <div>
                    <FormLabel className="text-base font-medium">Core Email Discovery Approach</FormLabel>
                    <FormDescription>
                      Select the primary method used for email address discovery
                    </FormDescription>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 mt-2">
                    <FormField
                      control={form.control}
                      name="emailConfig.coreApproach"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <div className="space-y-2">
                              <CardButton
                                isSelected={field.value === "single"}
                                onClick={() => field.onChange("single")}
                                icon={<div className="bg-indigo-100 text-indigo-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">S</span></div>}
                                title="Pattern Match"
                                description="Basic email pattern matching with domain verification"
                              />
                              
                              <CardButton
                                isSelected={field.value === "double"}
                                onClick={() => field.onChange("double")}
                                icon={<div className="bg-teal-100 text-teal-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">D</span></div>}
                                title="Dual Verification"
                                description="Double-check email patterns with MX validation"
                              />
                              
                              <CardButton
                                isSelected={field.value === "triple"}
                                onClick={() => field.onChange("triple")}
                                icon={<div className="bg-pink-100 text-pink-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">T</span></div>}
                                title="Triple Check"
                                description="Triple verification with SMTP live testing"
                              />
                              
                              <CardButton
                                isSelected={field.value === "perplexity"}
                                onClick={() => field.onChange("perplexity")}
                                icon={<div className="bg-orange-100 text-orange-700 w-10 h-10 rounded-full flex items-center justify-center"><span className="font-medium">P</span></div>}
                                title="Perplexity Search"
                                description="AI-powered email discovery with confidence scoring"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Secondary Search Options */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-medium">Secondary Search Technologies</Label>
                    <div className="text-sm text-muted-foreground">
                      Select one or more options to enhance email discovery
                    </div>
                  </div>
                  
                  <div className="space-y-2 border rounded-lg p-3">
                    <FormField
                      control={form.control}
                      name="emailConfig.secondarySearch.smtpVerification"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-x-2 space-y-0 p-2 hover:bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="font-medium text-sm cursor-pointer">
                                SMTP Verification
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Direct server verification of email existence
                              </FormDescription>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="emailConfig.secondarySearch.aeroLeads"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-x-2 space-y-0 p-2 hover:bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div>
                              <FormLabel className="font-medium text-sm cursor-pointer">
                                AeroLeads
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Email finder with verification for B2B leads
                              </FormDescription>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Email validation specific fields can be added here */}
                
                {/* Configuration Summary */}
                <div className="bg-blue-50 rounded-lg p-4 mt-6 border border-blue-100">
                  <h3 className="text-sm font-medium text-blue-700 mb-2">Configuration Summary</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="text-muted-foreground">Name:</div>
                      <div className="font-medium">{form.watch("name") || "Unnamed Configuration"}</div>
                      
                      <div className="text-muted-foreground">Company Search:</div>
                      <div className="font-medium capitalize">{form.watch("companyConfig.coreApproach") || "Not selected"}</div>
                      
                      <div className="text-muted-foreground">Contact Search:</div>
                      <div className="font-medium capitalize">{form.watch("contactConfig.coreApproach") || "Not selected"}</div>
                      
                      <div className="text-muted-foreground">Email Discovery:</div>
                      <div className="font-medium capitalize">{form.watch("emailConfig.coreApproach") || "Not selected"}</div>
                      
                      <div className="text-muted-foreground">Validation Strategy:</div>
                      <div className="font-medium capitalize">{form.watch("validationStrategy") || "Not selected"}</div>
                      
                      <div className="text-muted-foreground">Status:</div>
                      <div className="font-medium">
                        {form.watch("active") ? (
                          <span className="flex items-center text-green-600">
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center text-amber-600">
                            <X className="h-4 w-4 mr-1" /> Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" type="button" onClick={goToPrevious}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      Save Configuration
                    </span>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
}