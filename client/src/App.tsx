import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { Layout } from "@/components/layout";
import { SearchStrategyProvider } from "@/lib/search-strategy-context";
import Auth from "@/pages/auth";
import Home from "@/pages/home";
import Planning from "@/pages/planning";
import Build from "@/pages/build";
import Lists from "@/pages/lists";
import ListDetails from "@/pages/list-details";
import Campaigns from "@/pages/campaigns";
import CampaignDetails from "@/pages/campaign-details";
import Outreach from "@/pages/outreach";
import DatabasePage from "@/pages/database";
import CompanyDetails from "@/pages/company-details";
import ContactDetails from "@/pages/contact-details";
import ApiTemplates from "@/pages/api-templates";
import Approaches from "@/pages/approaches";
import NotFound from "@/pages/not-found";
import { MainNav } from "@/components/main-nav";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Pricing from "@/pages/pricing";
import Blog from "@/pages/blog";
import Contact from "@/pages/contact";
import Support from "@/pages/support";

function Router() {
  return (
    <Layout>
      <MainNav />
      <div className="flex-1">
        <Switch>
          <Route path="/auth" component={Auth} />
          <ProtectedRoute path="/planning" component={Planning} />
          <ProtectedRoute path="/build" component={Build} />
          <ProtectedRoute path="/" component={Home} />
          <ProtectedRoute path="/lists" component={Lists} />
          <ProtectedRoute path="/lists/:listId" component={ListDetails} />
          <ProtectedRoute path="/campaigns" component={Campaigns} />
          <ProtectedRoute path="/campaigns/:id" component={CampaignDetails} />
          <ProtectedRoute path="/outreach" component={Outreach} />
          <ProtectedRoute path="/database" component={DatabasePage} />
          <ProtectedRoute path="/companies/:id" component={CompanyDetails} />
          <ProtectedRoute path="/contacts/:id" component={ContactDetails} />
          <ProtectedRoute path="/api-templates" component={ApiTemplates} />
          <ProtectedRoute path="/approaches" component={Approaches} />
          {/* Workflow routes have been removed */}
          {/* Public Routes */}
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/blog" component={Blog} />
          <Route path="/contact" component={Contact} />
          <Route path="/support" component={Support} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SearchStrategyProvider>
          <Router />
          <Toaster />
        </SearchStrategyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;