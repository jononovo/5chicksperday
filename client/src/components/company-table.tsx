import { useState } from "react";
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
  ThumbsDown
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Company, Contact } from "@shared/schema";
import { ContactWithCompanyInfo } from "@/lib/results-analysis/prospect-filtering";

interface CompanyTableProps {
  companies: Array<Company & { contacts?: ContactWithCompanyInfo[] }>;
  handleCompanyView: (companyId: number) => void;
}

export default function CompanyTable({ companies, handleCompanyView }: CompanyTableProps) {
  console.log('CompanyTable received companies:', 
    companies.map(c => ({ id: c.id, name: c.name }))
  );
  
  // State to track which company rows are expanded
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
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
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <input 
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                aria-label="Select all companies and contacts"
                onChange={(e) => {
                  // Logic to select/deselect all will be implemented here
                  console.log("Select all checkbox clicked:", e.target.checked);
                }}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => {
            console.log('Rendering company row:', { id: company.id, name: company.name });
            const isExpanded = isRowExpanded(company.id);
            const topContacts = getTopContacts(company);
            
            return (
              <>
                {/* Main company row - always visible */}
                <TableRow 
                  key={company.id} 
                  className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 bg-slate-100/50 dark:bg-slate-800/20 ${isExpanded ? 'h-5 opacity-50' : 'h-10 opacity-100'} transition-all duration-200`}
                  onClick={() => toggleRowExpansion(company.id)}
                >
                  <TableCell className="px-2 py-1">
                    <input 
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      aria-label={`Select ${company.name}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className="font-medium py-1">
                    {company.name}
                  </TableCell>
                  <TableCell className="py-1">
                    {company.website ? (
                      <a 
                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {company.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      <span className="text-xs text-slate-500">
                        {company.contacts?.length || 0} contacts
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-1">
                    <Badge variant={company.totalScore && company.totalScore > 70 ? "default" : "secondary"}>
                      {company.totalScore ?? 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1">
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
                    className="border-t-0 h-10"
                  >
                    <TableCell className="px-2 py-1">
                      <input 
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        aria-label={`Select ${contact.name}`}
                      />
                    </TableCell>
                    <TableCell className="py-1">
                      <div className="font-medium leading-tight">{contact.name}</div>
                      <div className="text-xs text-slate-500 leading-tight -mt-0.5 truncate max-w-[300px]" title={contact.role || "N/A"}>
                        {contact.role || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="py-1">
                      <span className="text-xs text-muted-foreground">
                        {contact.email || "Email not available"}
                      </span>
                    </TableCell>
                    <TableCell className="py-1">
                      <Badge
                        variant={(contact.probability || 0) >= 80 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {contact.probability || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1">
                      <div className="flex items-center gap-1">
                        <TooltipProvider delayDuration={500}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Open contact page</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Find email</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <Gem className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>AeroLeads search</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <Target className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Hunter.io search</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <Rocket className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Add to campaign</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}