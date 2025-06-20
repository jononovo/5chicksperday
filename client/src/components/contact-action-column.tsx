import React from "react";
import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Eye, 
  Menu,
  Sparkles,
  Target,
  Gem,
  Rocket
} from "lucide-react";
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
import { ContactWithCompanyInfo } from "@/lib/results-analysis/prospect-filtering";

export interface ContactActionColumnProps {
  // Core data
  contact: ContactWithCompanyInfo;
  
  // Display mode configuration
  displayMode?: 'auto' | 'desktop' | 'mobile';
  
  // Whether to render as a TableCell or standalone
  standalone?: boolean;
  
  // Action handlers
  handleContactView?: (contactId: number) => void;
  handleEnrichContact?: (contactId: number) => void;
  handleHunterSearch?: (contactId: number) => void;
  handleAeroLeadsSearch?: (contactId: number) => void;
  handleApolloSearch?: (contactId: number) => void;
  
  // State tracking
  pendingContactIds?: Set<number>;
  pendingHunterIds?: Set<number>;
  pendingAeroLeadsIds?: Set<number>;
  pendingApolloIds?: Set<number>;
  
  // Optional custom class
  className?: string;
}

export function ContactActionColumn({
  contact,
  displayMode = 'auto',
  standalone = false,
  handleContactView,
  handleEnrichContact,
  handleHunterSearch,
  handleAeroLeadsSearch,
  handleApolloSearch,
  pendingContactIds = new Set(),
  pendingHunterIds = new Set(),
  pendingAeroLeadsIds = new Set(),
  pendingApolloIds = new Set(),
  className = '',
}: ContactActionColumnProps) {
  
  // Helper functions for checking state
  const isPending = {
    contact: (id: number) => pendingContactIds.has(id),
    hunter: (id: number) => pendingHunterIds.has(id),
    aeroLeads: (id: number) => pendingAeroLeadsIds.has(id),
    apollo: (id: number) => pendingApolloIds.has(id)
  };
  
  const isComplete = {
    contact: (c: ContactWithCompanyInfo) => c.completedSearches?.includes('contact_enrichment') || false,
    hunter: (c: ContactWithCompanyInfo) => c.completedSearches?.includes('hunter') || false,
    aeroLeads: (c: ContactWithCompanyInfo) => c.completedSearches?.includes('aeroleads') || false,
    apollo: (c: ContactWithCompanyInfo) => c.completedSearches?.includes('apollo_search') || false
  };
  
  const getSuccessColor = {
    contact: "text-green-500",
    hunter: "text-green-500",
    aeroLeads: "text-yellow-500", 
    apollo: "text-purple-500"
  };
  
  // Determine desktop/mobile visibility based on displayMode
  const desktopClassName = displayMode === 'mobile' ? 'hidden' : 
                           displayMode === 'desktop' ? 'flex' : 
                           'hidden md:flex';
  
  const mobileClassName = displayMode === 'desktop' ? 'hidden' : 
                          displayMode === 'mobile' ? 'block' : 
                          'md:hidden';

  // Inner content with both views
  const content = (
    <>
      {/* Desktop view */}
      <div className={`${desktopClassName} items-center justify-center gap-1 ${className}`}>
        <TooltipProvider delayDuration={500}>
          {/* View button */}
          {handleContactView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContactView(contact.id);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View contact details</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Apollo search button */}
          {handleApolloSearch && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={isPending.apollo(contact.id) || isComplete.apollo(contact)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApolloSearch(contact.id);
                  }}
                >
                  {isPending.apollo(contact.id) ? (
                    <div className="animate-spin h-4 w-4">
                      <Rocket className="h-4 w-4 text-gray-700" />
                    </div>
                  ) : (
                    <Rocket className={`h-4 w-4 ${isComplete.apollo(contact) && contact.email ? getSuccessColor.apollo : "text-gray-700"}`} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Apollo.io email search</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* AI-powered search button */}
          {handleEnrichContact && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={isPending.contact(contact.id) || isComplete.contact(contact)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEnrichContact(contact.id);
                  }}
                >
                  {isPending.contact(contact.id) ? (
                    <div className="animate-spin h-4 w-4">
                      <Sparkles className="h-4 w-4 text-gray-700" />
                    </div>
                  ) : (
                    <Sparkles className={`h-4 w-4 ${isComplete.contact(contact) && contact.email ? getSuccessColor.contact : "text-gray-700"}`} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>AI-powered email search</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Hunter search button */}
          {handleHunterSearch && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={isPending.hunter(contact.id) || isComplete.hunter(contact)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHunterSearch(contact.id);
                  }}
                >
                  {isPending.hunter(contact.id) ? (
                    <div className="animate-spin h-4 w-4">
                      <Target className="h-4 w-4 text-gray-700" />
                    </div>
                  ) : (
                    <Target className={`h-4 w-4 ${isComplete.hunter(contact) && contact.email ? getSuccessColor.hunter : "text-gray-700"}`} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Hunter.io email search</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* AeroLeads search button */}
          {handleAeroLeadsSearch && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={isPending.aeroLeads(contact.id) || isComplete.aeroLeads(contact)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAeroLeadsSearch(contact.id);
                  }}
                >
                  {isPending.aeroLeads(contact.id) ? (
                    <div className="animate-spin h-4 w-4">
                      <Gem className="h-4 w-4 text-gray-700" />
                    </div>
                  ) : (
                    <Gem className={`h-4 w-4 ${isComplete.aeroLeads(contact) && contact.email ? getSuccessColor.aeroLeads : "text-gray-700"}`} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>AeroLeads email search</p>
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
      
      {/* Mobile view */}
      <div className={`${mobileClassName} ${className}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Menu className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* View contact menu item */}
            {handleContactView && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleContactView(contact.id);
                }}
              >
                <Eye className="mr-2 h-5 w-5 text-gray-700" />
                View Contact
              </DropdownMenuItem>
            )}
            
            {/* Apollo search menu item */}
            {handleApolloSearch && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleApolloSearch(contact.id);
                }}
                disabled={isPending.apollo(contact.id) || isComplete.apollo(contact)}
              >
                {isPending.apollo(contact.id) ? (
                  <div className="animate-spin mr-2 h-5 w-5">
                    <Rocket className="h-5 w-5 text-gray-700" />
                  </div>
                ) : (
                  <Rocket className={`mr-2 h-5 w-5 ${isComplete.apollo(contact) && contact.email ? getSuccessColor.apollo : "text-gray-700"}`} />
                )}
                Apollo.io Search
              </DropdownMenuItem>
            )}
            
            {/* AI-powered search menu item */}
            {handleEnrichContact && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnrichContact(contact.id);
                }}
                disabled={isPending.contact(contact.id) || isComplete.contact(contact)}
              >
                {isPending.contact(contact.id) ? (
                  <div className="animate-spin mr-2 h-5 w-5">
                    <Sparkles className="h-5 w-5 text-gray-700" />
                  </div>
                ) : (
                  <Sparkles className={`mr-2 h-5 w-5 ${isComplete.contact(contact) && contact.email ? getSuccessColor.contact : "text-gray-700"}`} />
                )}
                AI-powered Search
              </DropdownMenuItem>
            )}
            
            {/* Hunter search menu item */}
            {handleHunterSearch && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleHunterSearch(contact.id);
                }}
                disabled={isPending.hunter(contact.id) || isComplete.hunter(contact)}
              >
                {isPending.hunter(contact.id) ? (
                  <div className="animate-spin mr-2 h-5 w-5">
                    <Target className="h-5 w-5 text-gray-700" />
                  </div>
                ) : (
                  <Target className={`mr-2 h-5 w-5 ${isComplete.hunter(contact) && contact.email ? getSuccessColor.hunter : "text-gray-700"}`} />
                )}
                Hunter Search
              </DropdownMenuItem>
            )}
            
            {/* AeroLeads search menu item */}
            {handleAeroLeadsSearch && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleAeroLeadsSearch(contact.id);
                }}
                disabled={isPending.aeroLeads(contact.id) || isComplete.aeroLeads(contact)}
              >
                {isPending.aeroLeads(contact.id) ? (
                  <div className="animate-spin mr-2 h-5 w-5">
                    <Gem className="h-5 w-5 text-gray-700" />
                  </div>
                ) : (
                  <Gem className={`mr-2 h-5 w-5 ${isComplete.aeroLeads(contact) && contact.email ? getSuccessColor.aeroLeads : "text-gray-700"}`} />
                )}
                AeroLeads Search
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
  
  // Return either standalone or wrapped in TableCell
  return standalone ? content : <TableCell>{content}</TableCell>;
}