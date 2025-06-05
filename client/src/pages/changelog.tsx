import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/layout";
import { SEOHead } from "@/components/ui/seo-head";
import { useEffect } from "react";

export default function Changelog() {
  // Reset scroll position when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Layout>
      <SEOHead 
        title="Changelog - 5Ducks"
        description="Latest updates and improvements to the 5Ducks platform."
      />
      <div className="container mx-auto py-8 flex-1">
        <Card>
          <CardHeader>
            <CardTitle>Changelog</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <h2>June 5, 2025</h2>
            <ul>
              <li>Launched AI-powered strategic onboarding system with interactive boundary selection</li>
              <li>Implemented progressive strategy generation workflow</li>
              <li>Added numbered selection interface for AI-generated targeting options</li>
              <li>Enhanced chat interface improvements</li>
              <li>Fixed JSON parsing and error handling issues</li>
            </ul>

            <h2>May 28, 2025</h2>
            <ul>
              <li>Implemented user authentication system rollout</li>
              <li>Enhanced AI-powered contact search improvements</li>
              <li>Added enhanced UI/UX for company management</li>
              <li>Improved SEO and mobile responsiveness updates</li>
            </ul>

            <h2>May 24, 2025</h2>
            <ul>
              <li>Added pricing link to landing page header with mobile responsive menu</li>
              <li>Created this changelog page to track updates</li>
            </ul>

            <h2>May 17, 2025</h2>
            <ul>
              <li>Updated Terms of Service and Privacy Policy</li>
              <li>Improved mobile responsiveness throughout the application</li>
              <li>Fixed contact discovery reliability issues</li>
            </ul>

            <h2>May 10, 2025</h2>
            <ul>
              <li>Enhanced search algorithm for better company matching</li>
              <li>Added new email templates for outreach</li>
              <li>Improved email verification accuracy</li>
              <li>Fixed pagination on search results</li>
            </ul>

            <h2>May 1, 2025</h2>
            <ul>
              <li>Launched 5Ducks Beta version</li>
              <li>Implemented core search functionality</li>
              <li>Created company information discovery</li>
              <li>Added contact identification features</li>
              <li>Established email outreach capabilities</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}