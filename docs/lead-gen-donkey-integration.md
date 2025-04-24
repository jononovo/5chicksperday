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
- **Rate Limits**: Based on service tier
  - Standard: 1,000 requests/day
  - Premium: 10,000 requests/day
  - Enterprise: Unlimited
- **Data Quality**: Only verified, high-quality data from authentic sources

## API Endpoints

### Test Environment
- Base URL: `https://api.leadgendonkey.example.com/v1`

### Production Environment
- Base URL: To be provided when ready for production

## Integration Timeline
- Test API key received: April 24, 2025
- Standardized API format implementation expected: Within 48 hours (by April 26, 2025)
- Production API key request: To be initiated 1-2 weeks before target go-live date

## Request Format
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
- The Donkey integration is currently implemented to work with the standardized API format that they will adapt to within 48 hours.
- In test mode, we should expect a mix of real and synthetic data.
- For production use, we will need to request a production API key 1-2 weeks before the target go-live date.