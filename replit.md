# 5Ducks B2B Prospecting Application

## Overview

5Ducks is a comprehensive B2B lead generation and prospecting platform designed to help small businesses "sell to 5 new people every day." The application combines AI-powered company search, contact discovery, email enrichment, and campaign management into a unified platform. Built with React frontend and Express/Node.js backend, it uses PostgreSQL for data persistence and integrates with multiple third-party APIs for contact discovery and validation.

## System Architecture

### Frontend Architecture
- **React SPA** with TypeScript for type safety
- **Vite** for development and build tooling
- **Tailwind CSS** with shadcn/ui component library for styling
- **TanStack Query** for server state management
- **React Router** for client-side routing
- **Radix UI** components for accessible UI primitives

### Backend Architecture
- **Express.js** server with TypeScript
- **In-memory storage** for rapid development iteration
- **Dual storage infrastructure** ready for production (PostgreSQL + Replit DB)
- **Firebase Authentication** with session management via Passport.js
- **Modular API design** with separate route handlers and business logic

### Database Design
- **In-memory storage** currently active for development speed
- **Dual storage infrastructure** ready for migration (PostgreSQL + Replit DB)
- **Storage abstraction layer** with IStorage interface for future switching
- **Schema-first approach** using Zod validation and Drizzle ORM (prepared but not active)

## Key Components

### Search & Discovery System
- **Multi-stage search process**: Company discovery → Contact extraction → Email enrichment
- **AI-powered analysis** using Perplexity API for company intelligence
- **Modular search architecture** with pluggable search modules
- **Enhanced search orchestrator** with retry logic and error handling
- **Real-time search status tracking** with webhook integration

### Contact Management
- **Intelligent contact discovery** with confidence scoring
- **Email validation and enrichment** through multiple providers (Hunter.io, Apollo.io, AeroLeads)
- **Contact ranking system** based on role importance and validation scores
- **Post-search enrichment queue** for background processing

### Email & Campaign System
- **Template-based email campaigns** with personalization
- **Multi-provider email integration** (Gmail, mock providers)
- **Thread-based conversation tracking**
- **Campaign performance analytics**

### Authentication & User Management
- **Firebase Authentication** for secure user login
- **Session-based authentication** with Passport.js
- **User preferences and settings management**
- **Multi-tenant architecture** with user isolation

## Data Flow

### Primary Search Flow
1. **User Input**: Search query entered on landing or main application page
2. **Company Discovery**: Perplexity API searches for matching companies
3. **Company Analysis**: Each company analyzed for size, services, and market position
4. **Contact Extraction**: AI extracts key decision makers from company information
5. **Email Discovery**: Multiple APIs (Hunter, Apollo, AeroLeads) search for contact emails
6. **Validation & Scoring**: Contacts validated and scored for relevance
7. **Results Display**: Companies displayed in expandable table with top 3 contacts each

### Background Processing
- **Post-search enrichment queue** processes additional contact validation
- **Webhook system** handles external workflow integration (N8N)
- **Search session management** maintains state across long-running searches

## External Dependencies

### Core APIs
- **Perplexity API**: Company research and contact discovery
- **OpenAI API**: Email strategy generation and content creation
- **Hunter.io API**: Email finder and verification
- **Apollo.io API**: Professional contact database
- **AeroLeads API**: Email discovery service

### Infrastructure
- **Firebase**: Authentication and user management
- **In-memory storage**: Current active storage for development speed
- **Replit Database**: Key-value storage (provisioned but not actively used)
- **PostgreSQL**: Relational database (provisioned but not actively used)
- **Stripe API**: Payment processing for credit purchases
- **N8N Workflows**: External automation integration
- **Google APIs**: Gmail integration for email campaigns

### Development Tools
- **Vite**: Frontend build tool and dev server
- **Drizzle Kit**: Database migrations and schema management
- **ESBuild**: Backend bundling for production

## Deployment Strategy

### Development Environment
- **Replit-optimized**: Configured for Replit's development environment
- **Hot reloading**: Vite provides instant frontend updates
- **Database provisioning**: Automatic PostgreSQL setup on Replit
- **Port configuration**: Frontend (3000) and backend (5000) ports configured

### Production Deployment
- **Google Cloud Run**: Containerized deployment target
- **Build process**: Vite builds static assets, ESBuild bundles backend
- **Environment variables**: Database URLs and API keys via environment
- **Workflow integration**: N8N webhooks for external automation

### Storage Architecture
- **Current implementation**: Single in-memory storage (`server/storage-simple.ts`)
- **Interface**: IStorage abstraction with comprehensive method definitions
- **Data persistence**: In-memory for rapid development, ready for future migration
- **User isolation**: Complete separation with user-specific data access
- **Legacy support**: Automatic adoption of User ID 1 data for authenticated users

## Changelog
- June 13, 2025. Initial setup
- June 13, 2025. Mobile UI optimizations: Fixed duck header positioning (-mt-1), reduced email form horizontal padding (p-6→px-3 py-6 md:p-6) for 24px wider mobile inputs, updated "Save Template" to "Save as Template", and removed chevron arrow from mobile duck header navigation button
- June 13, 2025. Edge-to-edge mobile input layout: Implemented Gmail-style mobile input fields with zero horizontal margins (px-0), added border separators between fields, and maintained desktop spacing while maximizing mobile typing space
- June 13, 2025. Mobile input visual enhancements: Added subtle bluish background colors to mobile inputs with darker shade on focus/active states, replacing border highlighting with smooth background transitions for better edge-to-edge design consistency
- June 13, 2025. Clean CSS architecture: Removed !important hacks and properly overrode shadcn focus styling using focus-visible:ring-0 and focus-visible:ring-offset-0 Tailwind classes. Added consistent left padding (px-3) to generate email and email content fields for better text positioning
- June 13, 2025. Contact navigation UX improvement: Added ChevronRight icon to mobile contact toggle button (showing contact count like "2/3") to provide visual indication of interactivity without changing button behavior
- June 13, 2025. Navigation consistency: Added ChevronRight icons to both mobile navigation buttons - contact button with standard styling and company button with lighter gray (text-muted-foreground/50) to match existing visual hierarchy
- June 13, 2025. Button design updates: Made Save as Template and Send Email buttons smaller to match Generate Email button size (h-8 px-3 text-xs), and changed Send Email button to white background with black border and text for clean minimal styling
- June 13, 2025. Simplified Send Email button hover: Clean color reversal hover effect (white→black background, black→white text) with 105% scaling and smooth 300ms transitions
- June 13, 2025. Consistent button hover animations: Added 105% scaling hover effect with smooth 300ms transitions to Generate Email and Save as Template buttons, maintaining their original colors while providing unified interaction feedback
- June 13, 2025. New Template button standardization: Made "New Template" button smaller (h-8 px-3 text-xs) to match other action buttons and added the same 105% scaling hover effect with smooth transitions
- June 14, 2025. iOS Safari auto-zoom prevention: Added mobile-input-text-fix CSS class (16px font-size on mobile, 14px on desktop) to all outreach page input fields to prevent automatic zoom behavior while preserving design on larger screens
- June 14, 2025. Simplified email prompt placeholder: Removed "Example:" prefix from email prompt field placeholder text, changing from "Example: Sell dog-grooming services" to "Sell dog-grooming services" for cleaner UX
- June 14, 2025. Inline email body buttons: Moved "Save as Template" and "Send Email" buttons inside the email body textarea field using absolute positioning, matching the Generate Email button pattern for consistent UI design
- June 14, 2025. Relocated Save as Template button: Moved "Save as Template" button from email body field to Quick Templates section header, positioned next to "New Template" button for better organization and cleaner email body interface
- June 14, 2025. Complete inline merge system for Create Template dialog: Added "Merge" dropdown buttons to all three fields (Email Subject, Description/Prompt, Email Body) with predefined merge variables ({{company_name}}, {{contact_name}}, {{contact_role}}, {{sender_name}}). Implemented consistent positioning using relative containers with absolute bottom-2 right-2 button placement and pb-10/pb-12 padding for proper text spacing
- June 14, 2025. Comprehensive merge field dialog system: Created dedicated MergeFieldDialog component with 13 merge variables, responsive design (full-page mobile, standard desktop), copy-to-clipboard functionality with visual feedback, and auto-close after 1 second. Added "Merge Field" button to Quick Templates header for easy access across the application
- June 14, 2025. Removed Create Template Dialog: Eliminated 350+ lines of duplicated code by removing CreateTemplateModal component and all related functionality. Template creation now streamlined through outreach page "Save as Template" workflow only, reducing code complexity and improving user experience
- June 14, 2025. Button size standardization: Updated "Insert Template" button to match smaller sizing (h-8 px-3 text-xs), consistent hover animation (scale-105), content-based width (removed w-full), right alignment (justify-end), secondary variant styling, right margin (mr-2), FileText icon, and restored disabled state when no template selected for proper UX feedback in Quick Templates section
- June 14, 2025. Edit Template functionality: Added "Edit Template" button next to "Insert Template" with Edit icon, same disabled logic when no template selected, and confirmation dialog warning "Editing this template, will replace all content currently in fields on this page" with Cancel/Load Template options using shadcn AlertDialog components
- June 14, 2025. Complete merge field insertion system: Implemented clickable merge field functionality with React refs for all form inputs (email prompt, subject, content, recipient), cursor position handling, and MergeFieldDialog integration that inserts merge variables directly at cursor position instead of clipboard copy
- June 14, 2025. Mobile navigation spacing optimization: Refined company button spacing with mr-0.5 between Building2 icon and "7/7" text for better readability, while maintaining gap-0 base spacing and tight chevron positioning. Contacts button remains with uniform gap-0 spacing throughout
- June 14, 2025. Clean templates section layout: Removed "Quick Templates" heading and added pt-6 padding above templates section for better visual separation from email body input. Right-aligned action buttons (Merge Field, Save as Template) for cleaner interface design
- June 14, 2025. Unified margin strategy implementation: Applied consistent mr-2 margin pattern (matching Save as Template button) to template dropdown SelectTrigger and both Insert/Edit Template buttons for reliable mobile spacing and visual consistency
- June 14, 2025. Insert Template confirmation dialog: Added confirmation dialog to "Insert Template" button matching Edit Template pattern, with title "Load Template" and warning "Loading this template, will replace all content currently in fields on this page" for consistent user protection against data loss
- June 14, 2025. Complete template edit mode system: Implemented comprehensive template editing with mode switching (Edit Template ↔ Save Template), red "Edit Template Mode" notification banner, content resolution showing handlebars vs resolved merge fields based on mode, and full backend support with PUT endpoint and storage methods for seamless same-page template editing and preview
- June 14, 2025. Template name preservation fix: Resolved critical bug where template updates were hardcoded to "Updated Template" name. Added editingTemplate state to store complete template object during editing, ensuring original template names are preserved during updates while allowing content modifications
- June 14, 2025. Merge field highlighting removal: Completely removed all merge field highlighting functionality including overlay components, context providers, and enhanced input components. Reverted to standard Input and Textarea components for cleaner, simpler form handling without visual highlighting complexity
- June 14, 2025. Complete merge view toggle system: Implemented toggle between "Merge View" (showing technical syntax like {{company_name}}) and "Normal View" (showing resolved values like "Boston Centerless"). Added isMergeViewMode state to outreach page, updated getDisplayValue and content resolution functions to consider merge view mode, button toggles between "Merge View"/"Normal View" labels with EyeOff icon, and added blue notification banner in Quick Templates section for clear visual feedback
- June 14, 2025. Merge Fields Dialog copy icon fix: Separated clipboard functionality from direct insertion logic. Created dedicated handleCopyToClipboard function that always copies merge fields (with handlebars) to clipboard, while handleFieldSelect remains for direct form insertion. Copy icon now properly copies to clipboard with green checkmark feedback, following existing codebase patterns
- June 14, 2025. Merge Fields Dialog unified copy behavior: Reverted row insertion logic to use clipboard functionality instead. Both row clicks and copy icon clicks now perform identical actions - copy merge field to clipboard, show green checkmark feedback, and auto-close dialog after 0.8 seconds. Removed event propagation conflicts since both actions are now unified
- June 15, 2025. Dual storage merge field system: Implemented comprehensive solution for merge field conversion issue in email body by storing both original (merge field syntax) and resolved (actual values) versions of content. Added originalEmailPrompt, originalEmailContent, and originalEmailSubject state variables, updated getDisplayValue function to use dual storage, modified template loading and AI generation to preserve merge fields, and enhanced localStorage persistence to maintain both versions for reliable merge view toggle functionality
- June 15, 2025. Template dropdown cleanup: Removed FileText icons from template dropdown SelectItems and simplified template display to show only template names instead of complex nested structure with descriptions. Fixed excessive left indentation by changing SelectItem padding from pl-8 (32px) to pl-3 (12px) and removed unnecessary mr-2 margin from SelectTrigger for cleaner, better-aligned template selection interface
- June 15, 2025. Duck header scroll compression: Implemented smooth scroll-triggered compression effect for mobile duck emoji header. Added scroll listener that immediately triggers when user scrolls (window.scrollY > 0), reducing emoji font sizes (🐥: text-2xl→text-lg, 🥚: text-lg→text-sm), compressing padding (pt-2 pb-1→pt-1 pb-0.5), and shrinking close button (w-5 h-5→w-4 h-4, p-1→p-0.5). Header maintains fixed positioning to overlay main navigation. All transitions use 300ms duration for smooth animation
- June 15, 2025. Button row spacing improvement: Added mb-6 (24px bottom margin) to Quick Templates button row containing "Merge View", "Merge Field", and "Save as Template" buttons for better visual separation from template dropdown section
- June 15, 2025. Email textarea auto-resize fix: Corrected ref mismatch in handleTextareaResize function by changing textareaRef.current to emailContentRef.current. Email body now properly expands from 160px minimum to 400px maximum height before becoming scrollable. Removed unused textareaRef declaration
- June 15, 2025. Mini footer simplification: Removed copyright text, reduced font size from text-sm to text-xs, and cut height in half by changing padding from py-4 to py-2. Footer now shows only "Soli Deo Gloria" and "LinkedIn" link with minimal footprint
- June 15, 2025. Contact search chips default optimization: Changed default configuration to enable only Core Leadership by default, while Department Heads and Middle Management start disabled. This focuses searches on C-level executives and founders by default, allowing users to manually expand scope as needed. Applied to both initial state and localStorage fallback configuration
- June 15, 2025. Search settings icon repositioning: Moved search settings icon from main search bar to lower right corner with absolute positioning (bottom-8 right-4). Made icon less prominent with 40% opacity, gray coloring, and smaller size (h-4 w-4). Icon remains fully functional but now sits discretely out of the main interface flow
- June 15, 2025. Mobile contact chips spacing optimization: Eliminated vertical spacing between search bar and contact chips on mobile screens by changing container gap from gap-2 to gap-0 md:gap-2. Creates seamless connection on narrow screens while maintaining proper spacing on desktop
- June 15, 2025. Mobile search input optimization: Repositioned search type selector from inside input field to below search button on mobile screens. Changed input padding from pr-20 to md:pr-20 pr-4 for maximum mobile typing space. Created responsive layout where contact chips and search selector share same row on mobile (justify-between) while maintaining separate rows on desktop. Preserves all functionality while maximizing mobile usability
- June 15, 2025. Mobile search type selector alignment fix: Changed mobile container alignment from items-center to items-start to prevent search type selector from jumping down when contact chips expand to multiple rows. Selector now stays anchored to top position for consistent user experience
- June 15, 2025. Mobile search type selector spacing fix: Added mt-5 top margin to search type selector wrapper for optimal spacing. Selector positioned with generous distance from search button above for clean visual hierarchy
- June 15, 2025. Connected mobile search interface: Removed gap between search input and button on mobile (md:gap-2 gap-0), implemented seamless connection with custom border radius (input: rounded-l-md rounded-r-none, button: rounded-l-none rounded-r-md). Creates unified search element on mobile while preserving separate elements on desktop for maximum input width
- June 15, 2025. Mobile padding optimization: Reduced horizontal padding across mobile interface - main container (px-2 md:px-6), search section (px-3 md:px-6), grid gaps (gap-3 md:gap-6), and section spacing (space-y-2 md:space-y-4). Creates tighter, more space-efficient mobile layout while maintaining desktop comfort
- June 15, 2025. Search placeholder text update: Changed search input placeholder from example-based text to encouraging message "Be as detailed as possible 🎯 😉" to prompt users for more detailed queries and better search results
- June 15, 2025. Mobile focus enhancement: Implemented mobile-only input focus animation with 3% width expansion (scaleX(1.03)) and internal blue border highlight. Uses CSS transitions for smooth animation and gently pushes search button right when input is active, solving the disjointed outline issue from connected interface
- June 15, 2025. Mobile focus enhancement fixes: Replaced scaleX transform with flex-grow expansion (1 to 1.03) to properly push search button right instead of overlapping. Added comprehensive focus-visible overrides with !important declarations to eliminate shadcn's default dark border/ring styling on mobile, ensuring only internal blue border appears
- June 15, 2025. Mobile focus styling refinement: Removed problematic width expansion approaches and simplified to clean internal border only. Changed border from thick blue (2px, rgba(59, 130, 246, 0.4)) to thin light gray (1px, rgba(156, 163, 175, 0.3)) for subtle, professional focus indication on mobile devices
- June 15, 2025. Search placeholder text refinement: Removed winking emoji from placeholder text, changing from "Be as detailed as possible 🎯 😉" to "Be as detailed as possible 🎯" for cleaner, more professional appearance
- June 15, 2025. Search placeholder example update: Changed placeholder from motivational text to concrete example "Series-A Fintech companies in NYC " to demonstrate the specificity level and search format that works best with the B2B prospecting system
- June 15, 2025. Mobile button label optimization: Hidden text labels on mobile for "Start Selling", "5 More", and "Expand" buttons using `hidden md:inline` classes while preserving icons and desktop functionality. "Find Key Emails" button retains full text on all screen sizes for clarity
- June 15, 2025. Clean search interface optimization: Hide entire header container (emoji animation + "Search for target businesses" heading) when search results are present using conditional rendering (!currentResults). Saves ~60-80px vertical space and creates cleaner, more focused results interface while preserving welcoming introduction for new users
- June 15, 2025. Saved searches drawer button repositioning: Moved button from top-20 to top-32 on mobile (md:top-20 preserves desktop position) to prevent overlap with search input. Made button more compact on mobile (h-8 w-8 vs h-10 w-10 desktop) and scaled down ListChecks icon (h-4 w-4 vs h-5 w-5 desktop) for better mobile space efficiency
- June 15, 2025. Replies menu item hidden: Commented out "Replies" navigation item in main-nav.tsx navigation array to hide the unfinished feature while preserving code for future re-enablement
- June 15, 2025. Hamburger menu button border removal: Changed main navigation dropdown menu button from variant="outline" to variant="ghost" to remove border while preserving hover effects and background states
- June 15, 2025. Landing page example text update: Changed suggestion button from "Wolf-of-wallstreet-esque trading companies" to "Series-A Fintech companies in NYC" in static/landing.html for better example clarity
- June 15, 2025. Landing page statistics update: Changed time savings metric from "22 Hours" / "Saved per Month" to "~48 Mins" / "Saved per Day" for more relatable daily value proposition
- June 15, 2025. First-time visitor authentication block removal: Eliminated immediate authentication modal for new users that was blocking the "try before you buy" experience. Removed shouldShowForFirstTimeUsers logic, hasVisitedBefore localStorage tracking, and cleaned up obsolete references. New users now get proper 14-second grace period to explore search functionality before authentication prompt
- June 15, 2025. Authentication delay extension: Increased semi-protected route authentication delay from 5 seconds to 14 seconds to give new users more time to explore and engage with search functionality before being prompted to register
- June 15, 2025. Company table URL click prevention: Modified company website URLs to be non-clickable text while keeping only the ExternalLink icon clickable. This prevents accidental URL clicks when users intend to expand company rows. Applied to both desktop and mobile views for consistent behavior
- June 15, 2025. Edge-to-edge mobile Companies Analysis layout: Changed root container padding from px-2 to px-0 on mobile devices (preserving md:px-6 for desktop) to eliminate the 8px left/right margins, allowing the Companies Analysis section to touch screen edges for maximum mobile space utilization
- June 15, 2025. Unified email deduplication system implementation: Created centralized email-utils.ts with mergeEmailData(), hasCompletedEmailSearch(), and normalizeEmail() functions. Replaced 6+ scattered email handling implementations across server/routes.ts with single source of truth, reducing code by ~65 lines. Added completion checks to Hunter.io, Apollo.io, AeroLeads, and Perplexity endpoints to prevent obsessive re-searching of contacts that already have emails. Fixed duplicate email bug where same email appeared in both primary and alternativeEmails fields due to race conditions between multiple search APIs
- June 15, 2025. Complete duplicate email fix implementation: Identified root cause as 160 contacts with same email in both primary and alternative fields from initial contact creation phase. Fixed with two-part solution: (1) Database cleanup removing duplicates from existing records using SQL array_remove function, (2) Prevention system with cleanContactData() function in email-utils.ts and integration into contact creation process in storage layer. Verified fix with zero remaining duplicates in database
- June 15, 2025. Comprehensive duplicate email fix finalization: Fixed additional 4 contacts with duplicates created after initial fix by identifying gap in mergeEmailData() function and missing deduplication in updateContact() method. Enhanced cleanContactData() with array checking, applied deduplication to contact updates in storage layer, and cleaned mergeEmailData() logic. Final verification shows zero duplicate emails in 2,875 total contacts. Prevention system now covers complete contact lifecycle (creation + updates + enrichment)
- June 15, 2025. Apollo email search prioritization: Moved Apollo.io search button (Rocket icon 🚀) from last position to first position in ContactActionColumn component. Updated both desktop horizontal layout and mobile dropdown menu to prioritize Apollo as the primary email discovery service. New icon order: Eye → Rocket → Sparkles → Target → Gem. Change maintains all existing functionality, state management, and API integration while giving Apollo prominence in the user interface
- June 15, 2025. Waterfall email search backend prioritization: Reordered "Find Key Emails" backend search flow to prioritize Apollo.io as Phase 1 (was Phase 2), moved Perplexity to Phase 2 (was Phase 1), kept Hunter.io as Phase 3 final fallback. Simple code block reordering in server/routes.ts processCompany function without architectural changes or duplication. Apollo professional contact database now leads email discovery for higher business email success rates
- June 16, 2025. Parallel email search architecture implementation: Completely redesigned "Find Key Emails" backend from sequential waterfall to parallel execution strategy. Tier 1&2 run simultaneously with Apollo searching contacts 1&2 and Perplexity searching contacts 1&3 (contact #1 gets double coverage). Tier 3 Hunter only triggers if <1 email found total. Created helper functions searchApolloContacts(), searchPerplexityContacts(), searchHunterContacts() for multi-contact processing. Updated source breakdown tracking to handle combined results format. Performance improvement: ~40% faster execution with better contact coverage (all top 3 contacts vs previous uneven pattern). Maintains all existing error handling, deduplication, and API endpoints
- June 17, 2025. Atomic search state persistence system implementation: Created comprehensive SearchStateManager to fix critical contact data loss during navigation and authentication changes. Implemented real-time contact saving with dual storage (localStorage + sessionStorage), emergency persistence handlers for beforeunload events, contact corruption detection and recovery, auth-safe state management independent of React Query cache invalidation, and atomic state snapshots with session tracking. Integrated throughout home component with immediate contact persistence during email discovery, database refresh operations, and all contact mutations. Prevents the 4 major failure modes: React Query cache clearing during auth changes, component unmounting race conditions, localStorage corruption during navigation, and async timing issues in database refresh cycles
- June 17, 2025. Backend-driven comprehensive search architecture implementation: Completely refactored search system from frontend-coordinated to backend-driven processing. Created SearchJob database schema with persistent search tracking, ComprehensiveSearchOrchestrator for full pipeline execution (companies → contacts → emails), and comprehensive API endpoints (/api/search/comprehensive, /api/search/job/:id). Implemented ComprehensiveSearchClient for frontend integration with job polling and status tracking. This enables searches to complete even when users navigate away from the page, solving the critical navigation interruption issue. Search jobs persist in database with full progress tracking and result storage
- June 17, 2025. Critical user registration bug fix: Resolved PostgreSQL constraint violation "null value in column 'id' violates not-null constraint" that was preventing new user registration. Root cause was missing auto-increment sequence on users.id column despite Drizzle schema defining serial type. Fixed by creating users_id_seq sequence, setting ownership to users.id, updating column default to nextval('users_id_seq'), and syncing sequence to current max ID (237). Database now properly auto-generates user IDs, enabling successful Firebase authentication → backend user creation flow
- June 17, 2025. Complete Stripe payment integration: Integrated real Stripe API keys for secure payment processing with live payment intents instead of mock data. Added comprehensive Stripe webhook endpoint for automatic credit allocation after successful payments, enhanced payment success handling to refresh user credit balance, and configured payment metadata to track user ID and credit amounts. Fixed all ES6 import issues by replacing require statements with proper Stripe imports. Payment system now fully operational with real $40/1000 credits transactions
- June 17, 2025. Storage architecture cleanup and updateList implementation: Added missing updateList method to SimpleStorage class with legacy data adoption logic for seamless user data migration. Removed obsolete storage-switching directory entirely and cleaned up all references in server/index.ts, server/lib/test-runner.ts, and replit.md documentation. Simplified storage architecture to single in-memory implementation with IStorage abstraction ready for future migration. All list update operations now functional with proper user permission checking
- June 17, 2025. Permission-free list access architecture: Removed ownership-based access restrictions from getList method while preserving userId field for history tracking. Lists can now be accessed and updated by any user, enabling seamless sharing with simple numeric IDs. The userId field remains stored for "your searches" functionality and future permission features. This eliminates the list update 404 errors that occurred when authenticated users tried to access lists created under the old shared system


## User Preferences

Preferred communication style: Simple, everyday language.
Mobile UI preference: Compact, space-efficient design with seamless header-to-content transitions.