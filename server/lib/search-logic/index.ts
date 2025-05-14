/**
 * Search Logic
 * 
 * Main entry point for search logic functionality.
 * Exports core search functions and utilities for building search capabilities.
 */

// Export functionality from core-search.ts
export { searchCompanies, analyzeCompany, extractContacts } from './core-search';
export { validateNames } from '../api-interactions';

// Export base module and interfaces
export {
  BaseSearchModule,
  type SearchModuleResult,
  type SearchModuleContext,
  type SearchModuleConfig
} from './base-module';

// Export utility functions
export {
  isFranchise,
  isLocalHeadquarter,
  calculateCompanyScore,
  getRoleMultiplier,
  isLeadershipRole
} from './utils/company-utils';

// Define module factory interface
import { BaseSearchModule } from './base-module';
// Import module implementations
import { CompanyOverviewModule } from './modules/company-overview';
import { DecisionMakerModule } from './modules/decision-maker';
import { EmailDiscoveryModule } from './modules/email-discovery';

/**
 * Map of module types to their factory functions
 * This simplifies creating new modules of different types
 */
export const MODULE_FACTORIES: Record<string, () => BaseSearchModule> = {
  company_overview: () => new CompanyOverviewModule(),
  decision_maker: () => new DecisionMakerModule(),
  email_discovery: () => new EmailDiscoveryModule()
};

/**
 * Factory function to create a search module instance based on type
 * @param moduleType The type of module to create
 * @returns A new instance of the requested search module
 */
export function createSearchModule(moduleType: string): BaseSearchModule {
  const factory = MODULE_FACTORIES[moduleType];
  
  if (!factory) {
    throw new Error(`Unknown module type: ${moduleType}`);
  }
  
  return factory();
}