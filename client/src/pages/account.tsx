import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { User, Settings, CreditCard, Package, ExternalLink, Mail, Plus, MoreVertical, Edit, Copy, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Schema for profile updates
const profileSchema = z.object({
  username: z.string().min(1, "Name is required").max(50, "Name must be less than 50 characters"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface UserProfile {
  id: number;
  email: string;
  username: string;
  createdAt: string;
}

interface SubscriptionStatus {
  isSubscribed: boolean;
  currentPlan: string | null;
  planDisplayName: string | null;
}

interface Product {
  id: number;
  name?: string;
  short_description?: string;
  businessType: "product" | "service";
  businessDescription: string;
  targetCustomers: string;
  uniqueAttributes?: string[];
  marketNiche?: "niche" | "broad";
  productService?: string;
  customerFeedback?: string;
  website?: string;
  businessLocation?: string;
  primaryCustomerType?: string;
  primarySalesChannel?: string;
  primaryBusinessGoal?: string;
  status: "in_progress" | "completed";
  userId: number;
  createdAt: string;
  updatedAt: string;
}

// Schema for product form
const productSchema = z.object({
  name: z.string().optional(),
  short_description: z.string().optional(),
  businessType: z.enum(["product", "service"]),
  businessDescription: z.string().min(1, "Business description is required"),
  targetCustomers: z.string().min(1, "Target customers description is required"),
  uniqueAttributes: z.string().optional(), // Form uses string, we'll convert to array
  marketNiche: z.enum(["niche", "broad"]).optional(),
  productService: z.string().optional(),
  customerFeedback: z.string().optional(),
  website: z.string().optional(),
  businessLocation: z.string().optional(),
  primaryCustomerType: z.string().optional(),
  primarySalesChannel: z.string().optional(),
  primaryBusinessGoal: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function AccountPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Fetch user profile data
  const { data: profile, isLoading, error } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
    enabled: !!user,
  });

  // Fetch subscription status
  const { data: subscriptionStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/user/subscription-status"],
    enabled: !!user,
  });

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !!user,
  });

  // Form setup
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: "",
    },
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      form.reset({
        username: profile.username,
      });
    }
  }, [profile, form]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return apiRequest("PUT", "/api/user/profile", data);
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Product form setup
  const productForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      short_description: "",
      businessType: "product",
      businessDescription: "",
      targetCustomers: "",
      uniqueAttributes: [],
      marketNiche: "niche",
      productService: "",
      customerFeedback: "",
      website: "",
      businessLocation: "",
      primaryCustomerType: "",
      primarySalesChannel: "",
      primaryBusinessGoal: "",
    },
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      return apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      toast({
        title: "Product created",
        description: "Your product has been created successfully.",
      });
      setShowProductForm(false);
      setEditingProduct(null);
      productForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Creation failed",
        description: error.message || "Failed to create product. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async (data: ProductFormData & { id: number }) => {
      const { id, ...productData } = data;
      return apiRequest("PUT", `/api/products/${id}`, productData);
    },
    onSuccess: () => {
      toast({
        title: "Product updated",
        description: "Your product has been updated successfully.",
      });
      setShowProductForm(false);
      setEditingProduct(null);
      productForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update product. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest("DELETE", `/api/products/${productId}`);
    },
    onSuccess: () => {
      toast({
        title: "Product deleted",
        description: "Your product has been deleted successfully.",
      });
      setProductToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Deletion failed",
        description: error.message || "Failed to delete product. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Clone product mutation
  const cloneProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest("POST", `/api/products/${productId}/clone`);
    },
    onSuccess: () => {
      toast({
        title: "Product cloned",
        description: "Your product has been cloned successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Clone failed",
        description: error.message || "Failed to clone product. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    updateProfileMutation.mutate(data);
  });

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (profile) {
      form.reset({
        username: profile.username,
      });
    }
  };

  // Product handlers
  const handleNewProduct = () => {
    setEditingProduct(null);
    productForm.reset();
    setShowProductForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    productForm.reset({
      name: product.name || "",
      short_description: product.short_description || "",
      businessType: product.businessType,
      businessDescription: product.businessDescription,
      targetCustomers: product.targetCustomers,
      uniqueAttributes: Array.isArray(product.uniqueAttributes) 
        ? product.uniqueAttributes.join('\n') 
        : product.uniqueAttributes || "",
      marketNiche: product.marketNiche,
      productService: product.productService || "",
      customerFeedback: product.customerFeedback || "",
      website: product.website || "",
      businessLocation: product.businessLocation || "",
      primaryCustomerType: product.primaryCustomerType || "",
      primarySalesChannel: product.primarySalesChannel || "",
      primaryBusinessGoal: product.primaryBusinessGoal || "",
    });
    setShowProductForm(true);
  };

  const handleCloneProduct = (product: Product) => {
    cloneProductMutation.mutate(product.id);
  };

  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product);
  };

  const confirmDeleteProduct = () => {
    if (productToDelete) {
      deleteProductMutation.mutate(productToDelete.id);
    }
  };

  const onSubmitProduct = productForm.handleSubmit(async (data) => {
    // Convert uniqueAttributes from string to array
    const processedData = {
      ...data,
      uniqueAttributes: data.uniqueAttributes 
        ? data.uniqueAttributes.split('\n').filter(attr => attr.trim()).map(attr => attr.trim())
        : []
    };

    if (editingProduct) {
      updateProductMutation.mutate({ ...processedData, id: editingProduct.id });
    } else {
      createProductMutation.mutate(processedData);
    }
  });

  const handleCancelProductForm = () => {
    setShowProductForm(false);
    setEditingProduct(null);
    productForm.reset();
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">
          Please log in to view your account.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">
          Loading account information...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-destructive">
          Failed to load account information. Please try again.
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const generateEmailLink = (action: string, plan?: string) => {
    let subject, actionText, requestedAction;
    
    if (action === 'cancel') {
      subject = 'Request Subscription Cancellation';
      actionText = 'cancel';
      requestedAction = 'Cancellation';
    } else if (action === 'downgrade') {
      subject = `Request Downgrade to ${plan} Plan`;
      actionText = 'downgrade';
      requestedAction = `Downgrade to ${plan}`;
    } else {
      subject = `Request Upgrade to ${plan} Plan`;
      actionText = 'upgrade';
      requestedAction = `Upgrade to ${plan}`;
    }
    
    const body = encodeURIComponent(
      `Hello 5Ducks Support,

I would like to ${actionText} my subscription.

Account Email: ${profile?.email}
Current Plan: ${subscriptionStatus?.planDisplayName || 'Not subscribed'}
Requested Action: ${requestedAction}

Please process this request and let me know if you need any additional information.

Best regards,
${profile?.username}`
    );
    
    return `mailto:support@5ducks.ai?subject=${encodeURIComponent(subject)}&body=${body}`;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>
              Your personal information and account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Name</Label>
                  {isEditing ? (
                    <Input
                      id="username"
                      {...form.register("username")}
                      placeholder="Enter your name"
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{profile?.username}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                  {form.formState.errors.username && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="text-sm font-medium text-muted-foreground">
                    {profile?.email}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contact support to change your email address
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Member Since</Label>
                <div className="text-sm font-medium text-muted-foreground">
                  {profile?.createdAt ? formatDate(profile.createdAt) : "N/A"}
                </div>
              </div>

              {isEditing && (
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Products Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              My Products
            </CardTitle>
            <CardDescription>
              Manage the products and services you sell. Each product can have its own strategy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading products...
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No products yet. Create your first product to get started.</p>
                <Button onClick={handleNewProduct}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Product
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {products.length} product{products.length !== 1 ? 's' : ''}
                  </p>
                  <Button onClick={handleNewProduct} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Product
                  </Button>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <Card key={product.id} className="relative">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <CardTitle className="text-lg">
                              {product.name || `${product.businessType === 'product' ? 'Product' : 'Service'} ${product.id}`}
                            </CardTitle>
                            {product.short_description && (
                              <CardDescription className="text-sm line-clamp-2">
                                {product.short_description}
                              </CardDescription>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCloneProduct(product)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Clone
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteProduct(product)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Type:</span>
                            <span className="capitalize text-muted-foreground">{product.businessType}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="font-medium">Description:</span>
                            <p className="text-muted-foreground line-clamp-3 text-xs">
                              {product.businessDescription}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <span className="font-medium">Target Customers:</span>
                            <p className="text-muted-foreground line-clamp-2 text-xs">
                              {product.targetCustomers}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 pt-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              product.status === 'completed' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {product.status === 'completed' ? 'Complete' : 'In Progress'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing
            </CardTitle>
            <CardDescription>
              Payment methods and billing history
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Plan */}
            <div className="space-y-2">
              <Label>Current Plan</Label>
              <div className="text-sm font-medium">
                {subscriptionStatus?.planDisplayName || 'Not subscribed'}
              </div>
            </div>

            {/* Subscription Actions */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Subscription Actions</Label>
                <p className="text-xs text-muted-foreground">
                  Click to send email requests to support
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open(generateEmailLink('downgrade', 'The Duckling'))}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Downgrade to "The Duckling"
                  <ExternalLink className="ml-auto h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.open(generateEmailLink('upgrade', 'Mama Duck'))}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Upgrade to "Mama Duck"
                  <ExternalLink className="ml-auto h-4 w-4" />
                </Button>

                {subscriptionStatus?.isSubscribed && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={() => window.open(generateEmailLink('cancel'))}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Cancel Subscription
                    <ExternalLink className="ml-auto h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Form Dialog */}
      <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : "Let's get to know your business"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Update your product or service details.' : 'Just a few quick questions to create your strategy'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={onSubmitProduct} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Product/Service Information</h3>
                <p className="text-sm text-muted-foreground">Tell us about what you sell</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name (Optional)</Label>
                  <Input
                    id="name"
                    {...productForm.register("name")}
                    placeholder="My Product Name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="businessType">Type</Label>
                  <Select
                    value={productForm.watch("businessType")}
                    onValueChange={(value: "product" | "service") => 
                      productForm.setValue("businessType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="short_description">Short Description (Optional)</Label>
                <Input
                  id="short_description"
                  {...productForm.register("short_description")}
                  placeholder="Brief description for the product card"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessDescription">What is the product/service you sell? *</Label>
                <p className="text-sm text-muted-foreground">Describe it in 1 sentence</p>
                <Textarea
                  id="businessDescription"
                  {...productForm.register("businessDescription")}
                  placeholder="Premium coffee machines for small offices..."
                  rows={3}
                />
                {productForm.formState.errors.businessDescription && (
                  <p className="text-sm text-destructive">
                    {productForm.formState.errors.businessDescription.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="productService">Product/Service Details</Label>
                <Textarea
                  id="productService"
                  {...productForm.register("productService")}
                  placeholder="Detailed features, specifications, or service offerings"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="uniqueAttributes">What makes your product/service unique?</Label>
                <p className="text-sm text-muted-foreground">What differentiates you from competitors?</p>
                <Textarea
                  id="uniqueAttributes"
                  {...productForm.register("uniqueAttributes")}
                  placeholder="Fast delivery and easy setup..."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Enter each unique attribute on a separate line or comma-separated
                </p>
              </div>
            </div>

            {/* Market & Customers */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Customer Information</h3>
                <p className="text-sm text-muted-foreground">Who do you sell to and what do they like?</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetCustomers">Example of a type of business you service or sell to *</Label>
                <p className="text-sm text-muted-foreground">Like this "[type of business] in [city/niche]"</p>
                <Textarea
                  id="targetCustomers"
                  {...productForm.register("targetCustomers")}
                  placeholder="Popular cafes in Lower East Side, NYC"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Examples: "Popular cafes in Lower East Side, NYC" or "Real-estate insurance brokers in Salt Lake City"
                </p>
                {productForm.formState.errors.targetCustomers && (
                  <p className="text-sm text-destructive">
                    {productForm.formState.errors.targetCustomers.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="marketNiche">Market Focus</Label>
                  <Select
                    value={productForm.watch("marketNiche") || "niche"}
                    onValueChange={(value: "niche" | "broad") => 
                      productForm.setValue("marketNiche", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="niche">Niche Market</SelectItem>
                      <SelectItem value="broad">Broad Market</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryCustomerType">Primary Customer Type</Label>
                  <Input
                    id="primaryCustomerType"
                    {...productForm.register("primaryCustomerType")}
                    placeholder="e.g., Small businesses, Enterprises, Consumers"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerFeedback">What do customers say they like?</Label>
                <p className="text-sm text-muted-foreground">What is one thing customers like about your product or the way you sell it?</p>
                <Textarea
                  id="customerFeedback"
                  {...productForm.register("customerFeedback")}
                  placeholder="Fast delivery and easy setup..."
                  rows={2}
                />
              </div>
            </div>

            {/* Business Operations */}
            <div className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="text-lg font-semibold">Additional Details</h3>
                <p className="text-sm text-muted-foreground">Optional information to enhance your strategy</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessLocation">Business Location</Label>
                  <Input
                    id="businessLocation"
                    {...productForm.register("businessLocation")}
                    placeholder="City, State/Country"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Where can we learn more?</Label>
                  <p className="text-sm text-muted-foreground">Do you have a website, or any page online (Etsy, FB, or any link) that explains your product/service?</p>
                  <Input
                    id="website"
                    {...productForm.register("website")}
                    placeholder="Example: https://mycompany.com or https://etsy.com/shop/mystore"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primarySalesChannel">Primary Sales Channel</Label>
                  <Input
                    id="primarySalesChannel"
                    {...productForm.register("primarySalesChannel")}
                    placeholder="e.g., Online, Direct Sales, Retail"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primaryBusinessGoal">Primary Business Goal</Label>
                  <Input
                    id="primaryBusinessGoal"
                    {...productForm.register("primaryBusinessGoal")}
                    placeholder="e.g., Scale revenue, Enter new markets, Improve efficiency"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelProductForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProductMutation.isPending || updateProductMutation.isPending}
              >
                {createProductMutation.isPending || updateProductMutation.isPending
                  ? (editingProduct ? "Updating..." : "Creating...")
                  : (editingProduct ? "Update Product" : "Create Product")
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name || `Product ${productToDelete?.id}`}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}