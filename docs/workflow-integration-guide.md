# 5 Ducks Workflow Integration Guide

This document explains how to integrate the 5 Ducks platform with external workflow automation services.

## Overview

The 5 Ducks B2B sales intelligence platform now supports an architecture where search processing is performed by external workflow automation platforms rather than handled internally. This approach provides several benefits:

- More flexible optimization of search strategies
- Better separation of concerns
- Ability to adapt to different data sources and APIs
- Improved scalability for complex search operations

## Integration Flow

The integration follows this high-level flow:

1. **Search Initiation**: User starts a search via the 5 Ducks platform
2. **Workflow Trigger**: 5 Ducks sends a webhook request to the workflow platform with search parameters
3. **Search Processing**: The workflow platform processes the search using its automation capabilities
4. **Results Delivery**: The workflow platform sends the results back to 5 Ducks via a webhook
5. **Results Storage**: 5 Ducks stores the results and makes them available to the user

## Endpoint Specifications

### 1. Search Request Endpoint

The 5 Ducks platform provides an endpoint to initiate searches via the workflow platform:

- **Endpoint**: `/api/workflow/search`
- **Method**: POST
- **Authentication**: Required (Bearer token)
- **Request Format**:

```json
{
  "query": "Plumbing contractors in Seattle",
  "strategyId": 1
}
```

- **Response Format**:

```json
{
  "message": "Search initiated successfully",
  "searchId": "search_1650123456789",
  "status": "processing"
}
```

### 2. Webhook Callback Endpoint

The workflow platform should send results back to the 5 Ducks platform via this webhook endpoint:

- **Endpoint**: `/api/webhooks/workflow`
- **Method**: POST
- **Authentication**: Not required (but source verification is performed)
- **Request Format**:

```json
{
  "searchId": "search_1650123456789",
  "userId": 123,
  "results": {
    "companies": [
      {
        "name": "Example Plumbing Co",
        "website": "https://example-plumbing.com",
        "size": 25,
        "services": ["Commercial Plumbing", "Residential Plumbing"],
        "validationPoints": ["Active website", "Social media presence"]
      }
    ],
    "contacts": [
      {
        "name": "Jane Smith",
        "companyId": 456,
        "role": "CEO",
        "email": "jane@example-plumbing.com",
        "probability": 90,
        "linkedinUrl": "https://linkedin.com/in/janesmith"
      }
    ]
  }
}
```

- **Response Format**:

```json
{
  "status": "success",
  "message": "Search results processed successfully"
}
```

## Webhook Logging

All webhook interactions are logged for debugging and monitoring purposes. The logs include:

- Request/response details
- HTTP status codes
- Timestamps
- Processing details

These logs can be accessed via the admin interface to troubleshoot integration issues.

## Setting Up the Integration

To set up the integration:

1. Configure the workflow platform to accept incoming webhook triggers from 5 Ducks
2. Create a workflow that processes search requests according to your search strategy
3. Configure the workflow to send results back to the 5 Ducks webhook endpoint
4. Test the integration with sample search queries

## Code Example

Here's a simplified example of how to process a webhook in n8n:

```javascript
// In n8n Function node
// Process incoming search request from 5 Ducks
const searchData = $input.all()[0].json;

// Extract search parameters
const query = searchData.query;
const searchId = searchData.searchId;
const userId = searchData.userId;

// Process the search using your search strategy
// ... (search logic here) ...

// Prepare the results
const results = {
  companies: [
    // Company objects
  ],
  contacts: [
    // Contact objects
  ]
};

// Send results back to 5 Ducks
const webhookResponse = await $http.post(
  searchData.callbackUrl || "https://yourdomain.com/api/webhooks/workflow",
  {
    searchId: searchId,
    userId: userId,
    results: results
  },
  {
    headers: {
      "Content-Type": "application/json"
    }
  }
);

// Return the response
return {
  searchId: searchId,
  status: webhookResponse.status === 200 ? "success" : "error",
  message: `Results sent back to 5 Ducks (${webhookResponse.status})`
};
```

## Troubleshooting

If you encounter issues with the integration:

1. Check the webhook logs in the 5 Ducks admin interface
2. Verify the workflow is correctly configured to send results to the 5 Ducks webhook endpoint
3. Ensure the JSON format of the search results matches the expected format
4. Check for authentication issues or network connectivity problems

## Contact

For additional help with the integration, contact the 5 Ducks support team.