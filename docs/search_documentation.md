# 5 Ducks Search System Comprehensive Documentation

This document provides a complete guide to the 5 Ducks sales intelligence platform search system, covering technical implementation details, search flow, approaches, and configuration options.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Search Modules](#core-search-modules)
3. [Search Approaches](#search-approaches)
4. [Search Flow Implementation](#search-flow-implementation)
5. [Configuration Options](#configuration-options)
6. [External API Integrations](#external-api-integrations)
7. [Search Strategies](#search-strategies)
8. [Adding New Search Capabilities](#adding-new-search-capabilities)
9. [Validation System](#validation-system)
10. [Flow Diagrams](#flow-diagrams)

## Architecture Overview

The search system employs a modular architecture with several key design principles:

- **Pipeline Processing**: Data flows through sequential search modules
- **Strategy Pattern**: Multiple search implementations for each module
- **Validation Chain**: Multi-level validation for contact and email information
- **Configurable Execution**: Dynamic selection of modules and strategies
- **Result Merging**: Combining results from multiple sources with smart deduplication

### Key Components

| File Path | Purpose |
|-----------|---------|
| `server/lib/search-modules.ts` | Central module definitions and search module implementations |
| `server/lib/perplexity.ts` | Perplexity AI integration for company and contact analysis |
| `server/lib/api/perplexity-client.ts` | Low-level client for Perplexity API communication |
| `server/lib/search-logic/shared/types.ts` | Common type definitions for search functionality |
| `server/lib/search-logic/shared/utils.ts` | Shared utility functions for search operations |
| `server/lib/search-logic/email-discovery/index.ts` | Email discovery module configuration |
| `server/lib/search-logic/email-discovery/service.ts` | Email discovery service implementation |
| `server/lib/results-analysis/contact-analysis.ts` | Contact data analysis and validation |
| `server/lib/results-analysis/email-analysis.ts` | Email validation and scoring |
| `server/routes.ts` | API endpoints for search operations |
| `client/src/components/search-approach-options.tsx` | Frontend component for search approach config options |
| `client/src/components/search-flow-new.tsx` | UI component for search flow execution |

### Key Interfaces

```typescript
// Main search module interface
export interface SearchModule {
  execute(context: SearchModuleContext): Promise<SearchModuleResult>;
  validate(result: SearchModuleResult): Promise<boolean>;
  merge?(current: SearchModuleResult, previous?: SearchModuleResult): SearchModuleResult;
}

// Search implementation interface
export interface SearchImplementation {
  execute: (context: SearchContext) => Promise<SearchResult[]>;
  validate?: (result: SearchResult) => Promise<boolean>;
  name: string;
  description: string;
}

// Email search strategy interface
export interface EmailSearchStrategy {
  name: string;
  description: string;
  execute(context: EmailSearchContext): Promise<EmailSearchResult>;
}
```

## Core Search Modules

The 5 Ducks platform implements a structured search system with four sequential core modules:

### 1. Company Overview Module

**Purpose**: Discover and analyze companies based on search criteria

**Key Files**:
- `server/lib/search-modules.ts` - `CompanyOverviewModule` class
- `server/lib/perplexity.ts` - `searchCompanies` and `analyzeCompany` functions

**Execution Flow**:
1. Takes a query string input
2. Searches for companies using Perplexity AI
3. Analyzes each company to extract details
4. Returns company data with metadata

### 2. Decision Maker Module

**Purpose**: Identify key decision-makers and contacts at companies

**Key Files**:
- `server/lib/search-modules.ts` - `DecisionMakerModule` class
- `server/lib/results-analysis/contact-analysis.ts`
- `server/lib/results-analysis/contact-name-validation.ts`

**Execution Flow**:
1. Takes company data from previous module
2. Executes specialized searches to identify key personnel
3. Extracts and validates contact information
4. Returns validated contact data

### 3. Email Discovery Module

**Purpose**: Find email addresses for identified contacts

**Key Files**:
- `server/lib/search-modules.ts` - `EmailDiscoveryModule` class
- `server/lib/search-logic/email-discovery/service.ts`
- `server/lib/search-logic/email-discovery/strategies/` - Strategy implementations

**Execution Flow**:
1. Takes company and contact data from previous modules
2. Executes multiple email discovery strategies
3. Validates and scores discovered emails
4. Returns contacts with email information

### 4. Email Enrichment Module

**Purpose**: Validates and enhances email addresses with detailed checks

**Key Files**:
- `server/lib/search-logic/email-discovery/enhanced-validation.ts`
- `server/lib/results-analysis/email-analysis.ts`

**Execution Flow**:
1. Performs business domain validation, pattern validation, and format checks
2. Assigns confidence scores based on multiple validation metrics
3. Enhances email records with validation metrics
4. Filters low-quality or invalid email addresses

## Search Approaches

The 5 Ducks platform supports two types of search approaches:

### Internal Search Approaches

Internal search approaches run within the application and use the Perplexity API for processing searches.

**Available Internal Approaches**:
1. **Advanced Key Contact Discovery** - For finding key decision-makers in organizations
2. **Standard Contact Search** - For standard contact discovery with balanced speed/quality

### External Search Approaches

External search approaches leverage third-party workflow automation platforms for more complex or resource-intensive searches.

**Available External Approaches**:
1. **Rabbit Smart Workflow** - Advanced searches with the Rabbit workflow provider
2. **Lion Advanced Workflow** - Specialized searches with the Lion workflow provider
3. **Donkey Basic Workflow** - Simple searches with the Donkey workflow provider

### Search Approach Configuration UI

The "Approaches" page provides a tabbed interface for managing both internal and external search approaches:

1. **Table View**:
   - Displays all available search approaches
   - Shows type (internal/external)
   - Provides edit/delete functionality

2. **Approach Editor**:
   - Allows editing of approach details
   - Configures prompts and technical implementations
   - Sets up workflow triggers for external approaches

### UI to Backend Connection Flow

1. Frontend components:
   - `search-approaches.tsx`: Main component for managing search approaches
   - `search-flow-new.tsx`: Newer version of the search flow UI
   - Located in: `client/src/components/`

2. Backend storage:
   - `server/storage/search.ts`: Handles database operations for search approaches
   - Uses Drizzle ORM for database interactions

3. Prompt Update Flow:
   - User clicks "Edit Approach" in UI
   - Managed by `ApproachEditor` component in `search-approaches.tsx`
   - Updates are sent to backend endpoint: `PATCH /api/search-approaches/:id`
   - Handled by `updateSearchApproach` in `server/storage/search.ts`

## Configuration Options

A key feature of the search system is the ability to configure search approaches with specific options for customizing search behavior.

### Search Approach Configuration Options

Each search approach has configurable options that modify its behavior. These options are stored and managed through the frontend UI and passed to the backend during search execution.

#### Internal Approach Options

1. **Advanced Key Contact Discovery**:
   - `excludeFranchises` - Filter out franchise businesses from results
   - `highValue` - Prioritize high-value contacts and businesses
   - `triplePrompt` - Use enhanced triple-prompt strategy for more comprehensive results

2. **Standard Contact Search**:
   - `focusOnSeniorRoles` - Prioritize senior/leadership roles
   - `includePatternMatching` - Enable advanced pattern matching for contact discovery

#### External Approach Options

External approaches have their own sets of options defined by their respective workflow providers.

### Configuration Implementation

1. **Frontend Implementation**:
   - `search-approach-options.tsx` - Component for displaying and managing options
   - Options are presented as toggle switches with labels and descriptions
   - Each option row is clickable for better UX
   - Options are stored in component state and passed to parent components

2. **Backend Implementation**:
   - Options are received as part of the search request
   - `server/lib/api-interactions.ts` - Processes options in search functions
   - `server/lib/search-logic.ts` - Applies options to modify search behavior

3. **Option State Flow**:
   ```
   User toggles option → Frontend state updated → Passed to search API → 
   Backend applies options → Modified search is executed
   ```

## External API Integrations

### Perplexity AI

**Key Files**:
- `server/lib/api/perplexity-client.ts`
- `server/lib/perplexity.ts`

**Integration Points**:
- Company search and analysis
- Contact discovery and validation
- Email validation

**Example Usage**:
```typescript
// Basic usage
const companyResults = await searchCompanies("tech startups in Boston");

// With configuration options
const companyResults = await searchCompanies("lawyers in New York", {
  excludeFranchises: true,
  highValue: true,
  triplePrompt: false
});
```

## Search Strategies

The platform implements multiple search strategies that leverage the core modules with different configurations.

### 1. Small Business Contacts Strategy (Default)

**API Calls**: 5-7 total API calls per search operation
**Validation Strategy**: standard
**Default Strategy**: Yes

**Technical Flow**:
1. **Query Processing**:
   - Local business-focused query parsing
   - Geographic and industry classification
   - Small business filters (employee size < 100)
   - Prioritize local business discovery

2. **Module Configuration**:
   - Standard implementation of all four core modules
   - Company Overview: Focus on local business directories
   - Email Discovery: Emphasize owner/operator identification
   - Enrich Email: Standard validation with small business patterns
   - Email Deepdive: Limited to 1-2 key decision-makers

3. **Validation Pipeline**:
   - Balanced validation approach (middle threshold: 45%)
   - Required fields: name + (role OR email)
   - Owner/operator role identification boost
   - Geographic relevance scoring

### 2. Enhanced Contact Discovery Strategy

**API Calls**: 8-10 total API calls per search operation
**Validation Strategy**: strict

**Technical Flow**:
1. **Query Processing**:
   - Parse query with high-precision entity extraction
   - Apply enhanced configuration (minimum score: 65)
   - Initialize search with strict validation parameters

2. **Module Configuration**:
   - Uses all four standard modules with enhanced settings
   - Company Overview: Extended company metadata extraction
   - Email Discovery: Higher precision contact identification
   - Enrich Email: Strict validation requirements
   - Email Deepdive: Focused on quality over quantity

3. **Validation Pipeline**:
   - Minimum confidence threshold: 65%
   - Required fields: name + role + (email OR linkedinUrl)
   - AI-assisted name validation against company context
   - Strict duplicate detection and elimination

### 3. Comprehensive Search Strategy

**API Calls**: 12-15 total API calls per search operation
**Validation Strategy**: comprehensive

**Technical Flow**:
1. **Query Processing**:
   - Full semantic parsing with entity extraction
   - Multi-factor relevance scoring
   - Expanded search context with industry parameters

2. **Module Configuration**:
   - Extended versions of the four standard modules
   - Additional supplementary sources for each module
   - Multi-pass execution with feedback loops

3. **Cross-Validation Pipeline**:
   - Multi-stage verification process
   - Cross-reference validation between sources
   - Confidence scoring with weighted algorithm
   - Required minimum score: 50%

## Adding New Search Capabilities

### Adding a New Search Module

1. **Define Module Configuration**:
   - Add a new module configuration in `server/lib/search-modules.ts`
   - Define default prompts, technical prompts, and response structure

```typescript
export const NEW_MODULE = {
  type: 'new_module_type',
  defaultPrompt: "Your default prompt here",
  technicalPrompt: `Technical prompt with detailed instructions`,
  responseStructure: {
    // Define expected response structure
  },
  defaultEnabledFor: ['target_module_types']
};
```

2. **Implement Module Class**:
   - Create a new class that implements the `SearchModule` interface
   - Implement `execute`, `validate`, and optionally `merge` methods

```typescript
export class NewModule implements SearchModule {
  async execute({ query, config, previousResults }: SearchModuleContext): Promise<SearchModuleResult> {
    // Implementation logic
    return {
      companies: [], // Company data 
      contacts: [],  // Contact data
      metadata: {
        moduleType: 'new_module_type',
        completedSearches: [],
        validationScores: {}
      }
    };
  }

  async validate(result: SearchModuleResult): Promise<boolean> {
    // Validation logic
    return true;
  }
}
```

3. **Register Module**:
   - Add to `SEARCH_MODULES` object in `server/lib/search-modules.ts`
   - Add creation logic in `createSearchModule` function

### Adding a New Search Approach Option

1. **Define the Option in the Frontend**:
   - Add the new option to the `APPROACH_OPTIONS` object in `search-approach-options.tsx`

```typescript
export const APPROACH_OPTIONS: Record<number, SearchOption[]> = {
  1: [
    // Existing options...
    {
      id: "newOption",
      label: "New Option",
      description: "Description of what this option does",
      defaultValue: false
    }
  ]
};
```

2. **Update the Backend to Handle the Option**:
   - Modify `searchCompanies` or relevant functions in `server/lib/api-interactions.ts`
   - Add handling for the new option parameter

```typescript
export async function searchCompanies(
  query: string, 
  options?: {
    excludeFranchises?: boolean,
    highValue?: boolean,
    triplePrompt?: boolean,
    newOption?: boolean  // Add new option here
  }
): Promise<string[]> {
  // Add logic to handle the new option
  if (options?.newOption) {
    // Implement special behavior for new option
  }
  
  // Existing code...
}
```

## Validation System

The search system includes robust validation for contacts and emails.

### Contact Validation

**Key Files**:
- `server/lib/results-analysis/contact-name-validation.ts`
- `server/lib/search-logic/contact-discovery/enhanced-name-parsing.ts`
- `server/lib/results-analysis/contact-ai-name-scorer.ts`

**Validation Process**:
1. Extract potential names using regex patterns
2. Filter out placeholder or generic names
3. Apply format validation (first/last name structure)
4. Check against company name to prevent company-as-contact errors
5. Apply AI-based validation for higher accuracy
6. Combine multiple scores for final confidence score

### Email Validation

**Key Files**:
- `server/lib/results-analysis/email-analysis.ts`
- `server/lib/search-logic/email-discovery/enhanced-validation.ts`

**Validation Process**:
1. Check email format and structure
2. Validate domain existence
3. Check for placeholder patterns
4. Apply business domain likelihood scoring
5. Combine scores for final confidence rating

## Flow Diagrams

### Main Search Flow

```
┌──────────┐       ┌───────────────┐       ┌──────────────────┐
│          │       │               │       │                  │
│  Client  ├──────►│ API Endpoint  ├──────►│ Company Overview │
│          │       │               │       │     Module       │
└──────────┘       └───────────────┘       └──────────┬───────┘
                                                     │
                                                     │
                                                     ▼
                   ┌────────────────┐       ┌──────────────────┐       ┌─────────────┐
                   │                │       │                  │       │             │
                   │    Database    │◄──────┤  Decision Maker  │◄──────┤  Perplexity │
                   │                │       │     Module       │       │     API     │
                   └────────┬───────┘       └──────────┬───────┘       └─────────────┘
                            │                          │
                            │                          │
                            │                          ▼
                            │                ┌──────────────────┐
                            │                │                  │
                            └───────────────►│  Email Discovery │
                                             │     Module       │
                                             └──────────┬───────┘
                                                        │
                                                        │
                                                        ▼
┌──────────┐                 ┌───────────────┐       ┌──────────────────┐
│          │                 │               │       │                  │
│  Client  │◄────────────────┤ API Response  │◄──────┤    Post-Search   │
│          │                 │               │       │    Enrichment    │
└──────────┘                 └───────────────┘       └──────────────────┘
```

### Configuration Options Flow

```
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│                   │     │                   │     │                   │
│ Search Approach   │────►│  Option Toggles   │────►│  Search Context   │
│ Selection         │     │  Configuration    │     │  with Options     │
│                   │     │                   │     │                   │
└───────────────────┘     └───────────────────┘     └───────────┬───────┘
                                                               │
                                                               │
                                                               ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│                   │     │                   │     │                   │
│ Search Result     │◄────┤  Search Execution │◄────┤  API Request with │
│ with Applied      │     │  with Options     │     │  Options Payload  │
│ Options           │     │                   │     │                   │
└───────────────────┘     └───────────────────┘     └───────────────────┘
```

### Email Discovery Module Flow

```
┌──────────────────┐
│                  │
│  Email Discovery │
│     Module       │
└────────┬─────────┘
         │
         │
    ┌────▼─────┐        ┌───────────────────────────┐
    │          │─────┬──►  Website Crawler Strategy  │
    │          │     │  └───────────────────────────┘
    │          │     │  ┌───────────────────────────┐
    │ Strategy │     ├──►  Pattern Prediction        │
    │ Selection│     │  └───────────────────────────┘
    │          │     │  ┌───────────────────────────┐
    │          │     ├──►  Public Directory Search   │
    │          │     │  └───────────────────────────┘
    └────┬─────┘     │  ┌───────────────────────────┐
         │           └──►  Social Profile Search     │
         │              └───────────────────────────┘
         │
    ┌────▼─────┐
    │          │
    │ Results  │
    │ Merging  │
    │          │
    └────┬─────┘
         │
         │
    ┌────▼─────┐
    │          │
    │ Email    │
    │Validation│
    │          │
    └────┬─────┘
         │
         │
    ┌────▼─────┐
    │          │
    │ Return   │
    │ Contacts │
    │          │
    └──────────┘
```

## Best Practices

1. **Updating Prompts**:
   - Always update through the UI when possible
   - Use SQL updates only for bulk changes or fixes
   - Maintain consistency between user and technical prompts

2. **Adding New Search Types**:
   - Add implementation in `server/lib/search-logic/`
   - Update types in `shared/schema.ts`
   - Add UI components in `client/src/components/`
   - Register in appropriate configuration files

3. **Error Handling**:
   - Frontend: React Query error boundaries
   - Backend: Try-catch blocks with proper error responses
   - Search Logic: Strategy-specific error handling

4. **Testing New Changes**:
   - Use the frontend to run searches with your new or modified module
   - Check the server logs for execution details
   - Verify results in the database
   - Add console.log statements to track execution flow
   - Track execution time for your modified components
   - Monitor external API usage