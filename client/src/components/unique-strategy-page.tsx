import { useState } from "react";
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
  Zap
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

  const handleExecuteQuery = (query: string) => {
    // Navigate to search page with the query
    navigate(`/?query=${encodeURIComponent(query)}`);
  };

  const productSummary = parseJsonSafely(product.productAnalysisSummary);
  const salesContext = parseJsonSafely(product.reportSalesContextGuidance);
  const salesTargeting = parseJsonSafely(product.reportSalesTargetingGuidance);
  const dailyQueries = parseArraySafely(product.dailySearchQueries);

  return (
    <div className="h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6">
        <div className="flex items-center justify-between">
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
                <span className="text-sm text-slate-500 capitalize">
                  {product.businessType} Strategy
                </span>
                <span className="text-sm text-slate-500">
                  Created {new Date(product.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit Strategy
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="product">Product Analysis</TabsTrigger>
            <TabsTrigger value="strategy">Strategy & Boundary</TabsTrigger>
            <TabsTrigger value="queries">Daily Queries</TabsTrigger>
            <TabsTrigger value="sales">Sales Approach</TabsTrigger>
            <TabsTrigger value="implementation">Implementation</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Strategic Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Implementation Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
            </div>
          </TabsContent>

          {/* Product Analysis Tab */}
          <TabsContent value="product" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Product Analysis Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
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
          </TabsContent>

          {/* Strategy & Boundary Tab */}
          <TabsContent value="strategy" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Strategic Boundary
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Sprint Planning Prompt
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
            </div>
          </TabsContent>

          {/* Daily Queries Tab */}
          <TabsContent value="queries" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Daily Search Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyQueries.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Sales Approach Tab */}
          <TabsContent value="sales" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Sales Context Guidance
                  </CardTitle>
                </CardHeader>
                <CardContent>
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

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Sales Targeting Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {salesTargeting ? (
                    <div className="space-y-4">
                      <div className="prose max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: salesTargeting.content.replace(/\n/g, '<br>') }} />
                      </div>
                      
                      <div className="flex items-center gap-2 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(salesTargeting.content, 'Sales targeting strategy')}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Strategy
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                      <p>Sales targeting strategy not yet generated</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Implementation Tab */}
          <TabsContent value="implementation" className="mt-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button 
                      variant="outline" 
                      className="justify-start h-auto p-4"
                      onClick={() => navigate("/")}
                    >
                      <div className="flex items-center gap-3">
                        <Search className="h-5 w-5 text-blue-600" />
                        <div className="text-left">
                          <div className="font-medium">Execute Search Queries</div>
                          <div className="text-sm text-slate-500">Run your strategic search prompts</div>
                        </div>
                      </div>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="justify-start h-auto p-4"
                      onClick={() => navigate("/outreach")}
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-green-600" />
                        <div className="text-left">
                          <div className="font-medium">Start Email Outreach</div>
                          <div className="text-sm text-slate-500">Begin your sales campaigns</div>
                        </div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}