import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { 
  Search, 
  ArrowRight, 
  User, 
  PlayCircle, 
  ChevronRight,
  Sparkles,
  Menu,
  MessageSquare,
  Users,
  Mail,
  Clock,
  UserCheck,
  Star
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Footer } from "@/components/footer";
import { Logo } from "@/components/logo";
import { SEOHead } from "@/components/ui/seo-head";
import { trackEvent } from "@/lib/analytics";

// Example search prompts
const EXAMPLE_PROMPTS = [
  "Highly-rated Greek restaurants in Midtown NYC",
  "Real-estate lawyers in Salt Lake City",
  "Stationary suppliers in Scranton",
  "Health-tech SaaS in Brooklyn",
  "Wolf-of-wallstreet-esque trading companies",
];

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { signInWithGoogle } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const videoRef = useRef<HTMLDivElement>(null);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);

  // Function to handle search submission
  const handleSearch = (query: string = searchQuery) => {
    if (!query.trim()) return;
    
    // Track the search event in Google Analytics
    trackEvent('search', 'landing_page', query);
    
    // Store the search query for use on the app page
    localStorage.setItem("pendingSearchQuery", query);
    
    // Set flag indicating user is coming from landing page
    localStorage.setItem("5ducks_from_landing", "true");
    
    // Navigate directly to the app page
    setLocation("/app");
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      {/* SEO tags for landing page */}
      <SEOHead 
        title="5Ducks - Sell to 5 new people every day"
        description="Easy Selling for Small Businesses - Sell to 5 new people every day."
        type="website"
        twitterCard="summary_large_image"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "5Ducks",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "29.00",
            "priceCurrency": "USD"
          },
          "description": "Easy Selling for Small Businesses - Sell to 5 new people every day.",
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "reviewCount": "57"
          }
        }}
      />
      {/* Header */}
      <header className="container mx-auto py-4 px-4">
        <div className="flex justify-between items-center">
          <Logo size="lg" asLink={false} />
          
          <div className="flex-1 flex justify-center">
            <nav className="hidden md:block">
              <ul className="flex space-x-8">
                <li>
                  <Link 
                    href="/pricing" 
                    onClick={() => trackEvent('view_pricing', 'navigation', 'header_link')}
                  >
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors border-b border-transparent hover:border-slate-400 dark:hover:border-slate-600 py-1">
                      Pricing
                    </span>
                  </Link>
                </li>
                {/* Future links would go here as additional <li> elements */}
              </ul>
            </nav>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <Link href="/pricing">
                    <DropdownMenuItem
                      onClick={() => trackEvent('view_pricing', 'navigation', 'mobile_menu')}
                    >
                      Pricing
                    </DropdownMenuItem>
                  </Link>
                  {/* Additional mobile menu items would go here */}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Link href="/outreach">
              <Button variant="outline">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1">
        <section className="py-16 md:py-24 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="mb-4 inline-flex items-center px-4 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              <Sparkles size={16} className="mr-2" />
              <span className="text-sm font-medium">AI-Powered B2B Sales</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 leading-tight">
              Sell to 5 new people every day.
            </h1>
            
            <p className="text-xl text-slate-700 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
              <span className="font-normal">Let's create your strategic sales plan.<br />
              What are you selling?</span>
            </p>

            {/* Strategic Onboarding Section */}
            <div className="max-w-2xl mx-auto mb-12">
              <div className="grid grid-cols-2 gap-4 mb-8">
                <Button
                  className="h-24 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl flex flex-col items-center justify-center space-y-2"
                  onClick={() => {
                    trackEvent('onboarding_start', 'landing_page', 'product');
                    setLocation("/planning?type=product");
                  }}
                >
                  <div className="text-2xl">📦</div>
                  <span className="font-semibold">Product</span>
                </Button>
                <Button
                  className="h-24 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl flex flex-col items-center justify-center space-y-2"
                  onClick={() => {
                    trackEvent('onboarding_start', 'landing_page', 'service');
                    setLocation("/planning?type=service");
                  }}
                >
                  <div className="text-2xl">🛠️</div>
                  <span className="font-semibold">Service</span>
                </Button>
              </div>
              
              <div className="text-center mb-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950 text-slate-500 dark:text-slate-400">
                      or search directly
                    </span>
                  </div>
                </div>
              </div>

              {/* Traditional Search Input */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-full opacity-70 blur"></div>
                <div className="relative bg-white dark:bg-slate-900 rounded-full">
                  <Input
                    type="text"
                    placeholder="Adventure service providers in Maine"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-36 py-7 text-lg rounded-full border-transparent shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSearch();
                      }
                    }}
                  />
                  <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-blue-500" size={20} />
                  <Button
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full px-5 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    onClick={() => handleSearch()}
                  >
                    <span className="mr-2">Quack</span>
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Suggestion Text */}
            <div className="text-center mt-4 mb-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Or select one of the suggestions below:</p>
            </div>

            {/* Example Search Prompts */}
            <div className="flex flex-wrap justify-center gap-2 mb-16">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  className="text-sm bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                  onClick={() => {
                    trackEvent('example_prompt_click', 'landing_page', prompt);
                    setSearchQuery(prompt);
                    handleSearch(prompt);
                  }}
                >
                  {prompt}
                </Button>
              ))}
            </div>
            
            <div className="flex flex-wrap justify-center space-x-2 md:space-x-8 my-10">
              <div className="text-center p-3 md:p-4">
                <div className="text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">22 Hours</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Saved per Month</div>
              </div>
              <div className="text-center p-3 md:p-4">
                <div className="text-3xl md:text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">225 Targets </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Sweet-talked to per Month</div>
              </div>
              <div className="text-center p-3 md:p-4">
                <div className="text-3xl md:text-4xl font-bold text-pink-600 dark:text-pink-400 mb-2">Avg $70k</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">New Revenue Pipeline*</div>
              </div>
            </div>

            {/* Strategic Onboarding Section */}
            <div className="max-w-2xl mx-auto mb-12">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">Get Your Personalized Sales Strategy</h3>
                <p className="text-gray-600 dark:text-gray-300">Tell us about your business and we'll create a custom prospecting plan</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <Button
                  className="h-24 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl flex flex-col items-center justify-center space-y-2"
                  onClick={() => {
                    trackEvent('onboarding_start', 'landing_page', 'product');
                    setLocation("/planning?type=product");
                  }}
                >
                  <div className="text-2xl">📦</div>
                  <span className="font-semibold">Product</span>
                </Button>
                <Button
                  className="h-24 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl flex flex-col items-center justify-center space-y-2"
                  onClick={() => {
                    trackEvent('onboarding_start', 'landing_page', 'service');
                    setLocation("/planning?type=service");
                  }}
                >
                  <div className="text-2xl">🛠️</div>
                  <span className="font-semibold">Service</span>
                </Button>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Get a 5-step guided conversation to build your sales strategy
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Video Section */}
        <section ref={videoRef} className="py-20 px-4 bg-white dark:bg-slate-900">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold mb-8 text-center">See How It Works</h2>
            
            <div 
              className={`relative aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden transition-all duration-500 mx-auto 
                ${isVideoExpanded ? "w-[90%] shadow-xl" : "w-[60%] cursor-pointer"}
              `}
              onClick={() => {
                if (!isVideoExpanded) {
                  trackEvent('video_play', 'landing_page', 'demo_video');
                  setIsVideoExpanded(true);
                }
              }}
            >
              {/* Thumbnail overlay when not expanded */}
              {!isVideoExpanded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent to-slate-900/60 text-white">
                  <PlayCircle size={64} className="mb-4 text-white opacity-90" />
                  <p className="font-medium">Click to watch demo</p>
                </div>
              )}
              
              {/* Replace this with your arcade.software embed */}
              <div className="h-full w-full flex items-center justify-center">
                {isVideoExpanded ? (
                  <div className="w-full h-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                    <p className="text-muted-foreground text-center">Interactive demo will load here</p>
                  </div>
                ) : (
                  <img 
                    src="https://placehold.co/1920x1080/2563eb/FFFFFF?text=5+Ducks+Demo+Video" 
                    alt="Video thumbnail" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          </div>
        </section>
        
        {/* Features Section */}
        <section className="py-16 px-4 bg-blue-50 dark:bg-blue-950/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold mb-4 text-center">Find Ultra Niche Contacts</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-12 text-center">or companies that would be impossible to filter in any other GTM or Lead-gen platform.</p>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mb-4">
                  <MessageSquare className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Simply prompt type of company</h3>
                <p className="text-slate-600 dark:text-slate-400">Adapt your prompt until you are getting the companies you want.</p>
              </div>
              
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mb-4">
                  <Users className="text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Then click "Find Key Contacts"</h3>
                <p className="text-slate-600 dark:text-slate-400">Which identifies the top 3 decision-makers in the each company.</p>
              </div>
              
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/50 rounded-lg flex items-center justify-center mb-4">
                  <Sparkles className="text-pink-600 dark:text-pink-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Find all decision-maker's email</h3>
                <p className="text-slate-600 dark:text-slate-400">with a single click or drill-down and only find those you want.</p>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <Button 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full px-8 py-6"
                onClick={() => {
                  trackEvent('cta_click', 'landing_page', 'try_free_5min');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <span className="mr-2">Try it for free</span>
                <ChevronRight size={16} />
              </Button>
            </div>
            
            {/* My Story Section */}
            <div className="mt-20 max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg">
              <h3 className="text-2xl font-semibold mb-6 text-center">My Story</h3>
              <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                <p>I do 10 push-ups before every shower and I realized that if I do 20, I will very soon stop doing them. But I will explain that later. </p>
                
                <p className="mt-4">In February, after spending an embarrassingly long amount of time creating a SaaS product with a couple of developers.
                It was finally time to start selling. But being easily distracted, I instead figured that I should create a tool that will make selling easier for me. (Of course!!! That's not procrastination. That's efficiency.)</p>
                
                <p className="mt-4">I then got distracted in workflows to optimize the sales and lead generation. However, finally coming back to this, I decided to launch it because, who the hell wants to open their inbox (with all those clickbait newsletters and juicy news updates) and THEN start sending sales emails?!?
                That's like asking an alcoholic to work at a bar. It's so distracting.</p>
                
                <p className="mt-4">The other thing I realized is that all the other lead generation services that popped-up when I was searching, were for people with big budgets and usually needed someone to set it up for them.</p>
                
                <p className="mt-4">I wanted something for the small guy that he could get running in less than 60 seconds. And that could be addictive and fun.</p>
                
                <p className="mt-4">Now back to those pushups. Well, I realized that the harder the task is, the more likely that I will abandon it, and not make it habit.
                And I figured, if I can make the selling process much, much easier, but then put a limit so that people will not feel guilty leaving after five minutes, that they might enjoy it more AND may make a habit out of it.</p>

                <p className="mt-4">Umm,... yeah. <br />
                Thanks for listening and enjoy. <br />
                - <strong>Jon</strong>
                </p>
              </div>
              
              <div className="text-center mt-8">
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full px-8 py-6"
                  onClick={() => {
                    trackEvent('cta_click', 'landing_page', 'start_habit');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <span className="mr-2">Start a new habit today</span>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
            
            {/* What We Do Section */}
            <div className="mt-20 max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg">
              <h3 className="text-2xl font-semibold mb-6 text-center">What We Do</h3>
              <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                <ol className="list-decimal pl-6 space-y-4">
                  <li><strong>New companies & contacts</strong> surfaced in seconds (Not dozens of filters and millions of contacts to choose from.)</li>
                  <li>Find the <strong>best email addresses</strong>. How? We pull from the top 3 global databases PLUS our real-time proprietary AI deep online search.</li>
                  <li><strong>Auto-suggest a message PER person</strong> in your style, all you do is edit and/or click "Send".</li>
                  <li><strong>Track positive responses</strong> without distracting you from new outreach everyday.</li>
                  <li>Analyze and match positive responses with the types of businesses & <strong>recommend new searches</strong>.</li>
                </ol>
              </div>
            </div>
            
            {/* Features Section - Duplicate */}
            <section className="py-16 px-4 bg-blue-50 dark:bg-blue-950/30">
              <div className="container mx-auto max-w-6xl">
                <h2 className="text-3xl font-bold mb-12 text-center">No-distraction Selling for Busy <span className="text-gray-400">(or easily-distractable)</span> People</h2>
                
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mb-4">
                      <Clock className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">You're already wasting time</h3>
                    <p className="text-slate-600 dark:text-slate-400">You should be sending simple emails to amazing people about how you are solving their problem.</p>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mb-4">
                      <UserCheck className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Daily master-plan via email - No login necessary</h3>
                    <p className="text-slate-600 dark:text-slate-400">Get all the details per contact  - Click to open edit each email body or subject line and voila!</p>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md">
                    <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/50 rounded-lg flex items-center justify-center mb-4">
                      <Star className="text-pink-600 dark:text-pink-400" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">You'll be done in 5 Mins (or less)</h3>
                    <p className="text-slate-600 dark:text-slate-400">And you won't even be distracted by your inbox, because we don't include that here.</p>
                  </div>
                </div>
                
                <div className="text-center mt-12">
                  <Button 
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full px-8 py-6"
                    onClick={() => {
                      trackEvent('cta_click', 'landing_page', 'try_free_5min');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <span className="mr-2">Try it for free (for 5 Minutes)</span>
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </section>
            
            {/* Why Sign-up Section */}
            <div className="mt-20 max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl p-8 shadow-lg">
              <h3 className="text-2xl font-semibold mb-6 text-center">Why Sign-up?</h3>
              <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                <ol className="list-decimal pl-6 space-y-4">
                  <li>Because <strong>consistency beats motivation</strong> Every. Single. Time.</li>
                  <li>If you have not sold anything* in 90 days we will <strong>reimburse the full 3 months</strong> subscription (and will gently encourage you to find a better product to sell.)</li>
                  <li>We keep things SUPER SIMPLE and allow you to <strong>sell without analysis-paralysis</strong>, which triples your productivity.</li>
                </ol>
              </div>
              
              <div className="text-center mt-8">
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full px-8 py-6"
                  onClick={() => {
                    trackEvent('cta_click', 'landing_page', 'give_it_a_try');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <span className="mr-2">Give it a try</span>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
            
            
          </div>
        </section>
      </main>

      {/* Footer is imported from UI components */}
      <Footer />
    </div>
  );
}