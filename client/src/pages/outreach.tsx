import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  UserCircle,
  Send,
  Save,
  Wand2,
  Copy,
  ChevronLeft,
  ChevronRight,
  PartyPopper
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
import { useState, useEffect } from "react";
import QuickTemplates from "@/components/quick-templates";
import type { EmailTemplate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import {Loader2} from "lucide-react";
import { queryClient } from "@/lib/queryClient"; // Import queryClient
import type { InsertEmailTemplate } from "@shared/schema"; // Import the type


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
  });

  // Auto-select newest list if none selected
  useEffect(() => {
    if (!selectedListId && lists.length > 0) {
      setSelectedListId(lists[0].listId.toString());
    }
  }, [lists, selectedListId]);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: [`/api/lists/${selectedListId}/companies`],
    enabled: !!selectedListId,
  });

  // Get the current company based on the index
  const currentCompany = companies[currentCompanyIndex];

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: [`/api/companies/${currentCompany?.id}/contacts`],
    enabled: !!currentCompany?.id,
  });

  // Get top 3 leadership contacts
  const topContacts = contacts
    ?.filter(contact => contact.probability && contact.probability >= 70) // Filter high probability contacts
    .sort((a, b) => (b.probability || 0) - (a.probability || 0)) // Sort by probability
    .slice(0, 3);

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
      category: "saved"
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
      toast({
        title: "Copied to clipboard",
        description: `Contact information for ${contact.name} has been copied.`
      });
    });
  };

  const handlePrevCompany = () => {
    if (currentCompanyIndex > 0) {
      setCurrentCompanyIndex(prev => prev - 1);
      setSelectedContactId(null); // Reset selected contact when changing company
    }
  };

  const handleNextCompany = () => {
    if (currentCompanyIndex < companies.length - 1) {
      setCurrentCompanyIndex(prev => prev + 1);
      setSelectedContactId(null); // Reset selected contact when changing company
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-2 gap-6">
        {/* Left Column */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="w-5 h-5" />
                  {companies.length > 0 && (
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevCompany}
                        disabled={currentCompanyIndex === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {currentCompanyIndex + 1} of {companies.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextCompany}
                        disabled={currentCompanyIndex === companies.length - 1}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedListId}
                onValueChange={(value) => {
                  setSelectedListId(value);
                  setCurrentCompanyIndex(0); // Reset company index when changing list
                }}
              >
                <SelectTrigger>
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

              {/* Key Members Section */}
              {topContacts && topContacts.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Key Members</h3>
                  <div className="space-y-2">
                    {topContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-colors relative cursor-pointer",
                          "hover:bg-accent hover:text-accent-foreground",
                          selectedContactId === contact.id && "bg-primary text-primary-foreground",
                          selectedContactId !== contact.id && "bg-card hover:bg-accent"
                        )}
                        onClick={() => setSelectedContactId(contact.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{contact.name}</span>
                          <Badge variant={
                            (contact.probability || 0) >= 90 ? "default" :
                            (contact.probability || 0) >= 70 ? "secondary" : "outline"
                          }>
                            {contact.probability || 0}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {contact.email && (
                            <span className="block">{contact.email}</span>
                          )}
                          {contact.role && (
                            <span className="block">{contact.role}</span>
                          )}
                        </div>
                        {/* Copy button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "absolute bottom-2 right-2 p-1.5",
                            "hover:bg-background/80 transition-colors",
                            "text-muted-foreground hover:text-foreground",
                            selectedContactId === contact.id && "hover:bg-primary-foreground/20 text-primary-foreground"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyContact(contact, e);
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Company Summary</h3>
                <Card>
                  <CardContent className="pt-6">
                    {currentCompany ? (
                      <div className="space-y-6">
                        {/* Company Name - More prominent */}
                        <div>
                          <h2 className="text-xl font-semibold mb-1">{currentCompany.name}</h2>
                          {currentCompany.size && (
                            <p className="text-muted-foreground">
                              {currentCompany.size} employees
                            </p>
                          )}
                        </div>

                        {/* Services Section */}
                        <div>
                          <h4 className="font-medium mb-2">Services & Description</h4>
                          {currentCompany.services && currentCompany.services.length > 0 ? (
                            <ul className="list-disc pl-4 space-y-1">
                              {currentCompany.services.map((service, index) => (
                                <li key={index} className="text-muted-foreground">{service}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground italic">No services information available</p>
                          )}
                        </div>
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
          <Card>
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
                <label className="text-sm font-medium mb-2 block">
                  Email Creation Prompt
                </label>
                <Textarea
                  placeholder="Enter your prompt for email generation..."
                  value={emailPrompt}
                  onChange={(e) => setEmailPrompt(e.target.value)}
                  className="resize-none"
                  rows={4}
                />
              </div>

              {/* To Email Field */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  To Email
                </label>
                <Input
                  placeholder="Recipient email address..."
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  type="email"
                />
              </div>

              {/* Email Subject Field */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Email Subject
                </label>
                <Input
                  placeholder="Enter email subject..."
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>

              {/* Email Content Field */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Email Content
                </label>
                <Textarea
                  placeholder="Enter or edit the generated email content..."
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  className="min-h-[400px]"
                  rows={20}
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