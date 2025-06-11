import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Send,
  Save,
  Wand2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  ExternalLink,
  Mail,
  Type,
  FileText
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Import Input component
import { cn } from "@/lib/utils";
import type { List, Company, Contact } from "@shared/schema";
import { generateShortListDisplayName } from "@/lib/list-utils";
import { useState, useEffect, useMemo, useRef } from "react";
import QuickTemplates from "@/components/quick-templates";
import type { EmailTemplate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import {Loader2} from "lucide-react";
import { queryClient } from "@/lib/queryClient"; // Import queryClient
import type { InsertEmailTemplate } from "@shared/schema"; // Import the type
import { ContactActionColumn } from "@/components/contact-action-column";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


// Define interface for the saved state
interface SavedOutreachState {
  selectedListId?: string;
  selectedContactId: number | null;
  emailPrompt: string;
  emailContent: string;
  toEmail: string;
  emailSubject: string;
  currentCompanyIndex: number;
}

export default function Outreach() {
  const [selectedListId, setSelectedListId] = useState<string>();
  const [emailPrompt, setEmailPrompt] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [currentCompanyIndex, setCurrentCompanyIndex] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Email enrichment state tracking
  const [pendingContactIds, setPendingContactIds] = useState<Set<number>>(new Set());
  const [pendingHunterIds, setPendingHunterIds] = useState<Set<number>>(new Set());
  const [pendingAeroLeadsIds, setPendingAeroLeadsIds] = useState<Set<number>>(new Set());
  const [pendingApolloIds, setPendingApolloIds] = useState<Set<number>>(new Set());
  
  // Copy feedback state tracking
  const [copiedContactIds, setCopiedContactIds] = useState<Set<number>>(new Set());
  
  // Textarea refs for auto-resizing
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize functions
  const handleTextareaResize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 400); // 400px max
      textarea.style.height = `${newHeight}px`;
    }
  };

  const handlePromptTextareaResize = () => {
    const textarea = promptTextareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Current 4-line height is roughly 100px, so half would be ~50px, but let's use 60px for 2 lines
      const newHeight = Math.min(textarea.scrollHeight, 100); // 100px max (current 4-line height)
      textarea.style.height = `${newHeight}px`;
    }
  };

  // Auto-resize on content changes
  useEffect(() => {
    handleTextareaResize();
  }, [emailContent]);

  useEffect(() => {
    handlePromptTextareaResize();
  }, [emailPrompt]);

  // Load state from localStorage on component mount
  useEffect(() => {
    const savedState = localStorage.getItem('outreachState');
    if (savedState) {
      const parsed = JSON.parse(savedState) as SavedOutreachState;
      setSelectedListId(parsed.selectedListId);
      setSelectedContactId(parsed.selectedContactId);
      setEmailPrompt(parsed.emailPrompt);
      setEmailContent(parsed.emailContent);
      setToEmail(parsed.toEmail || "");
      setEmailSubject(parsed.emailSubject || "");
      setCurrentCompanyIndex(parsed.currentCompanyIndex || 0);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const stateToSave: SavedOutreachState = {
      selectedListId,
      selectedContactId,
      emailPrompt,
      emailContent,
      toEmail,
      emailSubject,
      currentCompanyIndex
    };
    localStorage.setItem('outreachState', JSON.stringify(stateToSave));
  }, [selectedListId, selectedContactId, emailPrompt, emailContent, toEmail, emailSubject, currentCompanyIndex]);

  const { data: lists = [] } = useQuery<List[]>({
    queryKey: ["/api/lists"],
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: [`/api/lists/${selectedListId}/companies`],
    enabled: !!selectedListId,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get the current company based on the index
  const currentCompany = companies[currentCompanyIndex];

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: [`/api/companies/${currentCompany?.id}/contacts`],
    enabled: !!currentCompany?.id,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Memoized top 3 leadership contacts computation
  const topContacts = useMemo(() => 
    contacts
      ?.filter(contact => contact.probability && contact.probability >= 70) // Filter high probability contacts
      .sort((a, b) => (b.probability || 0) - (a.probability || 0)) // Sort by probability
      .slice(0, 3) || []
  , [contacts]);

  // Adjacent company prefetching for instant navigation
  useEffect(() => {
    if (!companies.length) return;

    const prefetchAdjacentCompanies = () => {
      // Calculate range: current ±3 companies
      const start = Math.max(0, currentCompanyIndex - 3);
      const end = Math.min(companies.length - 1, currentCompanyIndex + 3);
      
      console.log(`Prefetching contacts for companies ${start} to ${end} (current: ${currentCompanyIndex})`);
      
      for (let i = start; i <= end; i++) {
        // Skip current company (already loaded)
        if (i === currentCompanyIndex) continue;
        
        const company = companies[i];
        if (company?.id) {
          queryClient.prefetchQuery({
            queryKey: [`/api/companies/${company.id}/contacts`],
            queryFn: async () => {
              const response = await apiRequest("GET", `/api/companies/${company.id}/contacts`);
              return response.json();
            },
            staleTime: 3 * 60 * 1000, // 3 minutes
            gcTime: 5 * 60 * 1000, // 5 minutes
          });
        }
      }
    };

    // Small delay to avoid blocking current company load
    const timeoutId = setTimeout(prefetchAdjacentCompanies, 100);
    return () => clearTimeout(timeoutId);
  }, [companies, currentCompanyIndex]);

  // Page focus invalidation for fresh data after search page updates
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page focused - invalidating contact caches for fresh data');
        queryClient.invalidateQueries({ 
          queryKey: ['/api/companies'],
          predicate: (query) => query.queryKey[0] === '/api/companies'
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleSaveEmail = () => {
    if (!emailPrompt || !emailContent) {
      toast({
        title: "Missing Information",
        description: "Please provide both a prompt and email content to save the template",
        variant: "destructive",
      });
      return;
    }

    const templateData: InsertEmailTemplate = {
      name: `Template from ${new Date().toLocaleDateString()}`,
      subject: emailSubject || "New Email Template",
      content: emailContent,
      description: emailPrompt,
      category: "saved",
      userId: user?.id || 1 // Use authenticated user ID or fallback to demo user
    };

    createMutation.mutate(templateData);
  };

  const createMutation = useMutation({
    mutationFn: async (data: InsertEmailTemplate) => {
      console.log('Saving email template:', {
        name: data.name,
        subject: data.subject
      });
      const res = await apiRequest("POST", "/api/email-templates", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Success",
        description: "Email template saved successfully",
      });
    },
    onError: (error) => {
      console.error('Template save error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save email template",
        variant: "destructive",
      });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      // First check Gmail authorization
      const authResponse = await apiRequest("GET", "/api/gmail/auth-status");
      if (!authResponse.ok) {
        throw new Error("Failed to check Gmail authorization");
      }

      const authStatus = await authResponse.json();
      if (!authStatus.authorized) {
        throw new Error("Gmail authorization required. Please sign in with Google to grant email permissions.");
      }

      // Proceed with sending email
      const payload = {
        to: toEmail,
        subject: emailSubject,
        content: emailContent
      };
      const response = await apiRequest("POST", "/api/send-gmail", payload);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to send email");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Your email has been sent successfully via Gmail!",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Send Email",
        description: error instanceof Error ? error.message : "Failed to send email via Gmail",
        variant: "destructive",
      });
    },
  });

  const handleSendEmail = () => {
    if (!toEmail || !emailSubject || !emailContent) {
      toast({
        title: "Missing Information",
        description: "Please fill in all email fields before sending",
        variant: "destructive",
      });
      return;
    }
    sendEmailMutation.mutate();
  };

  const generateEmailMutation = useMutation({
    mutationFn: async () => {
      const selectedContact = contacts.find(c => c.id === selectedContactId);
      const payload = {
        emailPrompt,
        contact: selectedContact || null,
        company: currentCompany,
        toEmail,
        emailSubject
      };
      const res = await apiRequest("POST", "/api/generate-email", payload);
      return res.json();
    },
    onSuccess: (data) => {
      // Set the subject if empty and update content
      if (!emailSubject) {
        setEmailSubject(data.subject);
      }
      // Set the email if a contact is selected and has an email
      const selectedContact = contacts.find(c => c.id === selectedContactId);
      if (selectedContact?.email && !toEmail) {
        setToEmail(selectedContact.email);
      }
      setEmailContent(prev => `${data.content}\n\n${prev}`);
      toast({
        title: "Email Generated",
        description: "New content has been added above the existing email.",
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate email content",
        variant: "destructive",
      });
    },
  });

  const handleGenerateEmail = () => {
    if (!currentCompany) {
      toast({
        title: "No Company Selected",
        description: "Please select a company first",
        variant: "destructive",
      });
      return;
    }

    if (!emailPrompt) {
      toast({
        title: "No Prompt Provided",
        description: "Please enter an email creation prompt",
        variant: "destructive",
      });
      return;
    }

    generateEmailMutation.mutate();
  };

  const handleCopyContact = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent button click
    const textToCopy = `${contact.name}${contact.email ? ` <${contact.email}>` : ''}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      // Add to copied contacts set
      setCopiedContactIds(prev => new Set(prev).add(contact.id));
      
      // Remove from copied set after 2 seconds
      setTimeout(() => {
        setCopiedContactIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(contact.id);
          return newSet;
        });
      }, 2000);
    });
  };

  const handleCopyEmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    toast({
      title: "Email copied",
      description: "Email address copied to clipboard",
    });
  };

  const handleEmailContact = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    if (contact.email) {
      setToEmail(contact.email);
      setSelectedContactId(contact.id);
      toast({
        title: "Email populated",
        description: `${contact.name}'s email added to recipient field`,
      });
    }
  };

  // Smart contact pre-selection - auto-select highest probability contact
  useEffect(() => {
    if (topContacts.length > 0 && !selectedContactId) {
      const highestProbabilityContact = topContacts[0];
      setSelectedContactId(highestProbabilityContact.id);
      
      // Auto-populate email if available
      if (highestProbabilityContact.email && !toEmail) {
        setToEmail(highestProbabilityContact.email);
      }
    }
  }, [topContacts, selectedContactId, toEmail]);

  const handlePrevCompany = () => {
    if (currentCompanyIndex > 0) {
      setCurrentCompanyIndex(prev => prev - 1);
      // Don't reset selectedContactId immediately - let smart selection handle it
    }
  };

  const handleNextCompany = () => {
    if (currentCompanyIndex < companies.length - 1) {
      setCurrentCompanyIndex(prev => prev + 1);
      // Don't reset selectedContactId immediately - let smart selection handle it
    }
  };

  // Email enrichment handlers
  const handleEnrichContact = async (contactId: number) => {
    setPendingContactIds(prev => new Set(prev).add(contactId));
    
    try {
      const response = await apiRequest("POST", `/api/contacts/${contactId}/enrich`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to enrich contact");
      }
      
      // Refresh contacts for current company
      queryClient.invalidateQueries({ 
        queryKey: [`/api/companies/${currentCompany?.id}/contacts`] 
      });
      
      toast({
        title: "Contact Enriched",
        description: "Email search completed successfully",
      });
    } catch (error) {
      toast({
        title: "Enrichment Failed",
        description: error instanceof Error ? error.message : "Failed to enrich contact",
        variant: "destructive",
      });
    } finally {
      setPendingContactIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
    }
  };

  const handleHunterSearch = async (contactId: number) => {
    setPendingHunterIds(prev => new Set(prev).add(contactId));
    
    try {
      const response = await apiRequest("POST", `/api/contacts/${contactId}/hunter-search`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to search Hunter");
      }
      
      queryClient.invalidateQueries({ 
        queryKey: [`/api/companies/${currentCompany?.id}/contacts`] 
      });
      
      toast({
        title: "Hunter Search Complete",
        description: "Hunter.io email search completed",
      });
    } catch (error) {
      toast({
        title: "Hunter Search Failed",
        description: error instanceof Error ? error.message : "Failed to search Hunter.io",
        variant: "destructive",
      });
    } finally {
      setPendingHunterIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
    }
  };

  const handleAeroLeadsSearch = async (contactId: number) => {
    setPendingAeroLeadsIds(prev => new Set(prev).add(contactId));
    
    try {
      const response = await apiRequest("POST", `/api/contacts/${contactId}/aeroleads-search`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to search AeroLeads");
      }
      
      queryClient.invalidateQueries({ 
        queryKey: [`/api/companies/${currentCompany?.id}/contacts`] 
      });
      
      toast({
        title: "AeroLeads Search Complete",
        description: "AeroLeads email search completed",
      });
    } catch (error) {
      toast({
        title: "AeroLeads Search Failed",
        description: error instanceof Error ? error.message : "Failed to search AeroLeads",
        variant: "destructive",
      });
    } finally {
      setPendingAeroLeadsIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
    }
  };

  const handleApolloSearch = async (contactId: number) => {
    setPendingApolloIds(prev => new Set(prev).add(contactId));
    
    try {
      const response = await apiRequest("POST", `/api/contacts/${contactId}/apollo-search`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to search Apollo");
      }
      
      queryClient.invalidateQueries({ 
        queryKey: [`/api/companies/${currentCompany?.id}/contacts`] 
      });
      
      toast({
        title: "Apollo Search Complete",
        description: "Apollo.io email search completed",
      });
    } catch (error) {
      toast({
        title: "Apollo Search Failed",
        description: error instanceof Error ? error.message : "Failed to search Apollo.io",
        variant: "destructive",
      });
    } finally {
      setPendingApolloIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contactId);
        return newSet;
      });
    }
  };

  return (
    <div className="w-full lg:container lg:mx-auto lg:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-6">
        {/* Left Column */}
        <div>
          <Card className="border-none">
            <CardHeader>
              <div className="space-y-3">
                {/* List Selection Row */}
                <Select
                  value={selectedListId}
                  onValueChange={(value) => {
                    setSelectedListId(value);
                    setCurrentCompanyIndex(0); // Reset company index when changing list
                  }}
                >
                  <SelectTrigger className="[&>span]:pl-2">
                    <SelectValue placeholder="Select a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((list: List) => (
                      <SelectItem key={list.listId} value={list.listId.toString()}>
                        {generateShortListDisplayName(list)} ({list.resultCount} companies)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Title + Navigation Row */}
                <div className="flex items-center justify-center gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                  </CardTitle>
                  {companies.length > 0 && (
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="default"
                        className="px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
                        onClick={handlePrevCompany}
                        disabled={currentCompanyIndex === 0}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </Button>
                      <span className="text-sm text-muted-foreground font-medium">
                        {currentCompanyIndex + 1} of {companies.length}
                      </span>
                      <Button
                        variant="outline"
                        size="default"
                        className="px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
                        onClick={handleNextCompany}
                        disabled={currentCompanyIndex === companies.length - 1}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>

              {/* Key Members Section */}
              {topContacts && topContacts.length > 0 && (
                <div className="space-y-2">
                  {topContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={cn(
                          "w-full text-left p-3 relative cursor-pointer rounded-lg",
                          selectedContactId === contact.id 
                            ? "border-l-4 border-dashed border-gray-600 border-4 border-blue-200/60 border-dashed shadow-md transition-all duration-200" 
                            : "bg-card border-l-2 border-transparent hover:border-l-4 hover:border-dashed hover:border-gray-400 hover:border-4 hover:border-gray-300/60 hover:border-dashed hover:shadow-sm transition-all duration-50"
                        )}
                        onClick={() => setSelectedContactId(contact.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{contact.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              (contact.probability || 0) >= 90 ? "default" :
                              (contact.probability || 0) >= 70 ? "secondary" : "outline"
                            }>
                              {contact.probability || 0}
                            </Badge>
                            {/* Mobile Actions Menu */}
                            <ContactActionColumn
                              contact={contact as any}
                              standalone={true}
                              displayMode="mobile"
                              className="p-0"
                              handleEnrichContact={handleEnrichContact}
                              handleHunterSearch={handleHunterSearch}
                              handleAeroLeadsSearch={handleAeroLeadsSearch}
                              handleApolloSearch={handleApolloSearch}
                              pendingContactIds={pendingContactIds}
                              pendingHunterIds={pendingHunterIds}
                              pendingAeroLeadsIds={pendingAeroLeadsIds}
                              pendingApolloIds={pendingApolloIds}
                            />
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {contact.role && (
                            <span className="block">{contact.role}</span>
                          )}
                          {contact.email && (
                            <span className="block">{contact.email}</span>
                          )}
                        </div>
                        {/* Copy button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "absolute bottom-2 right-2 p-1.5",
                            "hover:bg-background/80 transition-colors",
                            copiedContactIds.has(contact.id) 
                              ? "text-green-600 hover:text-green-700" 
                              : "text-muted-foreground hover:text-foreground",
                            selectedContactId === contact.id && "hover:bg-primary-foreground/20"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyContact(contact, e);
                          }}
                        >
                          {copiedContactIds.has(contact.id) ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                  ))}
                </div>
              )}

              <div className="mt-6">
                <Card>
                  <CardContent className="pt-6">
                    {currentCompany ? (
                      <div className="space-y-2">
                        {/* Company Name with Link - More prominent */}
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <h2 className="text-xl font-semibold">{currentCompany.name}</h2>
                            <TooltipProvider delayDuration={500}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('Company view button clicked:', { id: currentCompany.id, name: currentCompany.name });
                                      setLocation(`/companies/${currentCompany.id}`);
                                    }}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Open company page</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          {currentCompany.size && (
                            <p className="text-muted-foreground">
                              {currentCompany.size} employees
                            </p>
                          )}
                        </div>

                        {/* Company Description */}
                        <div>
                          {currentCompany.description ? (
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {currentCompany.description}
                            </p>
                          ) : (
                            <p className="text-muted-foreground italic">No description available</p>
                          )}
                        </div>

                        {/* Company Website */}
                        {currentCompany.website && (
                          <div>
                            <p className="text-muted-foreground">
                              <a 
                                href={currentCompany.website.startsWith('http') ? currentCompany.website : `https://${currentCompany.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {currentCompany.website}
                              </a>
                            </p>
                          </div>
                        )}

                        {/* Alternative Profile URL */}
                        {currentCompany.alternativeProfileUrl && (
                          <div>
                            <p className="text-muted-foreground">
                              <span className="font-medium">Profile: </span>
                              <a 
                                href={currentCompany.alternativeProfileUrl.startsWith('http') ? currentCompany.alternativeProfileUrl : `https://${currentCompany.alternativeProfileUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {currentCompany.alternativeProfileUrl}
                              </a>
                            </p>
                          </div>
                        )}

                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        {selectedListId
                          ? "No companies found in this list"
                          : "Select a list to view company details"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Email Creation */}
        <div>
          <Card className="border-none">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" /> {/*Corrected Icon Here*/}
                </CardTitle>
                <Button onClick={handleGenerateEmail}>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Email
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Prompt Field */}
              <div>
                <Textarea
                  ref={promptTextareaRef}
                  placeholder="Enter your prompt for email generation..."
                  value={emailPrompt}
                  onChange={(e) => {
                    setEmailPrompt(e.target.value);
                    handlePromptTextareaResize();
                  }}
                  className="resize-none transition-all duration-200"
                  style={{ minHeight: '60px', maxHeight: '100px' }}
                />
              </div>

              {/* To Email Field */}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Recipient Email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  type="email"
                  className="pl-10"
                />
              </div>

              {/* Email Subject Field */}
              <div className="relative">
                <Type className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Email Subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Email Content Field */}
              <div>
                <Textarea
                  ref={textareaRef}
                  placeholder="Enter or edit the generated email content..."
                  value={emailContent}
                  onChange={(e) => {
                    setEmailContent(e.target.value);
                    handleTextareaResize();
                  }}
                  className="resize-none transition-all duration-200"
                  style={{ minHeight: '160px', maxHeight: '400px' }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 justify-end">
                <Button
                  variant="outline"
                  onClick={handleSaveEmail}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={sendEmailMutation.isPending}
                  className={cn(
                    sendEmailMutation.isSuccess && "bg-pink-500 hover:bg-pink-600"
                  )}
                >
                  {sendEmailMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : sendEmailMutation.isSuccess ? (
                    <>
                      <PartyPopper className="w-4 h-4 mr-2" />
                      Sent Email
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Email
                    </>
                  )}
                </Button>
              </div>

              {/* Quick Templates Section - Moved below email content and buttons */}
              <div className="mt-8 pt-6 border-t">
                <QuickTemplates
                  onSelectTemplate={(template: EmailTemplate) => {
                    setEmailPrompt(template.description || "");
                    setEmailContent(template.content);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}