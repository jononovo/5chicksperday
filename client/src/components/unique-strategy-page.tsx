import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Target, 
  Calendar, 
  Search, 
  Mail, 
  Copy, 
  Download, 
  Edit,
  CheckCircle,
  Clock,
  ExternalLink,
  Play,
  Eye,
  Users,
  BarChart3,
  Lightbulb,
  Zap,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

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

interface UniqueStrategyPageProps {
  product: StrategicProfile;
  onClose: () => void;
}

export function UniqueStrategyPage({ product, onClose }: UniqueStrategyPageProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Scroll state for tabs
  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const parseJsonSafely = (jsonString: string | undefined) => {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  };

  const parseArraySafely = (arrayString: string | undefined) => {
    if (!arrayString) return [];
    try {
      return JSON.parse(arrayString);
    } catch {
      return [];
    }
  };

  const copyToClipboard = (text: string, description: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: `${description} copied successfully`,
    });
  };

  // Scroll position detection
  const checkScrollPosition = useCallback(() => {
    const element = tabsRef.current;
    if (!element) return;

    setCanScrollLeft(element.scrollLeft > 0);
    setCanScrollRight(
      element.scrollLeft < element.scrollWidth - element.clientWidth
    );
  }, []);

  // Scroll function
  const scroll = useCallback((direction: 'left' | 'right') => {
    const element = tabsRef.current;
    if (!element) return;

    const scrollAmount = 200;
    element.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }, []);

  // Set up scroll event listener
  useEffect(() => {
    checkScrollPosition();
    const element = tabsRef.current;
    if (element) {
      element.addEventListener('scroll', checkScrollPosition);
      window.addEventListener('resize', checkScrollPosition);
      return () => {
        element.removeEventListener('scroll', checkScrollPosition);
        window.removeEventListener('resize', checkScrollPosition);
      };
    }
  }, [checkScrollPosition]);

  const handleExecuteQuery = (query: string) => {
    // Navigate to search page with the query
    navigate(`/?query=${encodeURIComponent(query)}`);
  };

  const productSummary = parseJsonSafely(product.productAnalysisSummary);
  const salesContext = parseJsonSafely(product.reportSalesContextGuidance);
  const salesTargeting = parseJsonSafely(product.reportSalesTargetingGuidance);
  const dailyQueries = parseArraySafely(product.dailySearchQueries);

  return (
    <div className="bg-slate-50">
      {/* Main Product Section */}
      <div className="bg-white border-b border-slate-200 px-6 pt-6 pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-medium">
                {product.businessType === 'product' ? '📦' : '🛠️'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
              <div className="flex items-center gap-3 mt-1">
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
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-7">
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Edit Strategy</span>
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Export</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-6 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="relative flex items-center">
            {canScrollLeft && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-sm"
                onClick={() => scroll('left')}
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            
            <TabsList 
              ref={tabsRef}
              className="inline-flex w-full overflow-x-auto gap-1 scrollbar-hide justify-start"
            >
              <TabsTrigger value="overview" className="flex-shrink-0 whitespace-nowrap px-4 py-2">
                Overview
              </TabsTrigger>
              <TabsTrigger value="strategy" className="flex-shrink-0 whitespace-nowrap px-4 py-2">
                Strategy & Boundary
              </TabsTrigger>
              <TabsTrigger value="implementation" className="flex-shrink-0 whitespace-nowrap px-4 py-2">
                Implementation
              </TabsTrigger>
            </TabsList>

            {canScrollRight && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-sm"
                onClick={() => scroll('right')}
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-3 sm:mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
              <Card>
                <CardHeader className="px-3 py-6 sm:px-6">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Strategic Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-3 py-6 pt-0 sm:px-6">
                  <div>
                    <h4 className="font-medium text-slate-900 mb-1">Product/Service</h4>
                    <p className="text-sm text-slate-600">{product.productService}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-slate-900 mb-1">Customer Feedback</h4>
                    <p className="text-sm text-slate-600">{product.customerFeedback}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-slate-900 mb-1">Website</h4>
                    <a 
                      href={product.website.startsWith('http') ? product.website : `https://${product.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      {product.website}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  
                  {product.strategyHighLevelBoundary && (
                    <div>
                      <h4 className="font-medium text-slate-900 mb-1">Strategic Boundary</h4>
                      <p className="text-sm text-slate-600">{product.strategyHighLevelBoundary}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium text-slate-900 mb-1">Business Type</h4>
                    <p className="text-sm text-slate-600">
                      {product.businessType === 'product' ? '📦 Product' : '🛠️ Service'}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-900 mb-1">Created</h4>
                    <p className="text-sm text-slate-600">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-3 py-6 sm:px-6">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Implementation Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 py-6 pt-0 sm:px-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Product Analysis</span>
                      <Badge variant={product.productAnalysisSummary ? 'default' : 'secondary'}>
                        {product.productAnalysisSummary ? 'Complete' : 'Pending'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Strategic Boundary</span>
                      <Badge variant={product.strategyHighLevelBoundary ? 'default' : 'secondary'}>
                        {product.strategyHighLevelBoundary ? 'Complete' : 'Pending'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Daily Queries</span>
                      <Badge variant={product.dailySearchQueries ? 'default' : 'secondary'}>
                        {product.dailySearchQueries ? 'Complete' : 'Pending'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Sales Approach</span>
                      <Badge variant={product.reportSalesContextGuidance ? 'default' : 'secondary'}>
                        {product.reportSalesContextGuidance ? 'Complete' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="lg:col-span-2">
                <CardHeader className="px-3 py-6 sm:px-6">
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5" />
                    Product Analysis Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 py-6 pt-0 sm:px-6">
                  {productSummary ? (
                    <div className="space-y-4">
                      <div className="prose max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: productSummary.content.replace(/\n/g, '<br>') }} />
                      </div>
                      
                      <div className="flex items-center gap-2 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(productSummary.content, 'Product analysis')}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Analysis
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                      <p>Product analysis not yet generated</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Strategy & Boundary Tab */}
          <TabsContent value="strategy" className="mt-3 sm:mt-6">
            <div className="space-y-3 sm:space-y-6">
              <Card>
                <CardHeader className="px-3 py-6 sm:px-6">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Strategic Boundary
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 py-6 pt-0 sm:px-6">
                  {product.strategyHighLevelBoundary ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-lg font-medium text-blue-900">
                          {product.strategyHighLevelBoundary}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(product.strategyHighLevelBoundary!, 'Strategic boundary')}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Boundary
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Target className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                      <p>Strategic boundary not yet defined</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-3 py-6 sm:px-6">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Sprint Planning Prompt
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 py-6 pt-0 sm:px-6">
                  {product.exampleSprintPlanningPrompt ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {product.exampleSprintPlanningPrompt}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(product.exampleSprintPlanningPrompt!, 'Sprint planning prompt')}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Prompt
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                      <p>Sprint planning prompt not yet generated</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-3 py-6 sm:px-6">
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Sales Context Guidance
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 py-6 pt-0 sm:px-6">
                  {salesContext ? (
                    <div className="space-y-4">
                      <div className="prose max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: salesContext.content.replace(/\n/g, '<br>') }} />
                      </div>
                      
                      <div className="flex items-center gap-2 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(salesContext.content, 'Sales context guidance')}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Guidance
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Mail className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                      <p>Sales context guidance not yet generated</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Implementation Tab (formerly Daily Queries) */}
          <TabsContent value="implementation" className="mt-3 sm:mt-6">
            <Card>
              <CardHeader className="px-3 py-6 sm:px-6">
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Daily Search Queries
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 py-6 pt-0 sm:px-6">
                {dailyQueries.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {dailyQueries.map((query: string, index: number) => (
                        <div key={index} className="p-4 bg-slate-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium text-slate-500">
                                  Query {index + 1}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 font-medium">{query}</p>
                            </div>
                            
                            <div className="flex items-center gap-1 ml-3">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleExecuteQuery(query)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => copyToClipboard(query, 'Search query')}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-slate-600">
                        {dailyQueries.length} search queries ready for execution
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(dailyQueries.join('\n'), 'All search queries')}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy All Queries
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Search className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p>Daily search queries not yet generated</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}