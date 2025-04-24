# Lead-Gen Donkey Integration (In Progress)

## Overview
This document describes the in-progress integration with Lead-Gen Donkey's company search API. We are working on connecting directly to their API endpoints component by component, starting with basic company search functionality.

## Integration Architecture

### Current Implementation
1. **Client-side**: The frontend makes a direct API call to our own backend endpoint (`/api/external-provider/donkey`) with the search query.
2. **Server-side**: Our backend forwards the request to Lead-Gen Donkey's company search API and processes the response.
3. **Response Format**: We accept the direct response from Lead-Gen Donkey and pass it back to the client.

### Authentication
- The backend handles API key management for Lead-Gen Donkey
- Currently supporting both test and production API keys
- API key selection is controlled via environment variables

## API Endpoints
- **Current Company Search Endpoint**: https://b45e11fa-5450-41c3-9aae-b0c5d9ba4636-00-2t2y9b3rc04rn.kirk.replit.dev/api/lead-gen/company-search
- We will add more endpoints as we receive them from Lead-Gen Donkey

## Environment Variables
- `LEAD_GEN_DONKEY_API_KEY`: Test API key (for development/testing)
- `LEAD_GEN_DONKEY_PROD_API_KEY`: Production API key (for production use)
- `LEAD_GEN_DONKEY_USE_PRODUCTION`: Set to "true" to force use of production API, even in non-production environments

## Example Usage

### JavaScript/TypeScript Client
```javascript
// Import the triggerExternalSearch function
import { triggerExternalSearch } from '@/lib/externalSearchApi';

// Call the function with 'donkey' as the provider ID
const response = await triggerExternalSearch('donkey', {
  query: 'software companies in New York',
  callbackUrl: 'https://your-callback-url.com'
});

// Process the response
console.log(response.searchId);
console.log(response.status);
// If company data is available:
if (response.results && response.results.companies) {
  console.log(response.results.companies);
}
```

### Direct API Call
```bash
curl -X POST http://localhost:5000/api/external-provider/donkey \
  -H "Content-Type: application/json" \
  -d '{"query": "software engineering firms in San Francisco"}'
```

## Integration Roadmap
We are approaching the integration in phases:

1. **Phase 1 (Current)**: Basic company search API integration
2. **Phase 2**: Decision maker finder integration
3. **Phase 3**: Email discovery integration
4. **Phase 4**: Full workflow integration with webhooks

## Testing
Use the `test-simple-donkey.js` script to test the direct company search integration:
```bash
node test-simple-donkey.js
```

## Error Handling
If the direct API call fails, our system will fall back to providing a status message indicating that the integration is in progress and that we're working with Lead-Gen Donkey to establish a reliable connection.