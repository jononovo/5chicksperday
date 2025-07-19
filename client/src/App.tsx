import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { SemiProtectedRoute } from "@/lib/semi-protected-route";
import { Layout, AppLayout } from "@/components/layout";
import { SearchStrategyProvider } from "@/lib/search-strategy-context";
import { RegistrationModalProvider } from "@/hooks/use-registration-modal";
import { RegistrationModalContainer } from "@/components/registration-modal-container";
import { useEffect, lazy, Suspense } from "react";
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/use-analytics";
import { SEOHead } from "@/components/ui/seo-head";
import { MainNav } from "@/components/main-nav";
import { LoadingScreen } from "@/components/ui/loading-screen";

// Immediate imports for landing pages and critical components
import LandingPage from "@/pages/landing";
import Landing2Page from "@/pages/landing2";
import Planning from "@/pages/planning";
import Auth from "@/pages/auth";

// Lazy imports for app pages that can be loaded on demand
const Home = lazy(() => import("@/pages/home"));
const Build = lazy(() => import("@/pages/build"));
const Account = lazy(() => import("@/pages/account"));
// Lists functionality moved to drawer in Home page
const Campaigns = lazy(() => import("@/pages/campaigns"));
const CampaignDetails = lazy(() => import("@/pages/campaign-details"));
const Outreach = lazy(() => import("@/pages/outreach"));
const Replies = lazy(() => import("@/pages/replies"));
const CompanyDetails = lazy(() => import("@/pages/company-details"));
const ContactDetails = lazy(() => import("@/pages/contact-details"));
const Testing = lazy(() => import("@/pages/testing"));
const SubscriptionSuccess = lazy(() => import("@/pages/subscription-success"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Lazy imports for marketing pages
const Terms = lazy(() => import("@/pages/terms"));
const Pricing = lazy(() => import("@/pages/pricing"));
const Blog = lazy(() => import("@/pages/blog"));
const BlogPost = lazy(() => import("@/pages/blog-post"));
const Contact = lazy(() => import("@/pages/contact"));
const Support = lazy(() => import("@/pages/support"));
const Levels = lazy(() => import("@/pages/levels"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Changelog = lazy(() => import("@/pages/changelog"));

function Router() {
  // Track page views when routes change
  useAnalytics();
  
  return (
    <>
      <Switch>
        {/* Public Landing Page (no layout or nav) */}
        <Route path="/" component={LandingPage} />
        
        {/* Temporary React Landing Page for comparison */}
        <Route path="/react-landing" component={LandingPage} />
        
        {/* Landing2 Page Clone */}
        <Route path="/landing2" component={Landing2Page} />
        
        {/* Strategic Planning Page (no nav) */}
        <Route path="/planning" component={Planning} />
        
        {/* Marketing pages with full footer */}
        <Route path="/terms">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Suspense fallback={<LoadingScreen />}>
                <Terms />
              </Suspense>
            </div>
          </Layout>
        </Route>
        <Route path="/pricing">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Suspense fallback={<LoadingScreen />}>
                <Pricing />
              </Suspense>
            </div>
          </Layout>
        </Route>
        <Route path="/blog">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Suspense fallback={<LoadingScreen />}>
                <Blog />
              </Suspense>
            </div>
          </Layout>
        </Route>
        <Route path="/blog/:slug">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Suspense fallback={<LoadingScreen />}>
                <BlogPost />
              </Suspense>
            </div>
          </Layout>
        </Route>
        <Route path="/levels">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Suspense fallback={<LoadingScreen />}>
                <Levels />
              </Suspense>
            </div>
          </Layout>
        </Route>
        <Route path="/contact">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Suspense fallback={<LoadingScreen />}>
                <Contact />
              </Suspense>
            </div>
          </Layout>
        </Route>
        <Route path="/support">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Suspense fallback={<LoadingScreen />}>
                <Support />
              </Suspense>
            </div>
          </Layout>
        </Route>
        <Route path="/privacy">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Suspense fallback={<LoadingScreen />}>
                <Privacy />
              </Suspense>
            </div>
          </Layout>
        </Route>
        <Route path="/changelog">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Suspense fallback={<LoadingScreen />}>
                <Changelog />
              </Suspense>
            </div>
          </Layout>
        </Route>

        {/* App pages with mini footer */}
        <Route path="*">
          <AppLayout>
            <MainNav />
            <div className="flex-1">
              <Switch>
                <Route path="/auth" component={Auth} />
                
                {/* Semi-protected routes - allow initial access but prompt for login for certain actions */}
                <SemiProtectedRoute path="/app" component={() => 
                  <Suspense fallback={<LoadingScreen message="Loading search interface..." />}>
                    <Home />
                  </Suspense>
                } />
                <SemiProtectedRoute path="/companies/:id" component={() => 
                  <Suspense fallback={<LoadingScreen message="Loading company details..." />}>
                    <CompanyDetails />
                  </Suspense>
                } />
                
                {/* Fully protected routes - require login */}
                <ProtectedRoute path="/build" component={() => 
                  <Suspense fallback={<LoadingScreen />}>
                    <Build />
                  </Suspense>
                } />
                <ProtectedRoute path="/account" component={() => 
                  <Suspense fallback={<LoadingScreen />}>
                    <Account />
                  </Suspense>
                } />
                {/* Lists routes removed - functionality moved to drawer in Home page */}
                <ProtectedRoute path="/campaigns" component={() => 
                  <Suspense fallback={<LoadingScreen />}>
                    <Campaigns />
                  </Suspense>
                } />
                <ProtectedRoute path="/campaigns/:id" component={() => 
                  <Suspense fallback={<LoadingScreen />}>
                    <CampaignDetails />
                  </Suspense>
                } />
                <ProtectedRoute path="/outreach" component={() => 
                  <Suspense fallback={<LoadingScreen />}>
                    <Outreach />
                  </Suspense>
                } />
                <ProtectedRoute path="/replies" component={() => 
                  <Suspense fallback={<LoadingScreen />}>
                    <Replies />
                  </Suspense>
                } />
                <ProtectedRoute path="/contacts/:id" component={() => 
                  <Suspense fallback={<LoadingScreen />}>
                    <ContactDetails />
                  </Suspense>
                } />
                <ProtectedRoute path="/testing" component={() => 
                  <Suspense fallback={<LoadingScreen />}>
                    <Testing />
                  </Suspense>
                } />
                
                {/* Subscription Success Page */}
                <Route path="/subscription-success" component={() => 
                  <Suspense fallback={<LoadingScreen />}>
                    <SubscriptionSuccess />
                  </Suspense>
                } />
                
                {/* 404 Page */}
                <Route component={() => 
                  <Suspense fallback={<LoadingScreen />}>
                    <NotFound />
                  </Suspense>
                } />
              </Switch>
            </div>
          </AppLayout>
        </Route>
      </Switch>
    </>
  );
}

function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    // Verify required environment variable is present
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RegistrationModalProvider>
          <SearchStrategyProvider>
            {/* Default SEO tags for the entire site */}
            <SEOHead />
            <Router />
            <RegistrationModalContainer />
            <Toaster />
          </SearchStrategyProvider>
        </RegistrationModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;