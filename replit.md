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
- **Search State Persistence:** Enhanced search input field synchronization to properly maintain query consistency between typed input and executed searches across page refreshes, ensuring displayed results always match the shown query (Sep 2025).
- **Lists Management Module:** Extracted lists functionality into self-contained module (Sep 2025), reducing 198 lines from main routes.ts. Module handles list CRUD operations, company associations, and demo list visibility for unauthenticated users.
- **Email Templates Module:** Extracted email templates functionality into self-contained module (Sep 2025), reducing 122 lines from main routes.ts. Module handles template CRUD operations, default template inheritance (userId=1 templates visible to all users), and integrates with QuickTemplates component and Outreach page.
- **User Account Settings Module:** Extracted user account management functionality into self-contained module (Sep 2025), reducing ~200 lines from main routes.ts. Module handles user profile management, preferences, email preferences, notifications system, and Easter egg features.
- **Email Replies Module:** Extracted email reply tracking functionality into self-contained module (Sep 2025), reducing ~140 lines from main routes.ts. Module handles reply tracking, sentiment analysis, and follow-up management (currently inactive feature).
- **Rate Limiting Implementation:** Session-based rate limiting for demo users (Sep 2025) limiting to 10 searches per hour per session. Prevents external API abuse while maintaining demo experience. Applied to both quick-search and full search endpoints, with friendly message encouraging signup when limit reached.
- **Streak Page & Campaign System:** Central hub for daily outreach campaigns (Jan 2025). Features 4-component campaign builder: Me (sender profile), My Product (strategic profile), Ideal Customer (customer profile), and Play button (activation). Includes adaptive banner system that switches from intro guidance to live metrics when campaign activates. Components support toggle selection (click to select/deselect). Automated daily batch generation creates 5 personalized prospects with AI-generated emails. Streak tracking motivates consistent outreach with visual progress indicators and achievement milestones.

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

## Development Authentication Configuration

### Authentication Bypass for Development Domains
This application supports authentication bypass for specific development domains through a configurable mechanism.

**How It Works:**
- Domains listed in `AUTH_EXEMPT_DOMAINS` secret bypass authentication
- Bypassed requests automatically use demo user (ID: 1)
- All pages and API endpoints are accessible without login on these domains
- Database operations use the demo user account

**Secret Configuration:**
- The `AUTH_EXEMPT_DOMAINS` secret should be set in **Replit Secrets**
- Value format: Comma-separated list of domains
- Wildcards supported with `*` prefix (e.g., `*.replit.dev`)
- Example: `*.replit.dev,dev.5ducks.ai,staging.example.com`

**Current Configuration:**
- Development domains: `*.replit.dev`
- Demo User ID: 1
- Demo Email: demo@5ducks.ai

**For Development and Testing:**
1. No authentication required on exempt domains
2. All API calls automatically authenticated as demo user
3. Production domains require full authentication
4. Data operations safe (demo user sandbox)

**Security:**
- Only specified domains can bypass authentication
- Production domains always require proper authentication
- Logs all bypass access for audit
- Domain list stored securely in environment secrets

## Critical Development Notes for AI Agents

### Database Access
- Demo user (ID: 1, email: demo@5ducks.ai) is pre-seeded with sample data
- Rate limit: 10 searches/hour for demo user (session-based)
- Database migrations: Use `npm run db:push` (never write manual SQL migrations)
- Force push if data loss warning: `npm run db:push --force`

### Required Secrets (Must be in Secrets vault)
- `AUTH_EXEMPT_DOMAINS`: Development domains that bypass auth (e.g., `*.replit.dev`)
- API keys needed for full functionality:
  - `OPENAI_API_KEY`: Email generation, company research
  - `PERPLEXITY_API_KEY`: Company/contact discovery
  - `HUNTER_API_KEY`: Email finder/verification
  - `APOLLO_API_KEY`: Professional contacts (optional)
  - `SENDGRID_API_KEY`: Email sending (optional)
  - Firebase env vars auto-configured in client

### Key Endpoints & Testing
- `/outreach`: Main app page - test email generation/search here
- `/api/user`: Returns authenticated user info
- `/api/credits`: Check user credits (demo user starts with 2980 balance)

### Common Gotchas
- Workflows auto-restart after package installation
- Port 5000 reserved for frontend (bind nothing else)
- Session store persists 7 days (survives restarts)
- Firebase auth bypassed in test mode but still initializes
- Search orchestrator has 3 retry attempts with exponential backoff
- Email templates with userId=1 are defaults (visible to all users)

## External Dependencies
- **Perplexity API**: Company research and contact discovery.
- **OpenAI API**: Email strategy generation and content creation.
- **Hunter.io API**: Email finder and verification.
- **Apollo.io API**: Professional contact database.
- **Firebase**: Authentication and user management.
- **Replit Key-value Database**: Primary data storage.
- **PostgreSQL**: Primary data storage.
- **Google APIs**: Gmail integration.