# Search Logic Module

## Overview

This directory contains the modular search logic system that powers the company and contact discovery features in our application. The system is designed to be:

- **Modular**: Each search capability is encapsulated in its own module
- **Extensible**: New search modules can be added with minimal changes to the core system
- **Configurable**: Search modules can be adjusted through configuration options
- **Reusable**: Common functionality is provided through base classes and utilities

## Directory Structure

```
search-logic/
├── README.md              # This documentation file
├── index.ts               # Main entry point, exports and factory functions
├── base-module.ts         # Base class and interfaces for search modules
├── core-search.ts         # Core search functionality used by all modules
├── modules/               # Individual search module implementations
│   ├── company-overview.ts    # Company details and information search
│   ├── decision-maker.ts      # Decision maker discovery
│   └── email-discovery.ts     # Email validation and discovery
└── utils/                 # Shared utility functions
    └── company-utils.ts       # Company-related helper functions
```

## Module Types

The system currently supports the following search module types:

1. **Company Overview Module**: Discovers general company information, size, services, etc.
2. **Decision Maker Module**: Identifies key decision makers and contacts within a company
3. **Email Discovery Module**: Validates and discovers email addresses for contacts

## Module Architecture

Each module extends the `BaseSearchModule` class and implements the required `execute()` method. 
Modules leverage common utility functions for standard operations.

### Module Interface

```typescript
interface SearchModuleContext {
  // The search query or company name
  query: string;
  
  // Module configuration
  config: SearchModuleConfig;
  
  // Optional previous results to build upon
  previousResults?: SearchModuleResult;
}

interface SearchModuleResult {
  // Array of discovered companies
  companies: Array<Partial<any>>;
  
  // Array of discovered contacts
  contacts: Array<Partial<any>>;
  
  // Additional metadata
  metadata?: {
    moduleType: string;
    completedSearches?: string[];
    validationScores?: Record<string, number>;
    [key: string]: any;
  };
}
```

### Base Module

The `BaseSearchModule` provides the foundation including:

- Abstract `execute()` method to be implemented by each module
- Optional `validate()` method for validating results
- Default `merge()` method for combining results with previous data

## Adding New Modules

To add a new search module:

1. Create a new file in the `modules/` directory
2. Extend the `BaseSearchModule` class and implement the required methods
3. Register your module in the `MODULE_FACTORIES` object in `index.ts`

Example:

```typescript
// modules/my-new-module.ts
import { BaseSearchModule, SearchModuleContext, SearchModuleResult } from '../base-module';

export class MyNewModule extends BaseSearchModule {
  async execute(context: SearchModuleContext): Promise<SearchModuleResult> {
    // Your implementation here
    return {
      companies: [],
      contacts: [],
      metadata: {
        moduleType: 'my_new_module',
        completedSearches: ['basic_search']
      }
    };
  }
}

// index.ts - add to MODULE_FACTORIES
import { MyNewModule } from './modules/my-new-module';

export const MODULE_FACTORIES = {
  // existing modules...
  my_new_module: () => new MyNewModule()
};
```

## Usage Example

```typescript
import { createSearchModule } from './search-logic';

async function performSearch(query: string) {
  // Create a specific module instance
  const module = createSearchModule('company_overview');
  
  // Execute the search
  const results = await module.execute({
    query,
    config: {
      ignoreFranchises: true,
      locallyHeadquartered: true
    }
  });
  
  return results;
}
```

## Configuration Options

Common configuration options available to all modules:

- `ignoreFranchises`: Filter out franchise businesses
- `locallyHeadquartered`: Focus on locally headquartered companies
- `promptTemplates`: Custom prompt templates for specific operations
- `responseStructures`: Custom response structures for formatting
- `requiredFields`: Fields required for validation
- `scoreThresholds`: Minimum scores for various components
- `minimumConfidence`: Minimum confidence required for results