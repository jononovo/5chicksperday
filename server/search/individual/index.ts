export { IndividualSearchService } from './individual-search-service';
export { parseIndividualQuery, formatSearchContext } from './query-parser';
export { discoverIndividual, enrichIndividualWithEmail } from './individual-search';
export type {
  ParsedIndividualQuery,
  IndividualDiscoveryResult,
  IndividualSearchResult
} from './types';
