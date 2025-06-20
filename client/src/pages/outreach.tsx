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
  FileText,
  Users,
  User,
  Menu,
  Info,
  X
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { resolveMergeField, resolveAllMergeFields, hasMergeFields, type MergeFieldContext } from '@/lib/merge-field-resolver';


// Define interface for the saved state
interface SavedOutreachState {
  selectedListId?: string;
  selectedContactId: number | null;
  emailPrompt: string;
  emailContent: string;
  toEmail: string;
  emailSubject: string;
  selectedCompanyIndex: number;
  // Original content for merge field conversion
  originalEmailPrompt?: string;
  originalEmailContent?: string;
  originalEmailSubject?: string;
}

export default function Outreach() {
  const [selectedListId, setSelectedListId] = useState<string>();
  const [emailPrompt, setEmailPrompt] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedCompanyIndex, setCurrentCompanyIndex] = useState(0);
  const [currentContactIndex, setCurrentContactIndex] = useState(0);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [showExpandedView, setShowExpandedView] = useState(false);

  // Refs for form inputs to handle merge field insertion
  const emailPromptRef = useRef<HTMLTextAreaElement>(null);
  const emailSubjectRef = useRef<HTMLInputElement>(null);
  const emailContentRef = useRef<HTMLTextAreaElement>(null);
  const toEmailRef = useRef<HTMLInputElement>(null);

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
  
  // Tooltip state for mobile support
  const [tooltipOpen, setTooltipOpen] = useState(false);
  
  // Template edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  
  // Merge view toggle state (independent from edit mode)
  const [isMergeViewMode, setIsMergeViewMode] = useState(false);
  
  // Original template versions for merge field conversion
  const [originalEmailPrompt, setOriginalEmailPrompt] = useState("");
  const [originalEmailContent, setOriginalEmailContent] = useState("");
  const [originalEmailSubject, setOriginalEmailSubject] = useState("");
  
  // Scroll compression state
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Textarea refs for auto-resizing
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize functions
  const handleTextareaResize = () => {
    const textarea = emailContentRef.current;
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
      setCurrentCompanyIndex(parsed.selectedCompanyIndex || 0);
      // Load original content for merge field conversion
      setOriginalEmailPrompt(parsed.originalEmailPrompt || parsed.emailPrompt);
      setOriginalEmailContent(parsed.originalEmailContent || parsed.emailContent);
      setOriginalEmailSubject(parsed.originalEmailSubject || parsed.emailSubject || "");
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
      selectedCompanyIndex,
      originalEmailPrompt,
      originalEmailContent,
      originalEmailSubject
    };
    localStorage.setItem('outreachState', JSON.stringify(stateToSave));
  }, [selectedListId, selectedContactId, emailPrompt, emailContent, toEmail, emailSubject, selectedCompanyIndex, originalEmailPrompt, originalEmailContent, originalEmailSubject]);

  // Scroll compression effect
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 0;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
  const selectedCompany = companies[selectedCompanyIndex];

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: [`/api/companies/${selectedCompany?.id}/contacts`],
    enabled: !!selectedCompany?.id,
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

  // Get selected contact for mobile compact view
  const selectedContact = useMemo(() => 
    selectedContactId ? topContacts.find(contact => contact.id === selectedContactId) || topContacts[0] : topContacts[0]
  , [topContacts, selectedContactId]);



  // Adjacent company prefetching for instant navigation
  useEffect(() => {
    if (!companies.length) return;

    const prefetchAdjacentCompanies = () => {
      // Calculate range: current ±3 companies
      const start = Math.max(0, selectedCompanyIndex - 3);
      const end = Math.min(companies.length - 1, selectedCompanyIndex + 3);
      
      console.log(`Prefetching contacts for companies ${start} to ${end} (current: ${selectedCompanyIndex})`);
      
      for (let i = start; i <= end; i++) {
        // Skip current company (already loaded)
        if (i === selectedCompanyIndex) continue;
        
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
  }, [companies, selectedCompanyIndex]);

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

  const handleMergeFieldInsert = (mergeField: string) => {
    const activeElement = document.activeElement;
    
    if (activeElement === emailPromptRef.current && emailPromptRef.current) {
      const pos = emailPromptRef.current.selectionStart || emailPrompt.length;
      const newValue = emailPrompt.slice(0, pos) + mergeField + emailPrompt.slice(emailPromptRef.current.selectionEnd || pos);
      setEmailPrompt(newValue);
      // Restore focus and cursor position
      setTimeout(() => {
        emailPromptRef.current?.focus();
        emailPromptRef.current?.setSelectionRange(pos + mergeField.length, pos + mergeField.length);
      }, 0);
    } else if (activeElement === emailSubjectRef.current && emailSubjectRef.current) {
      const pos = emailSubjectRef.current.selectionStart || emailSubject.length;
      const newValue = emailSubject.slice(0, pos) + mergeField + emailSubject.slice(emailSubjectRef.current.selectionEnd || pos);
      setEmailSubject(newValue);
      setTimeout(() => {
        emailSubjectRef.current?.focus();
        emailSubjectRef.current?.setSelectionRange(pos + mergeField.length, pos + mergeField.length);
      }, 0);
    } else if (activeElement === emailContentRef.current && emailContentRef.current) {
      const pos = emailContentRef.current.selectionStart || emailContent.length;
      const newValue = emailContent.slice(0, pos) + mergeField + emailContent.slice(emailContentRef.current.selectionEnd || pos);
      setEmailContent(newValue);
      setTimeout(() => {
        emailContentRef.current?.focus();
        emailContentRef.current?.setSelectionRange(pos + mergeField.length, pos + mergeField.length);
      }, 0);
    } else if (activeElement === toEmailRef.current && toEmailRef.current) {
      const pos = toEmailRef.current.selectionStart || toEmail.length;
      const newValue = toEmail.slice(0, pos) + mergeField + toEmail.slice(toEmailRef.current.selectionEnd || pos);
      setToEmail(newValue);
      setTimeout(() => {
        toEmailRef.current?.focus();
        toEmailRef.current?.setSelectionRange(pos + mergeField.length, pos + mergeField.length);
      }, 0);
    }
  };

  // Template edit mode functions
  const enterEditMode = (template: EmailTemplate) => {
    setIsEditMode(true);
    setEditingTemplateId(template.id);
    setEditingTemplate(template);
    // Load template data into form fields
    setEmailPrompt(template.description || "");
    setEmailSubject(template.subject || "");
    setEmailContent(template.content || "");
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setEditingTemplateId(null);
    setEditingTemplate(null);
  };

  // Merge view toggle function
  const toggleMergeView = () => {
    setIsMergeViewMode(!isMergeViewMode);
  };

  const saveCurrentTemplate = () => {
    if (editingTemplateId && editingTemplate && emailPrompt && emailContent) {
      const templateData: InsertEmailTemplate = {
        name: editingTemplate.name, // Preserve original template name
        subject: emailSubject || editingTemplate.subject || "Email Template",
        content: emailContent,
        description: emailPrompt,
        category: editingTemplate.category || "saved",
        userId: user?.id || 1
      };
      
      updateMutation.mutate({
        id: editingTemplateId,
        template: templateData
      });
    }
  };

  // Content resolution utility functions
  const resolveContent = (content: string, contact: Contact | null) => {
    if (!contact || isEditMode) return content; // Show raw in edit mode
    
    const firstName = contact.name?.split(' ')[0] || '';
    const lastName = contact.name?.split(' ').slice(1).join(' ') || '';
    
    return content
      .replace(/\{\{company_name\}\}/g, selectedCompany?.name || '{{company_name}}')
      .replace(/\{\{contact_name\}\}/g, contact.name || '{{contact_name}}')
      .replace(/\{\{first_name\}\}/g, firstName || '{{first_name}}')
      .replace(/\{\{last_name\}\}/g, lastName || '{{last_name}}')
      .replace(/\{\{contact_role\}\}/g, contact.role || '{{contact_role}}')
      .replace(/\{\{sender_name\}\}/g, user?.email?.split('@')[0] || '{{sender_name}}');
  };

  const highlightMergeFields = (content: string) => {
    if (isEditMode) return content; // No highlighting in edit mode
    
    return content.replace(
      /(\{\{[^}]+\}\})/g,
      '<span style="background-color: rgba(156, 163, 175, 0.2); padding: 1px 2px; border-radius: 2px;">$1</span>'
    );
  };

  // Get the currently selected contact for merge field resolution
  const currentSelectedContact = selectedContactId ? contacts?.find(c => c.id === selectedContactId) : null;

  // Create merge field context
  const mergeFieldContext: MergeFieldContext = {
    contact: currentSelectedContact ? {
      name: currentSelectedContact.name,
      role: currentSelectedContact.role || undefined,
      email: currentSelectedContact.email || undefined,
    } : null,
    company: selectedCompany ? {
      name: selectedCompany.name,
    } : null,
    sender: {
      name: 'Your Name'
    }
  };

  // Custom merge field resolver for the highlighted components
  const resolveMergeFieldForHighlighting = (field: string) => {
    return resolveMergeField(field, mergeFieldContext);
  };

  // Functions to get display values for form fields with dual storage support
  const getDisplayValue = (content: string, originalContent?: string) => {
    if (isEditMode) return content;
    if (isMergeViewMode) return originalContent || content;
    return resolveAllMergeFields(originalContent || content, mergeFieldContext);
  };

  const handleSaveEmail = (templateName: string) => {
    if (!emailPrompt || !emailContent) {
      toast({
        title: "Missing Information",
        description: "Please provide both a prompt and email content to save the template",
        variant: "destructive",
      });
      return;
    }

    const templateData: InsertEmailTemplate = {
      name: templateName,
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

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; template: InsertEmailTemplate }) => {
      console.log('Updating email template:', {
        id: data.id,
        name: data.template.name,
        subject: data.template.subject
      });
      const res = await apiRequest("PUT", `/api/email-templates/${data.id}`, data.template);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      exitEditMode();
      toast({
        title: "Success",
        description: "Template updated successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update template",
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
        company: selectedCompany,
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
        setOriginalEmailSubject(data.subject);
      }
      // Set the email if a contact is selected and has an email
      const selectedContact = contacts.find(c => c.id === selectedContactId);
      if (selectedContact?.email && !toEmail) {
        setToEmail(selectedContact.email);
      }
      const newContent = `${data.content}\n\n${emailContent}`;
      setEmailContent(newContent);
      setOriginalEmailContent(newContent);
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
    if (!selectedCompany) {
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
      setCurrentContactIndex(0); // Reset to first contact
      
      // Auto-populate email if available
      if (highestProbabilityContact.email && !toEmail) {
        setToEmail(highestProbabilityContact.email);
      }
    }
  }, [topContacts, selectedContactId, toEmail]);

  // Reset contact index when company changes
  useEffect(() => {
    setCurrentContactIndex(0);
  }, [selectedCompanyIndex]);

  // Helper functions to check if navigation is possible
  const hasPrevCompanyWithContacts = () => {
    // If no companies or at first index, no prev available
    if (selectedCompanyIndex === 0) return false;
    
    for (let i = selectedCompanyIndex - 1; i >= 0; i--) {
      const company = companies[i];
      const contacts = queryClient.getQueryData([`/api/companies/${company.id}/contacts`]) as Contact[] || [];
      if (contacts.length > 0) return true;
    }
    return false;
  };

  const hasNextCompanyWithContacts = () => {
    // If no companies or at last index, no next available
    if (selectedCompanyIndex >= companies.length - 1) return false;
    
    for (let i = selectedCompanyIndex + 1; i < companies.length; i++) {
      const company = companies[i];
      const contacts = queryClient.getQueryData([`/api/companies/${company.id}/contacts`]) as Contact[] || [];
      if (contacts.length > 0) return true;
    }
    return false;
  };

  const handlePrevCompany = () => {
    // Find previous company with contacts
    for (let i = selectedCompanyIndex - 1; i >= 0; i--) {
      const company = companies[i];
      const contacts = queryClient.getQueryData([`/api/companies/${company.id}/contacts`]) as Contact[] || [];
      if (contacts.length > 0) {
        setCurrentCompanyIndex(i);
        return;
      }
    }
  };

  const handleNextCompany = () => {
    // Find next company with contacts, wrapping around to beginning
    const totalCompanies = companies.length;
    for (let offset = 1; offset < totalCompanies; offset++) {
      const nextIndex = (selectedCompanyIndex + offset) % totalCompanies;
      const company = companies[nextIndex];
      const contacts = queryClient.getQueryData([`/api/companies/${company.id}/contacts`]) as Contact[] || [];
      if (contacts.length > 0) {
        setCurrentCompanyIndex(nextIndex);
        return;
      }
    }
  };

  const handleNextContact = () => {
    if (topContacts.length === 0) return;
    
    const nextIndex = (currentContactIndex + 1) % topContacts.length;
    const nextContact = topContacts[nextIndex];
    
    setCurrentContactIndex(nextIndex);
    setSelectedContactId(nextContact.id);
    
    // Auto-populate email if available
    if (nextContact.email) {
      setToEmail(nextContact.email);
    }
  };

  const handleShowExpanded = () => {
    console.log('Chevron clicked - showing expanded view');
    setShowExpandedView(true);
    setSelectedContactId(null);
  };

  const handleCloseDuckHeader = () => {
    console.log('X clicked - closing duck header and restoring expanded view');
    setSelectedContactId(null);  // This will hide the header due to existing logic
    setShowExpandedView(true);   // Show expanded view as fallback
    setIsMobileExpanded(true);   // CRITICAL: Also restore the mobile expanded state for column visibility
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
        queryKey: [`/api/companies/${selectedCompany?.id}/contacts`] 
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
        queryKey: [`/api/companies/${selectedCompany?.id}/contacts`] 
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
        queryKey: [`/api/companies/${selectedCompany?.id}/contacts`] 
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
        queryKey: [`/api/companies/${selectedCompany?.id}/contacts`] 
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
    <div className="w-full md:container md:mx-auto md:py-8">
      {/* Mobile Duck Header - Only visible on mobile when in compressed view with selected contact */}
      <div className={`md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 transition-all duration-300 ${showExpandedView || !selectedContact ? 'hidden' : 'block'}`}>
        <div className={`flex items-center justify-center relative transition-all duration-300 ${isScrolled ? 'pt-1 pb-0.5' : 'pt-2 pb-1'}`}>

          <span className={`transition-all duration-300 ${isScrolled ? 'text-lg' : 'text-2xl'}`}>🐥</span>
          <span className={`ml-1 transition-all duration-300 ${isScrolled ? 'text-sm' : 'text-lg'}`}>🥚🥚🥚🥚</span>
          
          {/* X Close Button */}
          <button
            onClick={handleCloseDuckHeader}
            className={`absolute right-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all duration-300 ${isScrolled ? 'p-0.5' : 'p-1'}`}
          >
            <X className={`transition-all duration-300 ${isScrolled ? 'w-4 h-4' : 'w-5 h-5'}`} />
          </button>
        </div>
      </div>

      {/* Mobile Contact Card - Only visible on mobile */}
      <div className="md:hidden pt-0">
        {/* Mobile Company Navigation Bar - Above contact card */}
        {!isMobileExpanded && selectedCompany && selectedContact && (
          <div className={`md:hidden px-2.5 bg-white flex items-center justify-between z-[60] ${!showExpandedView && selectedContact ? '-mt-1' : '-mt-4'}`}>
            <div className="flex-1 text-left">
              <span className="font-medium text-sm text-muted-foreground">{selectedCompany.name}</span>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextCompany}
                className="px-2 h-8 flex items-center justify-center gap-0 text-muted-foreground/50 hover:text-muted-foreground/60 bg-gray-50/30 hover:bg-gray-100/40"
              >
                <Building2 className="w-2.5 h-2.5 mr-0.5" />
                <span className="text-[9px] text-muted-foreground/50">
                  {selectedCompanyIndex + 1}/{companies.length}
                </span>
                <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/50" />
              </Button>
              
              {topContacts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextContact}
                  className="px-2 h-8 flex items-center justify-center gap-0 text-muted-foreground hover:text-muted-foreground/80 bg-gray-50/30 hover:bg-gray-100/40"
                >
                  <User className="w-2.5 h-2.5" />
                  <span className="text-[9px] text-muted-foreground">
                    {currentContactIndex + 1}/{topContacts.length}
                  </span>
                  <ChevronRight className="w-2.5 h-2.5" />
                </Button>
              )}
            </div>
          </div>
        )}
        
        <AnimatePresence>
          {!isMobileExpanded && (
            <motion.div
              initial={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ 
                duration: 0.8,
                ease: "easeInOut",
                opacity: { duration: 0.6 },
                height: { duration: 0.8, delay: 0.2 }
              }}
              className="overflow-hidden"
            >
              {selectedContact && selectedCompany ? (
                <div 
                  className="mb-2 -mt-1 cursor-pointer"
                  onClick={handleCloseDuckHeader}
                >
                  <div className={cn(
                    "w-full text-left px-2.5 pt-1.5 pb-2.5 relative rounded-lg shadow-md border-t-0"
                  )}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{selectedContact.name}</span>
                      <div className="flex items-center gap-2 pr-6">
                        <Badge 
                          variant={
                            (selectedContact.probability || 0) >= 90 ? "default" :
                            (selectedContact.probability || 0) >= 70 ? "secondary" : "outline"
                          }
                          className="text-muted-foreground/60 text-xs"
                        >
                          {selectedContact.probability || 0}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0 whitespace-nowrap overflow-hidden text-ellipsis pr-8">
                      {selectedContact.role}
                    </div>
                    {selectedContact.email && (
                      <div className="text-sm text-muted-foreground mt-2">
                        {selectedContact.email}
                      </div>
                    )}
                    
                    {/* Copy button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "absolute bottom-1 right-2 p-1 h-8 w-6",
                        "hover:bg-background/80 transition-colors",
                        copiedContactIds.has(selectedContact.id) 
                          ? "text-green-600 hover:text-green-700" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyContact(selectedContact, e);
                      }}
                    >
                      {copiedContactIds.has(selectedContact.id) ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    
                    {/* Mobile Actions Menu */}
                    <div 
                      className="absolute top-2 right-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ContactActionColumn
                        contact={selectedContact as any}
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
                </div>
              ) : (
                <div 
                  className="mb-4 cursor-pointer"
                  onClick={handleCloseDuckHeader}
                >
                  <div className={cn(
                    "w-full text-left p-3 relative rounded-lg border border-dashed",
                    "border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors"
                  )}>
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>Tap to select a company and contact</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6">
        {/* Left Column - Hidden on mobile when collapsed */}
        <div 
          className={`md:block ${!isMobileExpanded ? 'hidden' : 'block'}`}
        >
          <div className="md:border md:rounded-lg md:shadow-sm">
            <div className="p-6 md:pb-6">
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
                        disabled={selectedCompanyIndex === 0}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </Button>
                      <span className="text-sm text-muted-foreground font-medium">
                        {selectedCompanyIndex + 1} of {companies.length}
                      </span>
                      <Button
                        variant="outline"
                        size="default"
                        className="px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
                        onClick={handleNextCompany}
                        disabled={selectedCompanyIndex === companies.length - 1}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 md:px-6 md:pb-6">

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
                        onClick={() => {
                          setSelectedContactId(contact.id);
                          // On mobile, immediately collapse after contact selection
                          if (typeof window !== 'undefined' && window.innerWidth < 768) { // md breakpoint
                            setIsMobileExpanded(false);
                            setShowExpandedView(false); // CRITICAL: Reset this so duck header can appear
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{contact.name}</span>
                          <div className="flex items-center gap-3">
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
                <div>
                  <div className="pt-6">
                    {selectedCompany ? (
                      <div className="border rounded-lg p-4 space-y-2">
                        {/* Company Name with Link - More prominent */}
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <h2 className="text-xl font-semibold">{selectedCompany.name}</h2>
                            <TooltipProvider delayDuration={500}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('Company view button clicked:', { id: selectedCompany.id, name: selectedCompany.name });
                                      setLocation(`/companies/${selectedCompany.id}`);
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
                          {selectedCompany.size && (
                            <p className="text-muted-foreground">
                              {selectedCompany.size} employees
                            </p>
                          )}
                        </div>

                        {/* Company Description */}
                        <div>
                          {selectedCompany.description ? (
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {selectedCompany.description}
                            </p>
                          ) : (
                            <p className="text-muted-foreground italic">No description available</p>
                          )}
                        </div>

                        {/* Company Website */}
                        {selectedCompany.website && (
                          <div>
                            <p className="text-muted-foreground">
                              <a 
                                href={selectedCompany.website.startsWith('http') ? selectedCompany.website : `https://${selectedCompany.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {selectedCompany.website}
                              </a>
                            </p>
                          </div>
                        )}

                        {/* Alternative Profile URL */}
                        {selectedCompany.alternativeProfileUrl && (
                          <div>
                            <p className="text-muted-foreground">
                              <span className="font-medium">Profile: </span>
                              <a 
                                href={selectedCompany.alternativeProfileUrl.startsWith('http') ? selectedCompany.alternativeProfileUrl : `https://${selectedCompany.alternativeProfileUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {selectedCompany.alternativeProfileUrl}
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
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Email Creation */}
        <div className={`md:block ${isMobileExpanded ? 'mt-4' : ''}`}>
          <div className="md:border md:rounded-lg md:shadow-sm">
            <div className="px-0 py-3 md:p-6 space-y-0 md:space-y-6">
              {/* Email Prompt Field */}
              <div className="relative border-t border-b md:border-t-0 md:border-b-0 md:mb-6 mb-4">
                <Textarea
                  ref={emailPromptRef}
                  placeholder="Sell dog-grooming services"
                  value={getDisplayValue(emailPrompt, originalEmailPrompt)}
                  onChange={(e) => {
                    setEmailPrompt(e.target.value);
                    setOriginalEmailPrompt(e.target.value);
                    handlePromptTextareaResize();
                  }}
                  className="mobile-input mobile-input-text-fix resize-none transition-all duration-200 pb-6 border-0 rounded-none md:border md:rounded-md px-3 md:px-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ minHeight: '32px', maxHeight: '100px' }}
                />
                  <div className="absolute bottom-2 right-2 flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
                        <TooltipTrigger asChild>
                        <button 
                          className="p-1 rounded hover:bg-accent transition-colors"
                          onClick={() => setTooltipOpen(!tooltipOpen)}
                          onBlur={() => setTooltipOpen(false)}
                        >
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-sm max-w-xs">
                        <p>Give us a sentence about your offer and we'll generate the email for you. It'll be awesome.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button 
                    onClick={handleGenerateEmail} 
                    variant="yellow"
                    disabled={generateEmailMutation.isPending}
                    className="h-8 px-3 text-xs hover:scale-105 transition-all duration-300 ease-out"
                  >
                    {generateEmailMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3 mr-1" />
                    )}
                    {generateEmailMutation.isPending ? "Generating..." : "Generate Email"}
                  </Button>
                </div>
              </div>

              {/* To Email Field */}
              <div className="relative border-b md:border-b-0 md:mb-6">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  ref={toEmailRef}
                  placeholder="Recipient Email"
                  value={getDisplayValue(toEmail)}
                  onChange={(e) => setToEmail(e.target.value)}
                  type="email"
                  className="mobile-input mobile-input-text-fix pl-10 border-0 rounded-none md:border md:rounded-md focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>

              {/* Email Subject Field */}
              <div className="relative border-b md:border-b-0 md:mb-6">
                <Type className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  ref={emailSubjectRef}
                  placeholder="Email Subject"
                  value={getDisplayValue(emailSubject, originalEmailSubject)}
                  onChange={(e) => {
                    setEmailSubject(e.target.value);
                    setOriginalEmailSubject(e.target.value);
                  }}
                  className="mobile-input mobile-input-text-fix pl-10 border-0 rounded-none md:border md:rounded-md focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>

              {/* Email Content Field */}
              <div className="relative md:mb-6">
                <Textarea
                  ref={emailContentRef}
                  placeholder="Enter or edit the generated email content..."
                  value={getDisplayValue(emailContent, originalEmailContent)}
                  onChange={(e) => {
                    setEmailContent(e.target.value);
                    setOriginalEmailContent(e.target.value);
                    handleTextareaResize();
                  }}
                  className="mobile-input mobile-input-text-fix resize-none transition-all duration-200 border-0 rounded-none md:border md:rounded-md px-3 md:px-3 pb-12 focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ minHeight: '160px', maxHeight: '400px' }}
                />
                <div className="absolute bottom-2 right-2">
                  <Button
                    onClick={handleSendEmail}
                    disabled={sendEmailMutation.isPending}
                    variant="outline"
                    className={cn(
                      "h-8 px-3 text-xs bg-white text-black border-black hover:bg-black hover:text-white hover:scale-105 transition-all duration-300 ease-out",
                      sendEmailMutation.isSuccess && "bg-pink-500 hover:bg-pink-600 text-white border-pink-500"
                    )}
                  >
                    {sendEmailMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : sendEmailMutation.isSuccess ? (
                      <>
                        <PartyPopper className="w-3 h-3 mr-1" />
                        Sent Email
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3 mr-1" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Quick Templates Section - Moved below email content and buttons */}
              <div className="mt-8 pt-6 border-t">
                <QuickTemplates
                  onSelectTemplate={(template: EmailTemplate) => {
                    setEmailPrompt(template.description || "");
                    setEmailContent(template.content);
                    setEmailSubject(template.subject || "");
                    // Store original versions for merge field conversion
                    setOriginalEmailPrompt(template.description || "");
                    setOriginalEmailContent(template.content);
                    setOriginalEmailSubject(template.subject || "");
                  }}
                  onSaveTemplate={handleSaveEmail}
                  onUpdateTemplate={saveCurrentTemplate}
                  onMergeFieldInsert={handleMergeFieldInsert}
                  onEditTemplate={enterEditMode}
                  isEditMode={isEditMode}
                  editingTemplateId={editingTemplateId}
                  onExitEditMode={exitEditMode}
                  isMergeViewMode={isMergeViewMode}
                  onToggleMergeView={toggleMergeView}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}