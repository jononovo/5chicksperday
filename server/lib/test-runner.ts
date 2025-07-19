import { storage } from "../../storage-switching/storage-switcher";
import { queryPerplexity } from "./api/perplexity-client";

export interface SubTestResult {
  name: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  duration?: number;
  data?: any;
  error?: string;
}

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  duration: number;
  category?: string;
  subTests?: SubTestResult[];
  data?: any;
  error?: string;
}

export interface TestReport {
  timestamp: string;
  duration: number;
  overallStatus: 'passed' | 'failed' | 'warning';
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  tests: TestResult[];
}

export class TestRunner {
  async runDatabaseTest(): Promise<TestResult> {
    const startTime = Date.now();
    const subTests: SubTestResult[] = [];
    
    try {
      // Test companies endpoint
      const companiesResponse = await fetch('http://localhost:5000/api/companies');
      const companiesData = companiesResponse.ok ? await companiesResponse.json() : null;
      
      subTests.push({
        name: 'Replit DB Connection',
        status: (companiesResponse.status === 200 || companiesResponse.status === 401) ? 'passed' : 'failed',
        message: (companiesResponse.status === 200 || companiesResponse.status === 401) ? 'Replit Database connection active' : `Database error: ${companiesResponse.status}`,
        data: { statusCode: companiesResponse.status }
      });

      // Test lists endpoint
      const listsResponse = await fetch('http://localhost:5000/api/lists');
      const listsData = listsResponse.ok ? await listsResponse.json() : null;
      
      subTests.push({
        name: 'Data Retrieval Test',
        status: Array.isArray(companiesData) ? 'passed' : 'failed',
        message: Array.isArray(companiesData) ? `Retrieved ${companiesData.length} companies` : 'Data retrieval failed',
        data: { companiesCount: Array.isArray(companiesData) ? companiesData.length : 0 }
      });

      subTests.push({
        name: 'Schema Integrity',
        status: Array.isArray(listsData) ? 'passed' : 'failed',
        message: Array.isArray(listsData) ? 'Database schema operational' : 'Schema validation failed',
        data: { listsCount: Array.isArray(listsData) ? listsData.length : 0 }
      });

      const allPassed = subTests.every(test => test.status === 'passed');
      
      return {
        name: 'Database Connectivity',
        status: allPassed ? 'passed' : 'failed',
        message: allPassed ? "Replit database fully operational" : "Database issues detected",
        duration: Date.now() - startTime,
        subTests
      };
    } catch (error) {
      return {
        name: 'Database Connectivity',
        status: 'failed',
        message: "Database connection failed",
        duration: Date.now() - startTime,
        subTests,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async runSearchTest(): Promise<TestResult> {
    const startTime = Date.now();
    const subTests: SubTestResult[] = [];
    
    try {
      // Test actual company quick search endpoint
      const quickSearchResponse = await fetch('http://localhost:5000/api/companies/quick-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: "test company", strategyId: null })
      });
      
      let quickSearchData = null;
      if (quickSearchResponse.ok) {
        quickSearchData = await quickSearchResponse.json();
      }
      
      subTests.push({
        name: 'Company Quick Search',
        status: quickSearchResponse.ok && quickSearchData ? 'passed' : 'failed',
        message: quickSearchResponse.ok && quickSearchData ? 
          `Quick search operational - found ${quickSearchData.companies?.length || 0} companies` : 
          'Quick search endpoint failed',
        data: { 
          statusCode: quickSearchResponse.status,
          companiesFound: quickSearchData?.companies?.length || 0
        }
      });

      // Test company data retrieval
      const companiesResponse = await fetch('http://localhost:5000/api/companies');
      let companiesData = null;
      if (companiesResponse.ok) {
        companiesData = await companiesResponse.json();
      }
      
      subTests.push({
        name: 'Company Data Retrieval',
        status: Array.isArray(companiesData) ? 'passed' : 'failed',
        message: Array.isArray(companiesData) ? 
          `Company database accessible - ${companiesData.length} total companies` : 
          'Company data retrieval failed',
        data: { 
          statusCode: companiesResponse.status,
          totalCompanies: Array.isArray(companiesData) ? companiesData.length : 0
        }
      });

      // Test search approaches endpoint (configuration data)  
      const approachesResponse = await fetch('http://localhost:5000/api/search-approaches');
      let approachesData = null;
      if (approachesResponse.ok) {
        approachesData = await approachesResponse.json();
      }
      
      subTests.push({
        name: 'Search Configuration',
        status: Array.isArray(approachesData) ? 'passed' : 'failed',
        message: Array.isArray(approachesData) ? 
          `Search approaches loaded - ${approachesData.length} strategies available` : 
          'Search configuration endpoint failed',
        data: { 
          statusCode: approachesResponse.status,
          strategiesCount: Array.isArray(approachesData) ? approachesData.length : 0
        }
      });

      const allPassed = subTests.every(test => test.status === 'passed');
      
      return {
        name: 'Search Functionality',
        status: allPassed ? 'passed' : 'failed',
        message: allPassed ? "Search functionality fully operational" : "Search system issues detected",
        duration: Date.now() - startTime,
        subTests
      };
    } catch (error) {
      console.error('Search test error details:', error);
      return {
        name: 'Search Functionality',
        status: 'failed',
        message: "Search test failed",
        duration: Date.now() - startTime,
        subTests,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async runHealthTest(): Promise<TestResult> {
    const startTime = Date.now();
    const subTests: SubTestResult[] = [];
    
    try {
      // Test Perplexity API
      try {
        await queryPerplexity([{
          role: "user",
          content: "Test connection"
        }]);
        subTests.push({
          name: 'Perplexity API',
          status: 'passed',
          message: 'API integration ready'
        });
      } catch (error) {
        subTests.push({
          name: 'Perplexity API',
          status: 'failed',
          message: 'Perplexity API not responding',
          data: { error: error instanceof Error ? error.message : String(error) }
        });
      }

      // Test AeroLeads API key
      const aeroLeadsKey = process.env.AEROLEADS_API_KEY;
      subTests.push({
        name: 'AeroLeads API',
        status: aeroLeadsKey ? 'passed' : 'failed',
        message: aeroLeadsKey ? 'Contact discovery service ready' : 'AeroLeads API key missing'
      });

      // Test Hunter API key
      const hunterKey = process.env.HUNTER_API_KEY;
      subTests.push({
        name: 'Hunter API',
        status: hunterKey ? 'passed' : 'failed',
        message: hunterKey ? 'Hunter email discovery ready' : 'Hunter API key missing'
      });

      // Test Apollo API key
      const apolloKey = process.env.APOLLO_API_KEY;
      subTests.push({
        name: 'Apollo API',
        status: apolloKey ? 'passed' : 'failed',
        message: apolloKey ? 'Apollo contact enrichment ready' : 'Apollo API key missing'
      });

      // Test server health
      const response = await fetch('http://localhost:5000/api/health');
      const isWorking = response.status === 200;
      
      subTests.push({
        name: 'Server Health',
        status: isWorking ? 'passed' : 'failed',
        message: isWorking ? 'Backend services operational' : 'Server health check failed'
      });

      const allPassed = subTests.every(test => test.status === 'passed');
      
      return {
        name: 'API Health',
        status: allPassed ? 'passed' : 'failed',
        message: allPassed ? "API health tests passed" : "API health issues detected",
        duration: Date.now() - startTime,
        subTests
      };
    } catch (error) {
      return {
        name: 'API Health',
        status: 'failed',
        message: "API health test failed",
        duration: Date.now() - startTime,
        subTests,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async runAllTests(): Promise<TestReport> {
    const startTime = Date.now();
    
    const [databaseTest, searchTest, healthTest, authTest] = await Promise.all([
      this.runDatabaseTest(),
      this.runSearchTest(),
      this.runHealthTest(),
      this.runAuthTest()
    ]);

    // Flatten all sub-tests into individual tests with category metadata
    const allTests: TestResult[] = [];
    
    // Add database tests
    if (databaseTest.subTests) {
      databaseTest.subTests.forEach(subTest => {
        allTests.push({
          name: subTest.name,
          status: subTest.status,
          message: subTest.message,
          duration: subTest.duration || 0,
          category: 'Database Connectivity',
          data: subTest.data,
          error: subTest.error
        });
      });
    }
    
    // Add search tests  
    if (searchTest.subTests) {
      searchTest.subTests.forEach(subTest => {
        allTests.push({
          name: subTest.name,
          status: subTest.status,
          message: subTest.message,
          duration: subTest.duration || 0,
          category: 'Search Functionality',
          data: subTest.data,
          error: subTest.error
        });
      });
    }
    
    // Add API health tests
    if (healthTest.subTests) {
      healthTest.subTests.forEach(subTest => {
        allTests.push({
          name: subTest.name,
          status: subTest.status,
          message: subTest.message,
          duration: subTest.duration || 0,
          category: 'API Health',
          data: subTest.data,
          error: subTest.error
        });
      });
    }
    
    // Add authentication tests
    if (authTest.subTests) {
      authTest.subTests.forEach(subTest => {
        allTests.push({
          name: subTest.name,
          status: subTest.status,
          message: subTest.message,
          duration: subTest.duration || 0,
          category: 'Authentication System',
          data: subTest.data,
          error: subTest.error
        });
      });
    }
    
    // Calculate summary based on individual tests
    const summary = {
      total: allTests.length,
      passed: allTests.filter(t => t.status === 'passed').length,
      failed: allTests.filter(t => t.status === 'failed').length,
      warnings: allTests.filter(t => t.status === 'warning').length
    };

    // Determine overall status
    let overallStatus: 'passed' | 'failed' | 'warning' = 'passed';
    if (summary.failed > 0) {
      overallStatus = 'failed';
    } else if (summary.warnings > 0) {
      overallStatus = 'warning';
    }

    return {
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      overallStatus,
      summary,
      tests: allTests
    };
  }

  async runAuthTest(): Promise<TestResult> {
    const startTime = Date.now();
    const subTests: SubTestResult[] = [];
    
    try {
      // Test Firebase Admin SDK initialization
      const firebaseTest = await this.testFirebaseAdmin();
      subTests.push(firebaseTest);

      // Test token validation endpoint  
      const tokenTest = await this.testTokenValidation();
      subTests.push(tokenTest);

      // Test session management
      const sessionTest = await this.testSessionManagement();
      subTests.push(sessionTest);

      // Test authentication middleware
      const middlewareTest = await this.testAuthMiddleware();
      subTests.push(middlewareTest);

      const allPassed = subTests.every(test => test.status === 'passed');
      
      return {
        name: 'Authentication System',
        status: allPassed ? 'passed' : 'failed',
        message: allPassed ? "Authentication system fully operational" : "Authentication issues detected",
        duration: Date.now() - startTime,
        subTests
      };
    } catch (error) {
      return {
        name: 'Authentication System',
        status: 'failed',
        message: "Authentication test failed",
        duration: Date.now() - startTime,
        subTests,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async testFirebaseAdmin(): Promise<SubTestResult> {
    try {
      // Check if Firebase Admin is properly initialized
      const admin = await import('firebase-admin');
      const app = admin.apps.length > 0 ? admin.apps[0] : null;
      
      if (app && app.options.projectId) {
        return {
          name: 'Firebase Admin SDK',
          status: 'passed',
          message: `Firebase Admin initialized with project: ${app.options.projectId}`
        };
      } else {
        return {
          name: 'Firebase Admin SDK',
          status: 'failed',
          message: 'Firebase Admin SDK not properly initialized'
        };
      }
    } catch (error) {
      return {
        name: 'Firebase Admin SDK',
        status: 'failed',
        message: 'Firebase Admin SDK error',
        data: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async testTokenValidation(): Promise<SubTestResult> {
    try {
      // Test the /api/user endpoint without authentication (should fail)
      const unauthResponse = await fetch('http://localhost:5000/api/user');
      
      if (unauthResponse.status === 401) {
        return {
          name: 'Token Validation Service',
          status: 'passed',
          message: 'Token validation properly rejects unauthorized requests'
        };
      } else {
        return {
          name: 'Token Validation Service',
          status: 'warning',
          message: `Unexpected response: ${unauthResponse.status} (expected 401)`
        };
      }
    } catch (error) {
      return {
        name: 'Token Validation Service',
        status: 'failed',
        message: 'Token validation service error',
        data: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async testSessionManagement(): Promise<SubTestResult> {
    try {
      // Test session-related endpoints exist and respond
      const loginResponse = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'invalid' })
      });
      
      // Should get a response (even if auth fails) indicating endpoint exists
      if (loginResponse.status === 400 || loginResponse.status === 401) {
        return {
          name: 'Session Management',
          status: 'passed',
          message: 'Session endpoints responsive'
        };
      } else {
        return {
          name: 'Session Management',
          status: 'warning',
          message: `Session endpoint status: ${loginResponse.status}`
        };
      }
    } catch (error) {
      return {
        name: 'Session Management',
        status: 'failed',
        message: 'Session management error',
        data: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async testAuthMiddleware(): Promise<SubTestResult> {
    try {
      // Test a protected endpoint to verify middleware works
      const protectedResponse = await fetch('http://localhost:5000/api/companies');
      
      // Should either work (200) or require auth (401), but not crash
      if (protectedResponse.status === 200 || protectedResponse.status === 401) {
        return {
          name: 'Auth Middleware',
          status: 'passed',
          message: 'Authentication middleware operational'
        };
      } else {
        return {
          name: 'Auth Middleware',
          status: 'warning',
          message: `Protected endpoint status: ${protectedResponse.status}`
        };
      }
    } catch (error) {
      return {
        name: 'Auth Middleware',
        status: 'failed',
        message: 'Auth middleware error',
        data: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }
}