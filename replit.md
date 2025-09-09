# 5Ducks B2B Prospecting Application

## Overview
5Ducks is a comprehensive B2B lead generation and prospecting platform designed to help small businesses acquire new leads daily. It offers AI-powered company search, contact discovery, email enrichment, and campaign management, streamlining the prospecting process and providing a competitive edge in B2B sales. The project's vision is to deliver a unified, efficient solution for lead generation.

## User Preferences
Preferred communication style: Simple, everyday language.
Mobile UI preference: Compact, space-efficient design with seamless header-to-content transitions.

## System Architecture
The application features a **React SPA frontend** built with TypeScript, Vite, Tailwind CSS (using shadcn/ui), TanStack Query, React Router, and Radix UI. The **backend** is developed with Express.js and TypeScript.

**Key Architectural Decisions:**
- **Modular API Design:** Distinct route handlers and business logic ensure maintainability. Feature-based folder structure with self-contained modules (e.g., server/features/gmail-integration, server/features/health-monitoring, server/features/lists, server/features/email-templates, server/search, server/user-account-settings, server/email-replies, server/campaigns) following the email-content-generation pattern. Major search modularization completed (Sep 2025) reducing routes.ts from 3521 to 2843 lines (19% reduction, 678 lines extracted). Additional modularization (Sep 2025) extracted user-account-settings (~200 lines), email-replies (~140 lines), and campaigns (~100 lines) modules, further reducing routes.ts to ~2400 lines (32% total reduction from original). Final phase completed (Sep 2025) removing duplicate find-all-emails endpoint (339 lines) and moving GET contacts endpoint, reducing routes.ts to 2313 lines (34% total reduction).
- **Search Module Architecture:** Comprehensive search functionality extracted into dedicated module (Sep 2025) with organized submodules: server/search/sessions (session management), server/search/companies (company search), server/search/contacts (contact discovery), server/search/providers (email providers: Hunter, Apollo, AeroLeads), server/search/orchestrator (multi-stage email enrichment). Major cleanup completed (Sep 2025) removing 40+ defunct files (~15,000 lines) from old search-logic folders, consolidating all active code into well-organized server/search structure with 50 files totaling 408KB. This improves maintainability, testability, and code organization.
- **Hybrid Storage Architecture:** PostgreSQL is used for structured data (users, lists, companies, contacts, email_templates, strategic_profiles), while Replit Key-Value Database handles volatile data (credits, Gmail tokens, subscriptions, notifications).
- **Multi-stage Search Process:** Orchestrates company discovery, contact extraction, and email enrichment using AI and external APIs.
- **Intelligent Contact Discovery:** Includes confidence scoring and email validation through multiple providers.
- **Template-based Email Campaigns:** Supports personalization and multi-provider email integration.
- **Authentication:** Firebase Authentication secures user login, complemented by session-based authentication via Passport.js.
- **UI/UX:** A consistent design language, utilizing Tailwind CSS and shadcn/ui, ensures a professional and unified aesthetic. Emphasis is placed on clear navigation, responsive design, and intuitive user flows. Color schemes prioritize blues, grays, and greens.
- **Search Orchestration:** An enhanced search orchestrator includes retry logic, error handling, and real-time status tracking via webhooks.
- **Email Generation System:** Features a sophisticated system providing 42 unique email combinations derived from 7 distinct tones and 6 offer strategies (Hormozi, Formula, 1-on-1, Guarantee, Shiny, Study). Email content generation is modularized for maintainability.
- **Email Content Handling:** Preserves paragraph spacing from AI responses in generated emails.
- **Product Offers Generation:** Complete 6-strategy offer generation system with proper routing fix (Aug 2025) that bypasses boundary API for "Generate product offers" input. Includes clean UX flow that hides generation button after successful completion.
- **Product Offers Display:** Product offers now display in the Implementation tab of strategy detail pages, positioned below Daily Search Queries with matching design patterns and copy functionality (Aug 2025).
- **Daily Outreach Engine:** Comprehensive automated outreach system (Sep 2025) that sends daily emails with 5 qualified leads Mon-Wed at 9 AM. Features include:
  - Email activity tracking with full content logging
  - Contact status management (uncontacted, emailed, skipped)
  - Company skip tracking with temporary (2 months) and permanent options
  - Secure token-based public pages for email editing/sending (no login required)
  - SendGrid integration for notification emails
  - User preferences for schedule, timezone, and batch size
  - Urgent reminders when running low on contacts
  - Personalized email generation based on strategic profiles
- **Search State Persistence:** Enhanced search input field synchronization to properly maintain query consistency between typed input and executed searches across page refreshes, ensuring displayed results always match the shown query (Sep 2025).
- **Lists Management Module:** Extracted lists functionality into self-contained module (Sep 2025), reducing 198 lines from main routes.ts. Module handles list CRUD operations, company associations, and demo list visibility for unauthenticated users.
- **Email Templates Module:** Extracted email templates functionality into self-contained module (Sep 2025), reducing 122 lines from main routes.ts. Module handles template CRUD operations, default template inheritance (userId=1 templates visible to all users), and integrates with QuickTemplates component and Outreach page.
- **User Account Settings Module:** Extracted user account management functionality into self-contained module (Sep 2025), reducing ~200 lines from main routes.ts. Module handles user profile management, preferences, email preferences, notifications system, and Easter egg features.
- **Email Replies Module:** Extracted email reply tracking functionality into self-contained module (Sep 2025), reducing ~140 lines from main routes.ts. Module handles reply tracking, sentiment analysis, and follow-up management (currently inactive feature).
- **Rate Limiting Implementation:** Session-based rate limiting for demo users (Sep 2025) limiting to 10 searches per hour per session. Prevents external API abuse while maintaining demo experience. Applied to both quick-search and full search endpoints, with friendly message encouraging signup when limit reached.

## Modular Architecture Pattern

New features should follow symmetric frontend-backend structure:
- Backend: `server/features/[feature-name]/` or `server/[feature-name]/`
- Frontend: `client/src/features/[feature-name]/`

Each module should be self-contained with:
- Clear public API via index.ts
- Internal organization (components, services, hooks, etc.)
- Shared types between frontend and backend
- Feature-specific documentation

### Backend Module Structure
```
server/features/[feature-name]/
  ├── index.ts        # Public exports
  ├── routes.ts       # Express route definitions
  ├── handlers/       # Route handlers
  ├── services/       # Business logic
  └── types.ts        # TypeScript interfaces
```

### Frontend Module Structure
```
client/src/features/[feature-name]/
  ├── index.ts        # Public exports
  ├── components/     # React components
  ├── hooks/          # Custom React hooks
  ├── services/       # API calls
  ├── context/        # React context providers
  └── types.ts        # TypeScript interfaces
```

### Reference Implementation: Strategy-Chat Module (September 2025)
The `strategy-chat` module serves as the reference implementation for symmetric frontend modularization. This module encapsulates the React onboarding chat system, previously spread across monolithic components.

**Implementation Progress:**
- **Phase 1 (Complete):** Module structure created, TypeScript types extracted into dedicated files (chat.types.ts, form.types.ts, strategy.types.ts)
- **Phase 2 (Complete):** API services extracted (chat.service.ts, strategic-profiles.service.ts, email-templates.service.ts)
- **Phase 3 (Complete):** Custom hooks created (useStrategyChat, useProductManager, useEmailGeneration)
- **Phase 4 (Pending):** Component breakdown of 1,274-line StrategyOverlay component
- **Phase 5 (Pending):** Utilities and helpers extraction

**Architecture Benefits:**
- Reduced coupling between components
- Clearer separation of concerns (UI, business logic, API calls)
- Improved testability through isolated service modules
- Better code reusability via custom hooks
- Consistent module pattern for future features

## AI Testing Configuration

### Automated Browser Testing
This application supports Replit AI agent browser testing through an authentication bypass mechanism.

**How It Works:**
- When `ENABLE_AI_TEST_MODE=true` is set, all authentication is bypassed
- The AI agent operates as demo user (ID: 1)
- All pages and API endpoints are accessible without login
- Database operations use the demo user account

**Current Status:** ❌ DISABLED
- Environment: Development
- Test User ID: N/A (disabled)
- Email: N/A (disabled)

**For AI Testing Agents:**
1. No authentication required - proceed directly to any page
2. All API calls automatically authenticated
3. Use the application as a logged-in user
4. Data operations safe (demo user sandbox)

**Security:**
- Only works in development environment
- Cannot be enabled in production
- Logs all test mode access for audit
- To disable: Set `ENABLE_AI_TEST_MODE=false` or remove it

## External Dependencies
- **Perplexity API**: Company research and contact discovery.
- **OpenAI API**: Email strategy generation and content creation.
- **Hunter.io API**: Email finder and verification.
- **Apollo.io API**: Professional contact database.
- **Firebase**: Authentication and user management.
- **Replit Key-value Database**: Primary data storage.
- **PostgreSQL**: Primary data storage.
- **Google APIs**: Gmail integration.