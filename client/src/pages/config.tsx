import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { 
  Plus, 
  Edit, 
  MoreHorizontal, 
  Trash, 
  CheckCircle2, 
  XCircle, 
  Search as SearchIcon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { SearchConfigurationForm } from "@/components/search-configuration-form";

// Search approach type enum
const searchApproachEnum = z.enum(["single", "double", "triple", "perplexity"]);

// Search parameter schema
const searchParameterSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  priority: z.number().min(1).max(10).default(5)
});

// Scoring rule schema
const scoringRuleSchema = z.object({
  parameter: z.string(),
  condition: z.enum(["equals", "notEquals", "greaterThan", "lessThan", "contains", "notContains"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
  score: z.number().min(0).max(100)
});

// Secondary search schemas for different phases
const companySecondarySearchSchema = z.object({
  fireCrawlStandard: z.boolean().default(false),
  fireCrawlExtract: z.boolean().default(false),
  serpApi: z.boolean().default(false),
  googleMyBusiness: z.boolean().default(false)
});

const contactSecondarySearchSchema = z.object({
  searchGraphApi: z.boolean().default(false),
  hunterIo: z.boolean().default(false),
  zoomInfo: z.boolean().default(false)
});

const emailSecondarySearchSchema = z.object({
  smtpVerification: z.boolean().default(false),
  aeroLeads: z.boolean().default(false)
});

// Company phase configuration schema
const companyPhaseConfigSchema = z.object({
  coreApproach: searchApproachEnum,
  promptAdditions: z.array(z.string()).default([]),
  customParameters: z.array(searchParameterSchema).default([]),
  secondarySearch: companySecondarySearchSchema.default({
    fireCrawlStandard: false,
    fireCrawlExtract: false,
    serpApi: false,
    googleMyBusiness: false
  }),
  scoringRules: z.array(scoringRuleSchema).default([])
});

// Contact phase configuration schema
const contactPhaseConfigSchema = z.object({
  coreApproach: searchApproachEnum,
  promptAdditions: z.array(z.string()).default([]),
  customParameters: z.array(searchParameterSchema).default([]),
  secondarySearch: contactSecondarySearchSchema.default({
    searchGraphApi: false,
    hunterIo: false,
    zoomInfo: false
  }),
  scoringRules: z.array(scoringRuleSchema).default([])
});

// Email phase configuration schema
const emailPhaseConfigSchema = z.object({
  coreApproach: searchApproachEnum,
  promptAdditions: z.array(z.string()).default([]),
  customParameters: z.array(searchParameterSchema).default([]),
  secondarySearch: emailSecondarySearchSchema.default({
    smtpVerification: false,
    aeroLeads: false
  }),
  scoringRules: z.array(scoringRuleSchema).default([])
});

// Form schema for creating/editing configurations
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  order: z.number().min(0, "Order is required"),
  active: z.boolean().default(true),
  validationStrategy: z.enum(["strict", "moderate", "lenient"]).default("moderate"),
  companyConfig: companyPhaseConfigSchema.default({
    coreApproach: "single",
    promptAdditions: [],
    customParameters: [],
    secondarySearch: {
      fireCrawlStandard: false,
      fireCrawlExtract: false,
      serpApi: false,
      googleMyBusiness: false
    },
    scoringRules: []
  }),
  contactConfig: contactPhaseConfigSchema.default({
    coreApproach: "single",
    promptAdditions: [],
    customParameters: [],
    secondarySearch: {
      searchGraphApi: false,
      hunterIo: false,
      zoomInfo: false
    },
    scoringRules: []
  }),
  emailConfig: emailPhaseConfigSchema.default({
    coreApproach: "perplexity",
    promptAdditions: [],
    customParameters: [],
    secondarySearch: {
      smtpVerification: false,
      aeroLeads: false
    },
    scoringRules: []
  })
});

// Define the form's data type
type FormData = z.infer<typeof formSchema>;
type CompanyPhaseConfig = z.infer<typeof companyPhaseConfigSchema>;
type ContactPhaseConfig = z.infer<typeof contactPhaseConfigSchema>;
type EmailPhaseConfig = z.infer<typeof emailPhaseConfigSchema>;
type SearchParameter = z.infer<typeof searchParameterSchema>;
type ScoringRule = z.infer<typeof scoringRuleSchema>;

export default function ConfigPage() {
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<any | null>(null);

  // Fetch all search configurations
  const {
    data: configurations = [],
    isLoading,
    error,
    isError
  } = useQuery<any[]>({
    queryKey: ["/api/search-configurations"],
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      return apiRequest("POST", "/api/search-configurations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search-configurations"] });
      toast({
        title: "Success",
        description: "Search configuration created successfully",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create search configuration: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: FormData & { id: number }) => {
      const { id, ...rest } = data;
      return apiRequest("PATCH", `/api/search-configurations/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search-configurations"] });
      toast({
        title: "Success",
        description: "Search configuration updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedConfig(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update search configuration: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest("DELETE", `/api/search-configurations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search-configurations"] });
      toast({
        title: "Success",
        description: "Search configuration deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete search configuration: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Create form
  const createForm = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      order: Array.isArray(configurations) && configurations.length ? configurations.length + 1 : 1,
      active: true,
      validationStrategy: "moderate",
      companyConfig: {
        coreApproach: "single",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          fireCrawlStandard: false,
          fireCrawlExtract: false,
          serpApi: false,
          googleMyBusiness: false
        },
        scoringRules: []
      },
      contactConfig: {
        coreApproach: "single",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          searchGraphApi: false,
          hunterIo: false,
          zoomInfo: false
        },
        scoringRules: []
      },
      emailConfig: {
        coreApproach: "perplexity",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          smtpVerification: false,
          aeroLeads: false
        },
        scoringRules: []
      }
    }
  });

  // Edit form
  const editForm = useForm<FormData & { id: number }>({
    resolver: zodResolver(formSchema.extend({ id: z.number() })),
    values: selectedConfig ? {
      id: selectedConfig.id,
      name: selectedConfig.name,
      description: selectedConfig.description || "",
      order: selectedConfig.order,
      active: selectedConfig.active || false,
      validationStrategy: selectedConfig.validationStrategy || "moderate",
      companyConfig: selectedConfig.companyConfig || {
        coreApproach: "single",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          fireCrawlStandard: false,
          fireCrawlExtract: false,
          serpApi: false,
          googleMyBusiness: false
        },
        scoringRules: []
      },
      contactConfig: selectedConfig.contactConfig || {
        coreApproach: "single",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          searchGraphApi: false,
          hunterIo: false,
          zoomInfo: false
        },
        scoringRules: []
      },
      emailConfig: selectedConfig.emailConfig || {
        coreApproach: "perplexity",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          smtpVerification: false,
          aeroLeads: false
        },
        scoringRules: []
      }
    } : {
      id: 0,
      name: "",
      description: "",
      order: 0,
      active: true,
      validationStrategy: "moderate",
      companyConfig: {
        coreApproach: "single",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          fireCrawlStandard: false,
          fireCrawlExtract: false,
          serpApi: false,
          googleMyBusiness: false
        },
        scoringRules: []
      },
      contactConfig: {
        coreApproach: "single",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          searchGraphApi: false,
          hunterIo: false,
          zoomInfo: false
        },
        scoringRules: []
      },
      emailConfig: {
        coreApproach: "perplexity",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          smtpVerification: false,
          aeroLeads: false
        },
        scoringRules: []
      }
    }
  });

  // Handle create form submission
  const handleCreateSubmit = (data: FormData) => {
    // Make sure order is a number
    const order = typeof data.order === 'string' ? parseInt(data.order) : data.order;
    
    const formattedData = {
      ...data,
      order: isNaN(order) ? 1 : order
    };
    createMutation.mutate(formattedData);
  };

  // Handle edit form submission
  const handleEditSubmit = (data: FormData & { id: number }) => {
    // Make sure order is a number
    const order = typeof data.order === 'string' ? parseInt(data.order) : data.order;
    
    const formattedData = {
      ...data,
      order: isNaN(order) ? 1 : order
    };
    updateMutation.mutate(formattedData);
  };

  // Handle deleting a configuration
  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this search configuration?")) {
      deleteMutation.mutate(id);
    }
  };

  // Handle editing a configuration
  const handleEdit = (config: any) => {
    setSelectedConfig(config);
    editForm.reset({
      id: config.id,
      name: config.name,
      description: config.description || "",
      order: config.order,
      active: config.active || false,
      validationStrategy: config.validationStrategy || "moderate",
      companyConfig: config.companyConfig || {
        coreApproach: "single",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          fireCrawlStandard: false,
          fireCrawlExtract: false,
          serpApi: false,
          googleMyBusiness: false
        },
        scoringRules: []
      },
      contactConfig: config.contactConfig || {
        coreApproach: "single",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          searchGraphApi: false,
          hunterIo: false,
          zoomInfo: false
        },
        scoringRules: []
      },
      emailConfig: config.emailConfig || {
        coreApproach: "perplexity",
        promptAdditions: [],
        customParameters: [],
        secondarySearch: {
          smtpVerification: false,
          aeroLeads: false
        },
        scoringRules: []
      }
    });
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return <div className="container mx-auto px-4 py-10 max-w-7xl">Loading configurations...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-10 max-w-7xl">Error loading configurations: {(error as Error).message}</div>;
  }

  // Helper to render strategy badge
  const renderStrategyBadge = (strategy: string | null) => {
    if (!strategy) return null;
    
    switch (strategy) {
      case "strict":
        return <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200">Strict</Badge>;
      case "moderate":
        return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200">Moderate</Badge>;
      case "lenient":
        return <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">Lenient</Badge>;
      default:
        return <Badge variant="outline">{strategy}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search Configurations</h1>
          <p className="text-muted-foreground mt-1">
            Manage your search configurations for discovering companies and contacts
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Configuration
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Configurations</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-6">
          <div className="rounded-md border">
            <div className="bg-muted/50 p-4">
              <h3 className="text-lg font-medium">All Configurations</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your collection of search configurations for finding companies and contacts
              </p>
            </div>
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr className="border-b transition-colors hover:bg-muted/20">
                    <th className="h-12 px-4 text-left align-middle font-medium">Name</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Description</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Strategy</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Status</th>
                    <th className="h-12 px-4 text-center align-middle font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!Array.isArray(configurations) || configurations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        No search configurations found. Create one to get started.
                      </td>
                    </tr>
                  ) : configurations.map((config: any) => (
                    <tr 
                      key={config.id} 
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <td className="p-4 align-middle">{config.name}</td>
                      <td className="p-4 align-middle">{config.description || '-'}</td>
                      <td className="p-4 align-middle">
                        {renderStrategyBadge(config.validationStrategy)}
                      </td>
                      <td className="p-4 align-middle">
                        {config.active ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600">Inactive</Badge>
                        )}
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex justify-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(config)} title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50" 
                            title="View Details"
                          >
                            <SearchIcon className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-800 hover:bg-red-50" 
                            onClick={() => handleDelete(config.id)}
                            title="Delete"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="active" className="mt-6">
          <div className="rounded-md border">
            <div className="bg-muted/50 p-4">
              <h3 className="text-lg font-medium">Active Configurations</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Currently active search configurations
              </p>
            </div>
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr className="border-b transition-colors hover:bg-muted/20">
                    <th className="h-12 px-4 text-left align-middle font-medium">Name</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Description</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Strategy</th>
                    <th className="h-12 px-4 text-center align-middle font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!Array.isArray(configurations) || configurations.filter((c: any) => c.active).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        No active search configurations found.
                      </td>
                    </tr>
                  ) : configurations.filter((c: any) => c.active).map((config: any) => (
                    <tr 
                      key={config.id} 
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <td className="p-4 align-middle">{config.name}</td>
                      <td className="p-4 align-middle">{config.description || '-'}</td>
                      <td className="p-4 align-middle">
                        {renderStrategyBadge(config.validationStrategy)}
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex justify-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(config)} title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50" 
                            title="View Details"
                          >
                            <SearchIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="inactive" className="mt-6">
          <div className="rounded-md border">
            <div className="bg-muted/50 p-4">
              <h3 className="text-lg font-medium">Inactive Configurations</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Currently inactive search configurations
              </p>
            </div>
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr className="border-b transition-colors hover:bg-muted/20">
                    <th className="h-12 px-4 text-left align-middle font-medium">Name</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Description</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Strategy</th>
                    <th className="h-12 px-4 text-center align-middle font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!Array.isArray(configurations) || configurations.filter((c: any) => !c.active).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        No inactive search configurations found.
                      </td>
                    </tr>
                  ) : configurations.filter((c: any) => !c.active).map((config: any) => (
                    <tr 
                      key={config.id} 
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <td className="p-4 align-middle">{config.name}</td>
                      <td className="p-4 align-middle">{config.description || '-'}</td>
                      <td className="p-4 align-middle">
                        {renderStrategyBadge(config.validationStrategy)}
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex justify-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(config)} title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50" 
                            title="View Details"
                          >
                            <SearchIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-5xl h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Search Configuration</DialogTitle>
            <DialogDescription>
              Set up a new search configuration with our multi-step wizard.
            </DialogDescription>
          </DialogHeader>
          
          {/* Multi-step configuration form */}
          <SearchConfigurationForm 
            form={createForm} 
            onSubmit={handleCreateSubmit} 
            onCancel={() => setIsCreateDialogOpen(false)}
            isSubmitting={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-5xl h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Search Configuration</DialogTitle>
            <DialogDescription>
              Modify your search configuration with our multi-step wizard.
            </DialogDescription>
          </DialogHeader>
          
          {/* Multi-step configuration form */}
          <SearchConfigurationForm 
            form={editForm} 
            onSubmit={handleEditSubmit} 
            onCancel={() => setIsEditDialogOpen(false)}
            isSubmitting={updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}