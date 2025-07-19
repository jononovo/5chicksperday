import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ExternalLink, 
  Mail, 
  Gem,
  Target,
  Rocket,
  Star,
  ThumbsUp,
  ThumbsDown,
  Menu,
  Tag,
  Sparkles
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Company, Contact } from "@shared/schema";
import { ContactWithCompanyInfo } from "@/lib/results-analysis/prospect-filtering";
import { ContactActionColumn } from "@/components/contact-action-column";

interface CompanyTableProps {
  companies: Array<Company & { contacts?: ContactWithCompanyInfo[] }>;
  handleCompanyView: (companyId: number) => void;
  // Add these props to connect to existing functionality
  handleHunterSearch?: (contactId: number) => void;
  handleAeroLeadsSearch?: (contactId: number) => void;
  handleApolloSearch?: (contactId: number) => void;
  handleEnrichContact?: (contactId: number) => void;
  pendingHunterIds?: Set<number>;
  pendingAeroLeadsIds?: Set<number>;
  pendingApolloIds?: Set<number>;
  pendingContactIds?: Set<number>;
}

export default function CompanyTable({ 
  companies, 
  handleCompanyView,
  handleHunterSearch,
  handleAeroLeadsSearch,
  handleApolloSearch,
  handleEnrichContact,
  pendingHunterIds,
  pendingAeroLeadsIds,
  pendingApolloIds,
  pendingContactIds
}: CompanyTableProps) {
  // Move console logging to useEffect to avoid React warnings about state updates during render
  useEffect(() => {
    console.log('CompanyTable received companies:', 
      companies.map(c => ({ id: c.id, name: c.name }))
    );
  }, [companies]);
  
  // State to track which company rows are expanded
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // State to track selected companies and contacts
  const [selectedCompanies, setSelectedCompanies] = useState<Set<number>>(new Set());
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  
  // State to track "select all" status
  const [selectAll, setSelectAll] = useState(false);
  
  // Toggle expansion state for a company row
  const toggleRowExpansion = (companyId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };
  
  // Check if a company row is expanded
  const isRowExpanded = (companyId: number) => expandedRows.has(companyId);
  
  // Handle select all checkbox
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setSelectAll(isChecked);
    // Safe to keep this console.log as it's in an event handler, not during render
    console.log("Select all checkbox clicked:", isChecked);
    
    if (isChecked) {
      // Select all companies
      const companyIds = new Set(companies.map(company => company.id));
      setSelectedCompanies(companyIds);
      
      // Select all contacts
      const contactIds = new Set(
        companies.flatMap(company => 
          (company.contacts || []).map(contact => contact.id)
        )
      );
      setSelectedContacts(contactIds);
    } else {
      // Deselect all
      setSelectedCompanies(new Set());
      setSelectedContacts(new Set());
    }
  };
  
  // Toggle company selection
  const toggleCompanySelection = (e: React.MouseEvent, companyId: number) => {
    e.stopPropagation(); // Prevent row from expanding when clicking checkbox
    
    setSelectedCompanies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
    
    // Update select all status
    updateSelectAllStatus();
  };
  
  // Toggle contact selection
  const toggleContactSelection = (e: React.MouseEvent, contactId: number) => {
    e.stopPropagation();
    
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
    
    // Update select all status
    updateSelectAllStatus();
  };
  
  // Helper to update "select all" checkbox state
  const updateSelectAllStatus = () => {
    // Only set selectAll to true if ALL companies and contacts are selected
    const allCompanyIds = companies.map(company => company.id);
    const allContactIds = companies.flatMap(company => 
      (company.contacts || []).map(contact => contact.id)
    );
    
    const allCompaniesSelected = allCompanyIds.every(id => selectedCompanies.has(id));
    const allContactsSelected = allContactIds.every(id => selectedContacts.has(id));
    
    setSelectAll(allCompaniesSelected && allContactsSelected && allCompanyIds.length > 0);
  };
  
  // Update selectAll state whenever selections change
  useEffect(() => {
    updateSelectAllStatus();
  }, [selectedCompanies, selectedContacts]);

  // Auto-expand first company when new search results arrive
  useEffect(() => {
    // Only auto-expand if:
    // 1. We have companies
    // 2. No companies are currently expanded (fresh search)
    // 3. First company has meaningful contacts
    
    if (companies.length > 0 && expandedRows.size === 0) {
      const firstCompany = companies[0];
      const topContacts = getTopContacts(firstCompany);
      
      // Only expand if first company has contacts to show
      if (topContacts.length > 0) {
        console.log('Auto-expanding first company to show contacts:', firstCompany.name);
        setExpandedRows(new Set([firstCompany.id]));
      }
    }
  }, [companies]); // Trigger when companies data changes
  
  // Get top contacts for a company (up to 3)
  const getTopContacts = (company: Company & { contacts?: ContactWithCompanyInfo[] }) => {
    if (!company.contacts || company.contacts.length === 0) {
      return [];
    }
    
    // Sort by probability descending and take the top 3
    return [...company.contacts]
      .sort((a, b) => (b.probability || 0) - (a.probability || 0))
      .slice(0, 3);
  };

  return (
    <div className="w-full overflow-hidden relative rounded-md">
      {/* Fluffy gradient background for the entire table */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(219,234,254,0.6),rgba(239,246,255,0.4),rgba(224,242,254,0.3))] dark:bg-[radial-gradient(ellipse_at_bottom_right,rgba(30,58,138,0.2),rgba(37,99,235,0.15),rgba(29,78,216,0.1))] pointer-events-none"></div>
      <div className="relative z-10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox 
                  checked={selectAll}
                  onCheckedChange={(checked) => {
                    handleSelectAll({ target: { checked: checked === true } } as React.ChangeEvent<HTMLInputElement>);
                  }}
                  aria-label="Select all companies and contacts"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Details</TableHead>
              <TableHead className="hidden md:table-cell">Score</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {companies.map((company) => {
            const isExpanded = isRowExpanded(company.id);
            const topContacts = getTopContacts(company);
            
            return (
              <React.Fragment key={`company-${company.id}`}>
                {/* Main company row - always visible */}
                <TableRow 
                  className={`cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/40 hover:opacity-100 bg-transparent ${isExpanded ? 'h-5 opacity-50' : 'h-10 opacity-100'} transition-all duration-200`}
                  onClick={() => toggleRowExpansion(company.id)}
                >
                  <TableCell className={`px-2 ${isExpanded ? 'py-0' : 'py-1'}`}>
                    <Checkbox 
                      checked={selectedCompanies.has(company.id)}
                      onCheckedChange={(checked) => {
                        toggleCompanySelection({stopPropagation: () => {}} as React.MouseEvent, company.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${company.name}`}
                    />
                  </TableCell>
                  <TableCell className={`font-medium pl-1 ${isExpanded ? 'py-0' : 'py-1'}`}>
                    <div>{company.name}</div>
                    {!isExpanded && company.website && (
                      <div className="md:hidden text-xs text-muted-foreground leading-tight flex items-center gap-1">
                        <span className="text-blue-500">
                          {company.website.replace(/^https?:\/\//, '')}
                        </span>
                        <a 
                          href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-blue-700 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className={`hidden md:table-cell ${isExpanded ? 'py-0' : 'py-1'}`}>
                    {company.website ? (
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-blue-600">
                          {company.website.replace(/^https?:\/\//, '')}
                        </span>
                        <a 
                          href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-blue-800 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : null}
                    {!isExpanded && (
                      <div className="text-xs text-muted-foreground">
                        <span className="text-xs text-slate-500">
                          {company.contacts?.length || 0} contacts
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className={`hidden md:table-cell ${isExpanded ? 'py-0' : 'py-1'}`}>
                    {company.totalScore && company.totalScore > 0 && (
                      <Badge variant={company.totalScore > 70 ? "default" : "secondary"} className="opacity-50">
                        {company.totalScore}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={`text-center ${isExpanded ? 'py-0' : 'py-1'}`}>
                    <TooltipProvider delayDuration={500}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Company view button clicked:', { id: company.id, name: company.name });
                              handleCompanyView(company.id);
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
                  </TableCell>
                </TableRow>
                
                {/* Expanded details row - only visible when expanded */}
                {isExpanded && topContacts.map((contact) => (
                  <TableRow 
                    key={`${company.id}-contact-${contact.id}`} 
                    className="border-t-0 h-10 bg-white/75 dark:bg-slate-900/75 hover:bg-white dark:hover:bg-slate-800 hover:scale-[1.01] hover:origin-left hover:font-medium transition-all"
                  >
                    <TableCell className="px-2 py-1">
                      <Checkbox 
                        checked={selectedContacts.has(contact.id)}
                        onCheckedChange={(checked) => {
                          toggleContactSelection({stopPropagation: () => {}} as React.MouseEvent, contact.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${contact.name}`}
                      />
                    </TableCell>
                    <TableCell className="py-1 pl-1">
                      <div className="font-medium leading-tight">{contact.name}</div>
                      <div className="text-xs text-slate-500 leading-tight -mt-0.5 truncate max-w-[300px]" title={contact.role || "N/A"}>
                        {contact.role || "N/A"}
                      </div>
                      <div className="md:hidden text-xs text-muted-foreground leading-tight mt-0.5">
                        {contact.email || (
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-muted-foreground">
                                  <Mail className="h-4 w-4 text-gray-400" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <p>Use "Action" icons on this row to find this email. 👉🏼</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {Array.isArray(contact.alternativeEmails) && contact.alternativeEmails.length > 0 && (
                          <div className="text-xs opacity-75 mt-0.5 italic">
                            {contact.alternativeEmails.map((altEmail, index) => (
                              <div key={index} className="text-xs italic">
                                {altEmail}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1 hidden md:table-cell">
                      <div className="text-xs text-muted-foreground">
                        {contact.email || (
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-muted-foreground">
                                  <Mail className="h-4 w-4 text-gray-400" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <p>Use "Action" icons on this row to find this email. 👉🏼</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      {contact.alternativeEmails && contact.alternativeEmails.length > 0 && (
                        <div className="text-xs text-muted-foreground opacity-75 mt-1">
                          {contact.alternativeEmails.map((altEmail, index) => (
                            <div key={index} className="text-xs italic">
                              {altEmail}
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-1 hidden md:table-cell">
                      <Badge
                        variant="secondary"
                        className="text-xs opacity-50"
                      >
                        {contact.probability || 0}
                      </Badge>
                    </TableCell>
                    <ContactActionColumn
                      contact={contact}
                      handleContactView={(id) => {
                        console.log("View contact", id);
                        // Add contact view handler if needed
                      }}
                      handleEnrichContact={handleEnrichContact}
                      handleHunterSearch={handleHunterSearch}
                      handleAeroLeadsSearch={handleAeroLeadsSearch}
                      handleApolloSearch={handleApolloSearch}
                      pendingContactIds={pendingContactIds}
                      pendingHunterIds={pendingHunterIds}
                      pendingAeroLeadsIds={pendingAeroLeadsIds}
                      pendingApolloIds={pendingApolloIds}
                      className="py-1"
                    />
                  </TableRow>
                ))}
              </React.Fragment>
            );
          })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}