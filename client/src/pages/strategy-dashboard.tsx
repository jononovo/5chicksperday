import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Target, 
  Calendar, 
  Plus,
  Eye,
  AlertCircle,
  Zap,
  Users,
  Mail,
  FileText,
  CheckCircle,
  Clock,
  Search,
  MoreVertical,
  Trash2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { SEOHead } from "@/components/ui/seo-head";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UniqueStrategyPage } from "@/components/unique-strategy-page";
import { useStrategyOverlay } from "@/lib/strategy-overlay-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface StrategicProfile {
  id: number;
  name: string;
  businessType: string;
  status: string;
  productService: string;
  customerFeedback: string;
  website: string;
  createdAt: string;
  productAnalysisSummary?: string;
  strategyHighLevelBoundary?: string;
  exampleSprintPlanningPrompt?: string;
  dailySearchQueries?: string;
  reportSalesContextGuidance?: string;
  reportSalesTargetingGuidance?: string;
}

export default function StrategyDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { setState } = useStrategyOverlay();
  const [selectedProduct, setSelectedProduct] = useState<StrategicProfile | null>(null);
  const [showUniqueStrategy, setShowUniqueStrategy] = useState(false);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<StrategicProfile | null>(null);
  const { toast } = useToast();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  const { data: products = [], isLoading, error } = useQuery<StrategicProfile[]>({
    queryKey: ['/api/products'],
    enabled: !!user,
  });

  const handleProductClick = (product: StrategicProfile) => {
    setSelectedProduct(product);
    setShowUniqueStrategy(true);
  };

  const handleCloseUniqueStrategy = () => {
    setShowUniqueStrategy(false);
    setSelectedProduct(null);
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (productId: number) => {
      const response = await apiRequest("DELETE", `/api/strategic-profiles/${productId}`);
      if (!response.ok) {
        throw new Error('Failed to delete strategy');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch products
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Strategy Deleted",
        description: "Your strategy has been permanently removed.",
      });
      setDeleteConfirmProduct(null);
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete strategy. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteConfirm = () => {
    if (deleteConfirmProduct) {
      deleteMutation.mutate(deleteConfirmProduct.id);
    }
  };

  const handleMenuAction = (e: React.MouseEvent, action: string, product: StrategicProfile) => {
    e.stopPropagation(); // Prevent card click
    
    if (action === 'view') {
      handleProductClick(product);
    } else if (action === 'delete') {
      setDeleteConfirmProduct(product);
    }
  };



  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your strategies...</p>
        </div>
      </div>
    );
  }

  // Show error message within the normal layout instead of replacing entire page
  const hasError = error !== null;

  return (
    <>
      <SEOHead 
        title="Strategic Dashboard | 5Ducks"
        description="Manage your strategic sales plans, track progress, and execute 90-day implementation roadmaps"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Strategic Plans Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">My Products</h2>
              <Button 
                onClick={() => setState('sidebar')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Create Strategy</span>
              </Button>
            </div>

            {hasError ? (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Error Loading Strategies</h3>
                  <p className="text-slate-600 mb-6 max-w-md mx-auto">
                    Unable to load your strategic plans. Please try again.
                  </p>
                  <Button 
                    onClick={() => window.location.reload()}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : products.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No Strategic Plans Yet</h3>
                  <p className="text-slate-600 mb-6 max-w-md mx-auto">
                    Create your first strategic plan to start building your 90-day sales execution roadmap
                  </p>
                  <Button 
                    onClick={() => setState('sidebar')}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Plus className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">Create Your First Strategy</span>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product: StrategicProfile) => (
                  <Card 
                    key={product.id} 
                    className="group hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                    onClick={() => handleProductClick(product)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {product.businessType === 'product' ? '📦' : '🛠️'}
                            </span>
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {product.name}
                            </CardTitle>
                            <p className="text-sm text-slate-500 capitalize">
                              {product.businessType}
                            </p>
                          </div>
                        </div>
                        
                        <Badge 
                          variant={product.status === 'completed' ? 'default' : 'secondary'}
                          className={`${
                            product.status === 'completed' 
                              ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                          }`}
                        >
                          {product.status === 'completed' ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Complete
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              In Progress
                            </>
                          )}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium text-slate-900 mb-1">Product/Service</h4>
                          <p className="text-sm text-slate-600 line-clamp-2">{product.productService}</p>
                        </div>
                        
                        {product.strategyHighLevelBoundary && (
                          <div>
                            <h4 className="text-sm font-medium text-slate-900 mb-1">Strategic Focus</h4>
                            <p className="text-sm text-slate-600 line-clamp-1">{product.strategyHighLevelBoundary}</p>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(product.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {product.status === 'completed' && (
                              <>
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <Mail className="h-3 w-3" />
                                  <span>Email Strategy</span>
                                </div>
                              </>
                            )}
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem 
                                  onClick={(e) => handleMenuAction(e, 'view', product)}
                                  className="cursor-pointer"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => handleMenuAction(e, 'delete', product)}
                                  className="cursor-pointer text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Strategy
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {products.length > 0 && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button variant="outline" className="justify-start h-auto p-4">
                      <div className="flex items-center gap-3">
                        <Search className="h-5 w-5 text-blue-600" />
                        <div className="text-left">
                          <div className="font-medium">Execute Daily Queries</div>
                          <div className="text-sm text-slate-500">Run your strategic search prompts</div>
                        </div>
                      </div>
                    </Button>
                    
                    <Button variant="outline" className="justify-start h-auto p-4">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-green-600" />
                        <div className="text-left">
                          <div className="font-medium">Review Contacts</div>
                          <div className="text-sm text-slate-500">Check discovered prospects</div>
                        </div>
                      </div>
                    </Button>
                    
                    <Button variant="outline" className="justify-start h-auto p-4">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-purple-600" />
                        <div className="text-left">
                          <div className="font-medium">Start Outreach</div>
                          <div className="text-sm text-slate-500">Begin email campaigns</div>
                        </div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 90-Day Implementation Timeline */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  90-Day Implementation Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Days 1-30</h4>
                      <p className="text-sm text-blue-700">Setup & Initial Outreach</p>
                      <ul className="text-xs text-blue-600 mt-2 space-y-1">
                        <li>• Execute daily search queries</li>
                        <li>• Build contact database</li>
                        <li>• Begin email campaigns</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">Days 31-60</h4>
                      <p className="text-sm text-green-700">Scale & Optimize</p>
                      <ul className="text-xs text-green-600 mt-2 space-y-1">
                        <li>• Analyze response rates</li>
                        <li>• Refine messaging</li>
                        <li>• Scale successful campaigns</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium text-purple-900 mb-2">Days 61-90</h4>
                      <p className="text-sm text-purple-700">Maximize & Measure</p>
                      <ul className="text-xs text-purple-600 mt-2 space-y-1">
                        <li>• Full campaign execution</li>
                        <li>• ROI measurement</li>
                        <li>• Strategy refinement</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmProduct} onOpenChange={() => setDeleteConfirmProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Strategy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmProduct?.name}"? This action cannot be undone and will permanently remove this strategy from your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 focus:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                'Delete Strategy'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unique Strategy Page Dialog */}
      <Dialog open={showUniqueStrategy} onOpenChange={setShowUniqueStrategy}>
        <DialogContent className="top-0 h-screen translate-y-0 rounded-none md:top-[50%] md:max-h-[90vh] md:translate-y-[-50%] md:rounded-lg max-w-6xl p-0 flex flex-col [&>*[class*='opacity-70']]:hidden">
          <button
            onClick={handleCloseUniqueStrategy}
            className="absolute top-2 right-2 z-50 p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <svg className="h-6 w-6 md:h-7 md:w-7 text-gray-500 hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="flex-1 overflow-y-auto">
            {selectedProduct && (
              <UniqueStrategyPage 
                product={selectedProduct} 
                onClose={handleCloseUniqueStrategy}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}