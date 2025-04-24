import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CompanyTable from "@/components/company-table";
import PromptEditor from "@/components/prompt-editor";
import { ListPlus, Search, Code2, UserCircle, Banknote, Eye, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Star, MessageSquare } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Company, Contact } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SearchFlowNew from "@/components/search-flow-new";
import { filterTopProspects } from "@/lib/results-analysis/prospect-filtering";

// Extend Company type to include contacts
interface CompanyWithContacts extends Company {
  contacts?: (Contact & { companyName?: string; companyId?: number })[];
}

// Define interface for the saved state
interface SavedSearchState {
  currentQuery: string | null;
  currentResults: CompanyWithContacts[] | null;
}

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentQuery, setCurrentQuery] = useState<string | null>(null);
  const [currentResults, setCurrentResults] = useState<CompanyWithContacts[] | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [pendingContactId, setPendingContactId] = useState<number | null>(null);
  const [isSearchFlowExpanded, setIsSearchFlowExpanded] = useState(true);
  const [showExternalResults, setShowExternalResults] = useState(false);
  const [externalCompanies, setExternalCompanies] = useState<CompanyWithContacts[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Load state from localStorage on component mount
  useEffect(() => {
    const savedState = localStorage.getItem('searchState');
    if (savedState) {
      const parsed = JSON.parse(savedState) as SavedSearchState;
      setCurrentQuery(parsed.currentQuery);
      setCurrentResults(parsed.currentResults);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const stateToSave: SavedSearchState = {
      currentQuery,
      currentResults
    };
    localStorage.setItem('searchState', JSON.stringify(stateToSave));
  }, [currentQuery, currentResults]);

  const { data: searchApproaches = [] } = useQuery<SearchApproach[]>({
    queryKey: ["/api/search-approaches"],
  });
  
  // Query to fetch the most recent companies (from external providers like Rabbit)
  const { data: recentCompanies = [], refetch: refetchRecentCompanies } = useQuery<CompanyWithContacts[]>({
    queryKey: ["/api/companies/recent"],
    refetchInterval: 5000, // Poll every 5 seconds for new companies
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentQuery || !currentResults) return;
      const res = await apiRequest("POST", "/api/lists", {
        companies: currentResults,
        prompt: currentQuery
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lists"] });
      toast({
        title: "List Saved",
        description: "The search results have been saved as a new list.",
      });
      setIsSaved(true);
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAnalysisComplete = () => {
    setIsAnalyzing(false);
  };

  const handleSearchResults = (query: string, results: CompanyWithContacts[]) => {
    setCurrentQuery(query);
    setCurrentResults(results);
    setIsSaved(false);
  };

  const handleSaveList = () => {
    if (!currentResults || !currentQuery) {
      toast({
        title: "Cannot Save",
        description: "Please perform a search first.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  // Get top prospects from all companies
  const getTopProspects = () => {
    if (!currentResults) return [];

    const allContacts: (Contact & { companyName: string; companyId: number })[] = [];
    currentResults.forEach(company => {
      if (company.contacts) {
        allContacts.push(...company.contacts.map(contact => ({
          ...contact,
          companyName: company.name,
          companyId: company.id
        })));
      }
    });

    // Use the new filtering logic
    return filterTopProspects(allContacts, {
      maxPerCompany: 3,
      minProbability: 50
    });
  };

  // Add mutation for enriching contacts
  const enrichContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      setPendingContactId(contactId);
      const response = await apiRequest("POST", `/api/contacts/${contactId}/enrich`);
      return response.json();
    },
    onSuccess: (data) => {
      // Update the currentResults with the enriched contact
      setCurrentResults(prev => {
        if (!prev) return null;
        return prev.map(company => ({
          ...company,
          contacts: company.contacts?.map(contact =>
            contact.id === data.id ? data : contact
          )
        }));
      });
      toast({
        title: "Contact Enriched",
        description: "Successfully updated contact information.",
      });
      setPendingContactId(null);
    },
    onError: (error) => {
      toast({
        title: "Enrichment Failed",
        description: error instanceof Error ? error.message : "Failed to enrich contact information",
        variant: "destructive",
      });
      setPendingContactId(null);
    },
  });

  const handleEnrichContact = (contactId: number) => {
    enrichContactMutation.mutate(contactId);
  };

  const isContactEnriched = (contact: Contact) => {
    // Consider a contact "enriched" if it's been processed, even if no data was found
    return contact.completedSearches?.includes('contact_enrichment') || false;
  };

  const isContactPending = (contactId: number) => {
    return pendingContactId === contactId;
  };

  // Add mutation for contact feedback
  const feedbackMutation = useMutation({
    mutationFn: async ({ contactId, feedbackType }: { contactId: number; feedbackType: string }) => {
      const response = await apiRequest("POST", `/api/contacts/${contactId}/feedback`, {
        feedbackType,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Update the contact in the results
      setCurrentResults((prev) => {
        if (!prev) return null;
        return prev.map((company) => ({
          ...company,
          contacts: company.contacts?.map((contact) =>
            contact.id === data.contactId
              ? {
                  ...contact,
                  userFeedbackScore: data.userFeedbackScore,
                  feedbackCount: data.feedbackCount,
                }
              : contact
          ),
        }));
      });

      toast({
        title: "Feedback Recorded",
        description: "Thank you for helping improve our contact validation!",
      });
    },
    onError: (error) => {
      toast({
        title: "Feedback Failed",
        description: error instanceof Error ? error.message : "Failed to record feedback",
        variant: "destructive",
      });
    },
  });

  const handleContactFeedback = (contactId: number, feedbackType: string) => {
    feedbackMutation.mutate({ contactId, feedbackType });
  };

  const handleEnrichProspects = async (prospects: (Contact & { companyName: string; companyId: number })[]) => {
    if (prospects.length === 0) {
      toast({
        title: "No Prospects",
        description: "There are no high-probability prospects to enrich.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get all contact IDs regardless of company
      const contactIds = prospects.map(contact => contact.id);

      // Send all contacts for enrichment in a single request
      const response = await apiRequest("POST", `/api/enrich-contacts`, {
        contactIds
      });
      const data = await response.json();

      toast({
        title: "Enrichment Started",
        description: `Started enriching ${contactIds.length} top prospects`,
      });

      // Start polling for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await apiRequest("GET", `/api/enrichment/${data.queueId}/status`);
          const statusData = await statusResponse.json();

          if (statusData.status === 'completed') {
            clearInterval(pollInterval);
            // Refresh all contacts that were enriched
            const updatedContacts = await Promise.all(
              contactIds.map(async (id) => {
                const contactResponse = await apiRequest("GET", `/api/contacts/${id}`);
                return contactResponse.json();
              })
            );

            // Update the currentResults with the enriched contacts
            setCurrentResults(prev => {
              if (!prev) return null;
              return prev.map(company => ({
                ...company,
                contacts: company.contacts?.map(contact =>
                  updatedContacts.find(uc => uc.id === contact.id) || contact
                )
              }));
            });

            toast({
              title: "Enrichment Complete",
              description: `Successfully enriched ${statusData.completedItems} contacts`,
            });
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            toast({
              title: "Enrichment Failed",
              description: "Failed to complete contact enrichment",
              variant: "destructive",
            });
          }
        } catch (error) {
          clearInterval(pollInterval);
          console.error('Status check error:', error);
        }
      }, 2000); // Check every 2 seconds

      // Clear interval after 5 minutes to prevent infinite polling
      setTimeout(() => clearInterval(pollInterval), 300000);

    } catch (error) {
      toast({
        title: "Enrichment Failed",
        description: error instanceof Error ? error.message : "Failed to start enrichment",
        variant: "destructive",
      });
    }
  };

  //New function added here
  const getEnrichButtonText = (contact: Contact) => {
    if (isContactPending(contact.id)) return "Processing...";
    if (isContactEnriched(contact)) {
      const hasEnrichedData = contact.email || contact.linkedinUrl || contact.phoneNumber || contact.department;
      return hasEnrichedData ? "Enriched" : "No Data Found";
    }
    return "Enrich";
  };


  return (
    <div className="container mx-auto py-6">
      <div className="grid grid-cols-12 gap-6">
        {/* Main Content Area - 9 columns */}
        <div className="col-span-9 space-y-6">
          {/* Search Section */}
          <Card>
            <CardHeader>
              <CardTitle>Search for target businesses</CardTitle>
            </CardHeader>
            <CardContent>
              <PromptEditor
                onAnalyze={() => setIsAnalyzing(true)}
                onComplete={handleAnalysisComplete}
                onSearchResults={handleSearchResults}
                isAnalyzing={isAnalyzing}
                initialPrompt={currentQuery || ""}
              />
            </CardContent>
          </Card>

          {/* Top Prospects Section - Moved above Companies Analysis */}
          {currentResults && currentResults.length > 0 && (
            <Card className="w-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UserCircle className="w-5 h-5" />
                    Top Prospects
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEnrichProspects(getTopProspects())}
                  >
                    <Banknote className="mr-2 h-4 w-4" />
                    Enrich Prospects
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Highest probability contacts across all companies
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feedback</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getTopProspects().map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleContactFeedback(contact.id, "excellent")}>
                                  <Star className="h-4 w-4 mr-2 text-yellow-500" />
                                  Excellent Match
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleContactFeedback(contact.id, "ok")}>
                                  <ThumbsUp className="h-4 w-4 mr-2 text-blue-500" />
                                  OK Match
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleContactFeedback(contact.id, "terrible")}>
                                  <ThumbsDown className="h-4 w-4 mr-2 text-red-500" />
                                  Not a Match
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="font-medium">{contact.name}</TableCell>
                          <TableCell>{contact.companyName}</TableCell>
                          <TableCell>{contact.role || "N/A"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                (contact.probability || 0) >= 90
                                  ? "default"
                                  : (contact.probability || 0) >= 70
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {contact.probability || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>{contact.email || "N/A"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLocation(`/contacts/${contact.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {/* Updated Button Here */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEnrichContact(contact.id)}
                                disabled={isContactPending(contact.id) || isContactEnriched(contact)}
                                className={isContactEnriched(contact) ? "text-muted-foreground" : ""}
                              >
                                <Banknote className={`w-4 h-4 mr-2 ${isContactPending(contact.id) ? "animate-spin" : ""}`} />
                                {getEnrichButtonText(contact)}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {getTopProspects().length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No high-probability contacts found in the search results
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Companies Analysis Section */}
          <Card className="w-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Companies Analysis</CardTitle>
                {currentResults && (
                  <Button
                    variant="outline"
                    onClick={handleSaveList}
                    disabled={isSaved || saveMutation.isPending}
                  >
                    <ListPlus className="mr-2 h-4 w-4" />
                    {isSaved ? "Saved" : "Save as List"}
                  </Button>
                )}
              </div>
              {currentQuery && (
                <p className="text-sm text-muted-foreground mt-2">
                  Search: {currentQuery}
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <CompanyTable companies={currentResults || []} />
              </div>
            </CardContent>
          </Card>
          
          {/* External Companies Section */}
          {recentCompanies.length > 0 && (
            <Card className="w-full">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>External Provider Results</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Latest results from Lead-Gen Rabbit and other providers
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <CompanyTable companies={recentCompanies} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Search Flow Section - 3 columns */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <div className="space-y-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setIsSearchFlowExpanded(!isSearchFlowExpanded)}
                >
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="w-5 h-5" />
                    Search Flow
                    {isSearchFlowExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/api-templates")}
                  className="w-full justify-start"
                >
                  <Code2 className="h-4 w-4 mr-2" />
                  View API Templates
                </Button>
              </div>
            </CardHeader>
            {isSearchFlowExpanded && (
              <CardContent className="p-2">
                <SearchFlowNew approaches={searchApproaches} />
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}