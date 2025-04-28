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
import { SearchApproach } from "@shared/schema";
import { Plus, Edit, MoreHorizontal, Trash, ExternalLink, Code, CheckCircle2, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Form schema for creating/editing approaches
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  prompt: z.string().min(1, "Prompt is required"),
  order: z.number().min(1, "Order is required"),
  active: z.boolean().default(true),
  type: z.enum(["internal", "external"]),
  moduleType: z.enum([
    "company_overview",
    "decision_maker",
    "email_discovery",
    "email_enrichment",
    "email_deepdive"
  ]).default("company_overview"),
  technicalPrompt: z.string().optional(),
  responseStructure: z.string().optional(),
  requestUrl: z.string().url().optional().or(z.literal("")),
  requestFormat: z.string().optional(),
  responseFormat: z.string().optional()
});

// Define the form's data type
type FormData = z.infer<typeof formSchema>;

export default function ApproachesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedApproach, setSelectedApproach] = useState<SearchApproach | null>(null);

  // Fetch all search approaches
  const {
    data: approaches = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ["/api/search-approaches"],
    retry: 1
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      return apiRequest("/api/search-approaches", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search-approaches"] });
      toast({
        title: "Success",
        description: "Search approach created successfully",
      });
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create search approach: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: FormData & { id: number }) => {
      const { id, ...rest } = data;
      return apiRequest(`/api/search-approaches/${id}`, "PATCH", rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search-approaches"] });
      toast({
        title: "Success",
        description: "Search approach updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedApproach(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update search approach: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/search-approaches/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search-approaches"] });
      toast({
        title: "Success",
        description: "Search approach deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete search approach: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Create form
  const createForm = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      prompt: "",
      order: approaches.length + 1,
      active: true,
      type: "internal",
      moduleType: "company_overview",
      technicalPrompt: "",
      responseStructure: "",
      requestUrl: "",
      requestFormat: "",
      responseFormat: ""
    }
  });

  // Edit form
  const editForm = useForm<FormData & { id: number }>({
    resolver: zodResolver(formSchema.extend({ id: z.number() })),
    values: selectedApproach ? {
      id: selectedApproach.id,
      name: selectedApproach.name,
      prompt: selectedApproach.prompt,
      order: selectedApproach.order,
      active: selectedApproach.active || false,
      type: selectedApproach.type as "internal" | "external" || "internal",
      moduleType: selectedApproach.moduleType as any || "company_overview",
      technicalPrompt: selectedApproach.technicalPrompt || "",
      responseStructure: selectedApproach.responseStructure || "",
      requestUrl: selectedApproach.requestUrl || "",
      requestFormat: selectedApproach.requestFormat ? JSON.stringify(selectedApproach.requestFormat, null, 2) : "",
      responseFormat: selectedApproach.responseFormat ? JSON.stringify(selectedApproach.responseFormat, null, 2) : ""
    } : {
      id: 0,
      name: "",
      prompt: "",
      order: 0,
      active: true,
      type: "internal",
      moduleType: "company_overview",
      technicalPrompt: "",
      responseStructure: "",
      requestUrl: "",
      requestFormat: "",
      responseFormat: ""
    }
  });

  // Watch for form value changes
  const createFormType = createForm.watch("type");
  const editFormType = editForm.watch("type");

  // Handle create form submission
  const handleCreateSubmit = (data: FormData) => {
    // Parse JSON strings to objects if they are provided
    const formattedData = {
      ...data,
      requestFormat: data.requestFormat ? JSON.parse(data.requestFormat) : undefined,
      responseFormat: data.responseFormat ? JSON.parse(data.responseFormat) : undefined
    };
    createMutation.mutate(formattedData);
  };

  // Handle edit form submission
  const handleEditSubmit = (data: FormData & { id: number }) => {
    // Parse JSON strings to objects if they are provided
    const formattedData = {
      ...data,
      requestFormat: data.requestFormat ? JSON.parse(data.requestFormat) : undefined,
      responseFormat: data.responseFormat ? JSON.parse(data.responseFormat) : undefined
    };
    updateMutation.mutate(formattedData);
  };

  // Handle deleting an approach
  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this search approach?")) {
      deleteMutation.mutate(id);
    }
  };

  // Handle editing an approach
  const handleEdit = (approach: SearchApproach) => {
    setSelectedApproach(approach);
    editForm.reset({
      id: approach.id,
      name: approach.name,
      prompt: approach.prompt,
      order: approach.order,
      active: approach.active || false,
      type: approach.type as "internal" | "external" || "internal",
      moduleType: approach.moduleType as any || "company_overview",
      technicalPrompt: approach.technicalPrompt || "",
      responseStructure: approach.responseStructure || "",
      requestUrl: approach.requestUrl || "",
      requestFormat: approach.requestFormat ? JSON.stringify(approach.requestFormat, null, 2) : "",
      responseFormat: approach.responseFormat ? JSON.stringify(approach.responseFormat, null, 2) : ""
    });
    setIsEditDialogOpen(true);
  };

  if (isLoading) {
    return <div className="container py-10">Loading approaches...</div>;
  }

  if (error) {
    return <div className="container py-10">Error loading approaches: {(error as Error).message}</div>;
  }

  // Helper to render approach type badge
  const renderTypeBadge = (type: string) => {
    if (type === "internal") {
      return <Badge variant="secondary">Internal</Badge>;
    } else {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100">External</Badge>;
    }
  };

  // Helper to render module type badge
  const renderModuleBadge = (type: string) => {
    switch (type) {
      case "company_overview":
        return <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">Company Overview</Badge>;
      case "decision_maker":
        return <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200">Decision Maker</Badge>;
      case "email_discovery":
        return <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">Email Discovery</Badge>;
      case "email_enrichment":
        return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200">Email Enrichment</Badge>;
      case "email_deepdive":
        return <Badge className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200">Email Deepdive</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search Approaches</h1>
          <p className="text-muted-foreground mt-1">
            Manage and configure your search approaches for discovering companies and contacts.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Approach
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Approaches</TabsTrigger>
          <TabsTrigger value="internal">Internal</TabsTrigger>
          <TabsTrigger value="external">External</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approaches.map((approach: SearchApproach) => (
              <Card key={approach.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{approach.name}</CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleEdit(approach)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(approach.id)} className="text-red-600">
                          <Trash className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {renderTypeBadge(approach.type || "internal")}
                    {renderModuleBadge(approach.moduleType)}
                    {approach.active ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700">Inactive</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{approach.prompt}</p>
                  {approach.type === "external" && approach.requestUrl && (
                    <div className="mt-2 text-xs flex items-center text-muted-foreground">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      <span className="truncate">{approach.requestUrl}</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-0 pb-3">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(approach)}>
                    <Edit className="h-3 w-3 mr-2" />
                    Edit
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="internal" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approaches
              .filter((approach: SearchApproach) => approach.type === "internal" || !approach.type)
              .map((approach: SearchApproach) => (
                <Card key={approach.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{approach.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEdit(approach)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(approach.id)} className="text-red-600">
                            <Trash className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {renderModuleBadge(approach.moduleType)}
                      {approach.active ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700">Inactive</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{approach.prompt}</p>
                  </CardContent>
                  <CardFooter className="pt-0 pb-3">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(approach)}>
                      <Edit className="h-3 w-3 mr-2" />
                      Edit
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </TabsContent>
        
        <TabsContent value="external" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approaches
              .filter((approach: SearchApproach) => approach.type === "external")
              .map((approach: SearchApproach) => (
                <Card key={approach.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{approach.name}</CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEdit(approach)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(approach.id)} className="text-red-600">
                            <Trash className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {renderModuleBadge(approach.moduleType)}
                      {approach.active ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700">Inactive</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{approach.prompt}</p>
                    {approach.requestUrl && (
                      <div className="mt-2 text-xs flex items-center text-muted-foreground">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        <span className="truncate">{approach.requestUrl}</span>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-0 pb-3">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(approach)}>
                      <Edit className="h-3 w-3 mr-2" />
                      Edit
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Search Approach</DialogTitle>
            <DialogDescription>
              Add a new search approach to discover companies and contacts.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g., Advanced Company Discovery" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Order</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={createForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approach Type</FormLabel>
                    <FormControl>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select approach type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="internal">Internal</SelectItem>
                          <SelectItem value="external">External</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      Internal approaches use the built-in search engine, external approaches connect to external services.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="moduleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Module Type</FormLabel>
                    <FormControl>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select module type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="company_overview">Company Overview</SelectItem>
                          <SelectItem value="decision_maker">Decision Maker</SelectItem>
                          <SelectItem value="email_discovery">Email Discovery</SelectItem>
                          <SelectItem value="email_enrichment">Email Enrichment</SelectItem>
                          <SelectItem value="email_deepdive">Email Deepdive</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      The type of search module this approach is designed for.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Prompt</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter the user-facing prompt that describes what this approach does"
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Enable or disable this search approach.
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
              
              {createFormType === "internal" && (
                <>
                  <FormField
                    control={createForm.control}
                    name="technicalPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Technical Prompt</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Technical details for the AI or search system"
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Specific technical instructions for the search system.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="responseStructure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Response Structure</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="The expected structure of responses from this approach"
                            className="min-h-[100px] font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Describe the expected format of responses.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              {createFormType === "external" && (
                <>
                  <FormField
                    control={createForm.control}
                    name="requestUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Request URL</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://example.com/api/search"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          The URL endpoint for the external search service.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="requestFormat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Request Format</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder='{"query": "{{query}}", "options": {"limit": 10}}'
                            className="min-h-[100px] font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          JSON template for the request. Use {{query}} as a placeholder for the search query.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="responseFormat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Response Format</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder='{"companies": [{"name": "string", "website": "string"}], "contacts": [{"name": "string", "email": "string"}]}'
                            className="min-h-[100px] font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Expected JSON structure of the response from the external service.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Approach"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Search Approach</DialogTitle>
            <DialogDescription>
              Update this search approach's settings.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g., Advanced Company Discovery" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Order</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={editForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approach Type</FormLabel>
                    <FormControl>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select approach type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="internal">Internal</SelectItem>
                          <SelectItem value="external">External</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      Internal approaches use the built-in search engine, external approaches connect to external services.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="moduleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Module Type</FormLabel>
                    <FormControl>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select module type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="company_overview">Company Overview</SelectItem>
                          <SelectItem value="decision_maker">Decision Maker</SelectItem>
                          <SelectItem value="email_discovery">Email Discovery</SelectItem>
                          <SelectItem value="email_enrichment">Email Enrichment</SelectItem>
                          <SelectItem value="email_deepdive">Email Deepdive</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      The type of search module this approach is designed for.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Prompt</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter the user-facing prompt that describes what this approach does"
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Enable or disable this search approach.
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
              
              {editFormType === "internal" && (
                <>
                  <FormField
                    control={editForm.control}
                    name="technicalPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Technical Prompt</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Technical details for the AI or search system"
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Specific technical instructions for the search system.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="responseStructure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Response Structure</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="The expected structure of responses from this approach"
                            className="min-h-[100px] font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Describe the expected format of responses.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              {editFormType === "external" && (
                <>
                  <FormField
                    control={editForm.control}
                    name="requestUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Request URL</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://example.com/api/search"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          The URL endpoint for the external search service.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="requestFormat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Request Format</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder='{"query": "{{query}}", "options": {"limit": 10}}'
                            className="min-h-[100px] font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          JSON template for the request. Use {{query}} as a placeholder for the search query.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="responseFormat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Response Format</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder='{"companies": [{"name": "string", "website": "string"}], "contacts": [{"name": "string", "email": "string"}]}'
                            className="min-h-[100px] font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Expected JSON structure of the response from the external service.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Update Approach"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}