import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus,
  Eye,
  CheckCircle,
  Clock,
  FileText,
  Target,
  Calendar,
  Package
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { UniqueStrategyPage } from "@/components/unique-strategy-page";
import { useStrategyOverlay } from "@/lib/strategy-overlay-context";

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

export function MyProducts() {
  const { user } = useAuth();
  const { setState } = useStrategyOverlay();
  const [selectedProduct, setSelectedProduct] = useState<StrategicProfile | null>(null);
  const [showUniqueStrategy, setShowUniqueStrategy] = useState(false);

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

  const handleCreateStrategy = () => {
    setState('sidebar');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            My Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            My Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600">Failed to load products. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            My Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No products yet
              </h3>
              <p className="text-slate-600 mb-4">
                Create your first strategic product to get started with targeted outreach campaigns.
              </p>
              <Button onClick={handleCreateStrategy} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                <Plus className="h-4 w-4 mr-2" />
                Create Strategy
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  {products.length} product{products.length !== 1 ? 's' : ''}
                </p>
                <Button onClick={handleCreateStrategy} size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Strategy
                </Button>
              </div>
              
              <div className="grid gap-4">
                {products.map((product: StrategicProfile) => (
                  <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-medium">
                              {product.businessType === 'product' ? '📦' : '🛠️'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 mb-1">{product.name}</h3>
                            <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                              {product.productService}
                            </p>
                            <div className="flex items-center gap-2 mb-2">
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
                              <span className="text-xs text-slate-500">
                                {product.businessType === 'product' ? '📦 Product' : '🛠️ Service'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Calendar className="h-3 w-3" />
                              Created {new Date(product.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleProductClick(product)}
                          className="flex-shrink-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Detail Modal */}
      <Dialog open={showUniqueStrategy} onOpenChange={handleCloseUniqueStrategy}>
        <DialogContent className="max-w-4xl w-full mx-auto p-0 flex flex-col top-0 h-screen translate-y-0 rounded-none md:top-[50%] md:max-h-[90vh] md:translate-y-[-50%] md:rounded-lg [&>*[class*='opacity-70']]:hidden">
          {selectedProduct && (
            <UniqueStrategyPage
              product={selectedProduct}
              onClose={handleCloseUniqueStrategy}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}