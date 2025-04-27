import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { SearchApproach } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, Search, Mail, Users, ArrowRight, RefreshCw, Bot, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { StrategyPerformanceChart } from "@/components/strategy-performance-chart";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TestResult {
  id: string;
  strategyName: string;
  strategyId: number;
  query: string;
  timestamp: string;
  companyQuality: number;
  contactQuality: number;
  emailQuality: number;
  overallScore: number;
  status: "completed" | "running" | "failed";
}

// Local storage key for persisting test results
const LOCAL_STORAGE_KEY = "searchTestResults_build";

// Local test results state 
interface TestResultsState {
  results: TestResult[];
}

export default function Build() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testQuery, setTestQuery] = useState<string>("");
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  // Local state for test results
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  
  // Load test results from localStorage on component mount
  useEffect(() => {
    try {
      const savedResults = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedResults) {
        console.log("Loading test results from localStorage");
        setTestResults(JSON.parse(savedResults));
      }
    } catch (err) {
      console.error("Error loading test results from localStorage:", err);
    }
  }, []);

  // Fetch search strategies
  const { data: strategies } = useQuery<SearchApproach[]>({
    queryKey: ["/api/search-approaches"],
  });
  
  // Fetch existing test results to populate local state
  const { data: dbTestResults, isLoading: isLoadingResults, refetch: refetchTestResults } = useQuery<TestResult[]>({
    queryKey: ["/api/search-test-results"],
  });
  
  // Process database results and update local state
  useEffect(() => {
    if (dbTestResults && Array.isArray(dbTestResults)) {
      // Initialize local state with database results
      console.log("Loaded test results from database:", dbTestResults.length);
      
      // Map database results to match the local TestResult interface
      const formattedResults = dbTestResults.map(result => ({
        id: result.testId || `test-${result.id}`,
        strategyId: result.strategyId,
        strategyName: result.metadata?.strategyName || "Unknown Strategy",
        query: result.query,
        companyQuality: result.companyQuality,
        contactQuality: result.contactQuality,
        emailQuality: result.emailQuality,
        overallScore: result.overallScore,
        status: result.status as "completed" | "running" | "failed",
        timestamp: result.createdAt || new Date().toISOString()
      }));
      
      // Only take the most recent 20 results to avoid performance issues
      const recentResults = formattedResults.slice(-20);
      
      // Save to localStorage and update state
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(recentResults));
        console.log("Saved database results to localStorage:", recentResults.length);
      } catch (err) {
        console.error("Error saving test results to localStorage:", err);
      }
      
      setTestResults(recentResults);
    }
  }, [dbTestResults]);
  
  // Handle query errors
  useEffect(() => {
    if (isLoadingResults === false && !dbTestResults) {
      console.error("Error loading test results");
      toast({
        title: "Error",
        description: "Failed to load saved test results.",
        variant: "destructive"
      });
    }
  }, [isLoadingResults, dbTestResults, toast]);

  // Initialize default strategies
  const initializeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/search-approaches/initialize", {});
      if (!res.ok) throw new Error("Failed to initialize strategies");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search-approaches"] });
      toast({
        title: "Success",
        description: "Default search strategies have been initialized.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to initialize search strategies.",
        variant: "destructive",
      });
    },
  });

  const generateScores = () => {
    // Function to generate a weighted score between 30-100 with a normal-ish distribution
    const generateScore = (strategyId: number, category: string) => {
      // Base random component
      const random = Math.random();
      
      // Create a weighted curve that favors mid-range scores (60-80)
      let baseScore = 40 + (random * 60);
      
      // Add strategy-specific adjustment (±15 points)
      const strategyFactor = ((strategyId * 13) % 31) / 31 * 30 - 15;
      
      // Add category-specific adjustment (±10 points)
      const categoryIndex = ['companyQuality', 'contactQuality', 'emailQuality'].indexOf(category);
      const categoryFactor = ((categoryIndex + 1) * 7 % 21) / 21 * 20 - 10;
      
      // Combine all factors and ensure within range
      let score = baseScore + strategyFactor + categoryFactor;
      return Math.min(Math.max(Math.round(score), 30), 100);
    };

    return {
      companyQuality: generateScore(parseInt(selectedStrategy), 'companyQuality'),
      contactQuality: generateScore(parseInt(selectedStrategy), 'contactQuality'),
      emailQuality: generateScore(parseInt(selectedStrategy), 'emailQuality')
    };
  };

  const runSearchTest = async () => {
    if (!testQuery || !selectedStrategy || isRunningTest) return;
    
    setIsRunningTest(true);
    
    // Show toast notification
    toast({
      title: "Starting search quality test",
      description: `Testing strategy for: "${testQuery}"`,
    });
    
    try {
      // Call the API to start the test
      const response = await apiRequest("POST", "/api/search-test", {
        strategyId: parseInt(selectedStrategy),
        query: testQuery
      });
      
      if (!response.ok) {
        throw new Error("API call failed");
      }
      
      // Parse the API response
      const data = await response.json();
      console.log('Search test API response:', data);
      
      // Extract scores from API response
      const scores = {
        companyQuality: data.metrics.companyQuality,
        contactQuality: data.metrics.contactQuality,
        emailQuality: data.metrics.emailQuality
      };
      
      // Use overall score returned from API or calculate it
      const overallScore = data.overallScore || 
        Math.round((scores.companyQuality + scores.contactQuality + scores.emailQuality) / 3);
      
      // Generate a valid UUID for the test
      const testUuid = crypto.randomUUID();
      
      // Get the strategy name
      const strategyName = strategies?.find(s => s.id.toString() === selectedStrategy)?.name || 'Unknown Strategy';
      
      // Create the test result object
      const newTestResult: TestResult = {
        id: testUuid,
        strategyId: parseInt(selectedStrategy),
        strategyName: strategyName,
        query: testQuery,
        companyQuality: scores.companyQuality,
        contactQuality: scores.contactQuality,
        emailQuality: scores.emailQuality,
        overallScore,
        status: "completed",
        timestamp: new Date().toISOString()
      };
      
      // Add to local state (newest first) and save to localStorage
      setTestResults(prev => {
        const updatedResults = [newTestResult, ...prev];
        // Save to localStorage
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedResults));
          console.log("Saved test results to localStorage:", updatedResults.length);
        } catch (err) {
          console.error("Error saving test results to localStorage:", err);
        }
        return updatedResults;
      });
      
      // Also save the result to the database for persistence
      try {
        console.log('Saving test result to database:', newTestResult);
        
        const dbResponse = await apiRequest("POST", "/api/search-test-results", {
          strategyId: parseInt(selectedStrategy),
          testId: testUuid, // This is a valid UUID generated by crypto.randomUUID()
          query: testQuery,
          companyQuality: scores.companyQuality,
          contactQuality: scores.contactQuality, 
          emailQuality: scores.emailQuality,
          overallScore,
          status: "completed" as const, // Enforce type safety
          metadata: {
            strategyName,
            timestamp: new Date().toISOString()
          }
        });
        
        if (!dbResponse.ok) {
          console.error('Failed to save test result to database:', await dbResponse.text());
        } else {
          console.log('Test result saved to database successfully');
          // Force a refresh of the test results display
          queryClient.invalidateQueries({ 
            queryKey: ["/api/search-test-results/strategy", selectedStrategy] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ["/api/search-test-results"] 
          });
        }
      } catch (dbError) {
        console.error('Error saving test result to database:', dbError);
      }
      
      toast({
        title: "Test completed",
        description: `Overall quality score: ${overallScore}/100`,
      });
    } catch (error) {
      toast({
        title: "Test failed",
        description: "There was an error running the search quality test.",
        variant: "destructive"
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  return (
    <div className="py-6 px-4 md:px-6 max-w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Search Testing & Benchmarking</h1>
          <p className="text-muted-foreground">
            Evaluate and compare search strategy performance
          </p>
        </div>
        <Button onClick={() => initializeMutation.mutate()}>
          Initialize Default Strategies
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 w-full">
        {/* Test Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Run Search Quality Test</CardTitle>
            <CardDescription>
              Test a search strategy against quality metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Test Query</label>
                <Input
                  placeholder="e.g., law firms in chicago"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Search Strategy</label>
                <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {strategies?.map((strategy) => (
                      <SelectItem key={strategy.id} value={strategy.id.toString()}>
                        {strategy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={runSearchTest} 
                  disabled={!testQuery || !selectedStrategy || isRunningTest}
                  className="w-full md:w-auto"
                >
                  {isRunningTest ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running Test
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Run Test
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Results Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Search Quality Benchmark Results</CardTitle>
              <CardDescription>
                Performance metrics for search strategies
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/search-test-results"] });
                toast({
                  title: "Refreshed",
                  description: "Test results have been refreshed from database.",
                });
              }}
              disabled={isLoadingResults}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", { "animate-spin": isLoadingResults })} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Test Query</TableHead>
                    <TableHead>
                      <div className="flex items-center">
                        <BarChart3 className="mr-1 h-4 w-4" />
                        Company Quality
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center">
                        <Users className="mr-1 h-4 w-4" />
                        Contact Quality
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center">
                        <Mail className="mr-1 h-4 w-4" />
                        Email Quality
                      </div>
                    </TableHead>
                    <TableHead>Overall Score</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isRunningTest && (
                    <TableRow>
                      <TableCell className="font-medium">{strategies?.find(s => s.id.toString() === selectedStrategy)?.name}</TableCell>
                      <TableCell>{testQuery}</TableCell>
                      <TableCell><Progress value={undefined} className="h-2 w-16" /></TableCell>
                      <TableCell><Progress value={undefined} className="h-2 w-16" /></TableCell>
                      <TableCell><Progress value={undefined} className="h-2 w-16" /></TableCell>
                      <TableCell><Loader2 className="h-4 w-4 animate-spin" /></TableCell>
                      <TableCell>Just now</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-600">Running</Badge>
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {/* Loading state when fetching initial results */}
                  {isLoadingResults && testResults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">Loading test results...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {/* Empty state when no results are available */}
                  {!isLoadingResults && testResults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <p className="text-sm text-muted-foreground">No test results yet. Run a test to see results here.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {/* Display test results from local state */}
                  {testResults.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="font-medium">{result.strategyName}</TableCell>
                      <TableCell>{result.query}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={result.companyQuality} className="h-2 w-16" />
                          <span className={getScoreColor(result.companyQuality)}>{result.companyQuality}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={result.contactQuality} className="h-2 w-16" />
                          <span className={getScoreColor(result.contactQuality)}>{result.contactQuality}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={result.emailQuality} className="h-2 w-16" />
                          <span className={getScoreColor(result.emailQuality)}>{result.emailQuality}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getScoreBadgeVariant(result.overallScore)}>
                          {result.overallScore}/100
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {result.timestamp ? new Date(result.timestamp).toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">
                          {result.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        
        {/* AI Agents API Documentation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Bot className="mr-2 h-5 w-5" />
                AI Agents API
              </CardTitle>
              <CardDescription>
                API documentation for AI agents to run search quality tests
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-600">
              <Code className="mr-2 h-4 w-4" />
              API
            </Badge>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
                <TabsTrigger value="examples">Examples</TabsTrigger>
                <TabsTrigger value="workflow">Workflow Search</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Purpose</h3>
                  <p className="text-muted-foreground">
                    The AI Agents API allows automated benchmarking of search strategies. AI agents can run tests, 
                    track performance over time, and make data-driven improvements to search configurations.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Key Features</h3>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>Run search quality tests programmatically</li>
                    <li>Receive detailed performance metrics (company, contact, email quality)</li>
                    <li>Track improvement over time with historical comparison</li>
                    <li>Get AI-friendly structured response format</li>
                  </ul>
                </div>
              </TabsContent>
              
              <TabsContent value="endpoints" className="space-y-4">
                <Accordion type="single" collapsible className="border rounded-md">
                  <AccordionItem value="endpoint-1">
                    <AccordionTrigger className="px-4">
                      <div className="flex items-center">
                        <Badge className="mr-2">POST</Badge>
                        <span className="font-mono text-sm">/api/agent/run-search-test</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 space-y-4">
                      <div>
                        <h4 className="font-medium mb-1">Description</h4>
                        <p className="text-muted-foreground">Runs a search quality test for a specific strategy and query, returning detailed metrics.</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-1">Request Body</h4>
                        <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-md text-sm font-mono overflow-x-auto">
{`{
  "strategyId": number,  // ID of the search strategy to test
  "query": string,       // The search query to test
  "saveToDatabase": boolean  // Optional, default: true
}`}
                        </pre>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-1">Response</h4>
                        <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-md text-sm font-mono overflow-x-auto">
{`{
  "currentTest": {
    "id": string,
    "strategyId": number,
    "strategyName": string,
    "query": string,
    "companyQuality": number,
    "contactQuality": number,
    "emailQuality": number,
    "overallScore": number,
    "status": "completed",
    "timestamp": string
  },
  "recentTests": [
    // Array of recent test results (same format as currentTest)
  ],
  "summary": {
    "strategyName": string,
    "averageOverallScore": number,
    "testCount": number,
    "latestScore": number,
    "improvement": string  // Percentage improvement from oldest to newest test
  }
}`}
                        </pre>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>
              
              <TabsContent value="examples" className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Example API Call</h3>
                  <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-md text-sm font-mono overflow-x-auto">
{`// Example: Running a search test using correct URL
// NOTE: Use the base domain of your application
// In Replit: https://your-repl-domain.replit.dev/api/agent/run-search-test

fetch('/api/agent/run-search-test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    strategyId: 10,  // ID of existing strategy
    query: "insurance brokers in hoboken"
  })
})
.then(response => response.json())
.then(data => {
  console.log('Test result:', data.currentTest);
  console.log('Overall score:', data.currentTest.overallScore);
  console.log('Improvement:', data.summary.improvement);
});`}
                  </pre>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">cURL Example</h3>
                  <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-md text-sm font-mono overflow-x-auto">
{`# Example: Running a search test with cURL
curl -X POST "https://your-repl-domain.replit.dev/api/agent/run-search-test" \\
  -H "Content-Type: application/json" \\
  -d '{"strategyId": 10, "query": "law firms in boston"}'`}
                  </pre>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Automated Benchmarking Workflow</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                    <li>Run baseline test with default strategy configuration</li>
                    <li>Make targeted improvements to search strategy</li>
                    <li>Run follow-up test with the same query</li>
                    <li>Compare results to measure improvement</li>
                    <li>Continue iterating to optimize performance</li>
                  </ol>
                </div>
              </TabsContent>
              
              <TabsContent value="workflow" className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Workflow-Based Search</h3>
                  <p className="text-muted-foreground mb-4">
                    This feature allows you to use external workflow automation services to run complex search operations.
                    Results will be delivered asynchronously via webhook callbacks and stored in your database.
                  </p>
                </div>
                
                {/* Import the WorkflowSearchTrigger component */}
                <div className="mt-4">
                  {React.createElement(
                    React.lazy(() => import("@/components/workflow-search-trigger")), 
                    { key: "workflow-search-trigger" }
                  )}
                </div>
                
                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-2">How It Works</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                    <li>You enter a search query and select a search strategy</li>
                    <li>The query is sent to an external workflow automation service</li>
                    <li>The workflow processes your search using advanced strategies</li>
                    <li>Results are delivered back to 5 Ducks via webhook</li>
                    <li>Companies and contacts are stored in your database</li>
                  </ol>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Strategy Performance History Chart */}
        <StrategyPerformanceChart 
          strategyId={selectedStrategy || null}
          name={strategies?.find(s => s.id.toString() === selectedStrategy)?.name}
        />
      </div>
    </div>
  );
}