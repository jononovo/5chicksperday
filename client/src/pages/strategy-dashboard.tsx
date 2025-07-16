import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Target, 
  Calendar, 
  Search,
  Plus,
  Eye,
  AlertCircle,
  Zap,
  Users,
  Mail,
  FileText,
  CheckCircle,
  Clock
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { SEOHead } from "@/components/ui/seo-head";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UniqueStrategyPage } from "@/components/unique-strategy-page";

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
  const [selectedProduct, setSelectedProduct] = useState<StrategicProfile | null>(null);
  const [showUniqueStrategy, setShowUniqueStrategy] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  const { data: products = [], isLoading, error } = useQuery({
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

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Error Loading Strategies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">Unable to load your strategic plans. Please try again.</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEOHead 
        title="Strategic Dashboard | 5Ducks"
        description="Manage your strategic sales plans, track progress, and execute 90-day implementation roadmaps"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">Strategic Dashboard</h1>
                  <p className="text-sm text-slate-600">Plan, execute, and track your 90-day sales strategies</p>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate("/planning")}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Strategy
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Strategic Plans Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Your Strategic Plans</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <Input 
                    placeholder="Search strategies..." 
                    className="pl-10 w-64" 
                  />
                </div>
              </div>
            </div>

            {products.length === 0 ? (
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
                    onClick={() => navigate("/planning")}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Strategy
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
                                  <Search className="h-3 w-3" />
                                  <span>Queries Ready</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <Mail className="h-3 w-3" />
                                  <span>Email Strategy</span>
                                </div>
                              </>
                            )}
                            
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
        </div>
      </div>

      {/* Unique Strategy Page Dialog */}
      <Dialog open={showUniqueStrategy} onOpenChange={setShowUniqueStrategy}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Strategic Plan: {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>
          
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