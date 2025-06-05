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
import { useEffect } from "react";
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/use-analytics";
import { SEOHead } from "@/components/ui/seo-head";
import Auth from "@/pages/auth";
import Home from "@/pages/home";
import LandingPage from "@/pages/landing";
import Landing2Page from "@/pages/landing2";
import Build from "@/pages/build";
import Lists from "@/pages/lists";
import ListDetails from "@/pages/list-details";
import Campaigns from "@/pages/campaigns";
import CampaignDetails from "@/pages/campaign-details";
import Outreach from "@/pages/outreach";
import Replies from "@/pages/replies";
import CompanyDetails from "@/pages/company-details";
import ContactDetails from "@/pages/contact-details";
import Testing from "@/pages/testing";
import Planning from "@/pages/planning";

import NotFound from "@/pages/not-found";
import { MainNav } from "@/components/main-nav";

import Terms from "@/pages/terms";
import Pricing from "@/pages/pricing";
import Blog from "@/pages/blog";
import BlogPost from "@/pages/blog-post";
import Contact from "@/pages/contact";
import Support from "@/pages/support";
import Levels from "@/pages/levels";
import Privacy from "@/pages/privacy";
import Changelog from "@/pages/changelog";

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
              <Terms />
            </div>
          </Layout>
        </Route>
        <Route path="/pricing">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Pricing />
            </div>
          </Layout>
        </Route>
        <Route path="/blog">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Blog />
            </div>
          </Layout>
        </Route>
        <Route path="/blog/:slug">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <BlogPost />
            </div>
          </Layout>
        </Route>
        <Route path="/levels">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Levels />
            </div>
          </Layout>
        </Route>
        <Route path="/contact">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Contact />
            </div>
          </Layout>
        </Route>
        <Route path="/support">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Support />
            </div>
          </Layout>
        </Route>
        <Route path="/privacy">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Privacy />
            </div>
          </Layout>
        </Route>
        <Route path="/changelog">
          <Layout>
            <MainNav />
            <div className="flex-1">
              <Changelog />
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
                <SemiProtectedRoute path="/app" component={() => <Home />} />
                <SemiProtectedRoute path="/companies/:id" component={() => <CompanyDetails />} />
                
                {/* Fully protected routes - require login */}
                <ProtectedRoute path="/build" component={() => <Build />} />
                <ProtectedRoute path="/lists" component={() => <Lists />} />
                <ProtectedRoute path="/lists/:listId" component={() => <ListDetails />} />
                <ProtectedRoute path="/campaigns" component={() => <Campaigns />} />
                <ProtectedRoute path="/campaigns/:id" component={() => <CampaignDetails />} />
                <ProtectedRoute path="/outreach" component={() => <Outreach />} />
                <ProtectedRoute path="/replies" component={() => <Replies />} />
                <ProtectedRoute path="/contacts/:id" component={() => <ContactDetails />} />
                <ProtectedRoute path="/testing" component={() => <Testing />} />
                
                {/* 404 Page */}
                <Route component={() => <NotFound />} />
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