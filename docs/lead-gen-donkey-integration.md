# Lead-Gen Donkey Integration Documentation

## Overview
This document outlines the integration with Lead-Gen Donkey, a third-party service that provides company and contact information. The integration uses a standardized webhook-based protocol for receiving incremental updates.

## API Keys

### Test Environment
- **API Key Format**: `LGD-TEST-[alphanumeric]`
- **Current Test Key**: `LGD-TEST-1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT`
- **Rate Limits**: 100 requests per day, up to 10 companies and 20 contacts per response
- **Data Quality**: Mix of real and synthetic data for testing purposes

### Production Environment
- **API Key Format**: `LGD-PROD-[alphanumeric]`
- **Current Production Key**: Stored as environment variable `LEAD_GEN_DONKEY_PROD_API_KEY`
- **Rate Limits**: Based on service tier
  - Standard: 1,000 requests/day
  - Premium: 10,000 requests/day (our current tier)
  - Enterprise: Unlimited
- **Data Quality**: Only verified, high-quality data from authentic sources

## API Endpoints

### Test Environment
- Base URL: `https://api.leadgendonkey.example.com/v1`

### Production Environment
- Base URL: `https://b45e11fa-5450-41c3-9aae-b0c5d9ba4636-00-2t2y9b3rc04rn.kirk.replit.dev/api/lead-gen/search`

## Integration Timeline
- Test API key received: April 24, 2025
- Standardized API format implementation expected: Within 48 hours (by April 26, 2025)
- Production API key received: April 24, 2025
- Full production integration: April 24, 2025

## Environment Configuration
To switch between test and production environments:

1. **Automatic based on environment**:
   - Production Node environment (`NODE_ENV=production`) will use production API
   - Development Node environment will use test API by default

2. **Manual override**:
   - Set `LEAD_GEN_DONKEY_USE_PRODUCTION=true` to force production API usage in any environment
   - This is useful for testing production API in development environment

## Request Format

### Production Environment
The production API expects a simplified request format:

```json
{
  "query": "software engineering firms in San Francisco specializing in AI",
  "callbackUrl": "https://example.com/api/external-workflow/webhook"
}
```

### Test Environment
The test environment uses our original standardized format:

```json
{
  "searchId": "donkey_search_1745525142977",
  "query": "technology companies in San Francisco",
  "moduleTypes": ["COMPANY_OVERVIEW", "DECISION_MAKER", "EMAIL_DISCOVERY"],
  "configuration": {
    "incrementalUpdates": true,
    "validationThresholds": {
      "companyScore": 60,
      "contactScore": 70,
      "emailScore": 65
    },
    "filterCriteria": {
      "companySize": { "min": 10, "max": 500 }
    }
  },
  "callbackUrl": "https://example.com/api/external-workflow/webhook"
}
```

## Response Format
```json
{
  "searchId": "donkey_search_1745525142977",
  "status": "in_progress",
  "stage": "COMPANY_OVERVIEW",
  "progress": 25,
  "timestamp": "2025-04-24T20:05:42Z"
}
```

## Webhook Updates
Lead-Gen Donkey will send incremental updates to the provided `callbackUrl` with partial results as they become available. The webhook payload will follow the same format as our standardized webhook protocol.

## Error Handling
- **Rate Limits**: If the 429 status code is returned, the system will respect the `retry-after` header or default to a 10-second wait.
- **Authentication**: If the API key is invalid or expired, a 401 status code will be returned.
- **Malformed Requests**: If the request format is incorrect, a 400 status code will be returned with details on what went wrong.

## Implementation Notes
- The Donkey integration is implemented to support both test and production environments.
- Both API keys are securely stored as environment variables:
  - Test API Key: `LEAD_GEN_DONKEY_API_KEY`
  - Production API Key: `LEAD_GEN_DONKEY_PROD_API_KEY`
- Production API usage can be enabled in two ways:
  1. Running the application in production mode (`NODE_ENV=production`)
  2. Setting the environment variable `LEAD_GEN_DONKEY_USE_PRODUCTION=true`
- Rate limit handling is implemented for both environments:
  - Test environment: 100 requests/day
  - Production environment (Premium tier): 10,000 requests/day
- Data quality differences:
  - Test environment may include a mix of real and synthetic data
  - Production environment only returns verified, high-quality data from authentic sources