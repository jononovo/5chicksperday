# Lead Generation API Integration: Implementation Guide

## Overview

This guide provides clear instructions for implementing the three critical components required to integrate with external lead generation providers. Each section focuses on what you absolutely need to implement to make the system work properly.

## CRITICAL IMPLEMENTATION SECTIONS

### 1. Sending Search Requests to Providers

The first essential component is properly sending search requests to the external provider's API.

#### Implementation Steps

1. **Create a Search Request Function**

   Add this function to send search requests to the provider:

   ```javascript
   // Add to your routes.ts or api-client.ts file
   async function sendSearchRequest(query) {
     // Generate a unique search ID to track this search
     const searchId = `search_${Date.now()}`;
     
     // CRITICAL: Use the correct workflow webhook URL as the callback destination
     // This is where the provider will send results back to your application
     const workflowWebhookUrl = "https://4e42bf38-b4c9-40d3-8c0c-2427f6eb9ef6-00-293iuvng6jglm.kirk.replit.dev/api/webhooks/workflow/unknown/node/webhook_trigger-1745710211752";
     
     // Prepare the request payload
     const payload = {
       query: query,                 // The search query (e.g., "plumbers in Seattle")
       callbackUrl: workflowWebhookUrl, // Where to send results
       searchId: searchId            // Unique identifier for this search
     };
     
     // Log the outgoing request (critical for tracking)
     console.log(`Sending search request: ${searchId} - Query: "${query}"`);
     
     try {
       // RABBIT PROVIDER ENDPOINT
       const endpoint = "https://lead-rabbit.replit.app/api/search";
       
       // Make the API request
       const response = await fetch(endpoint, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           "Authorization": "Bearer YOUR_API_KEY"
         },
         body: JSON.stringify(payload)
       });
       
       // Check response status
       if (!response.ok) {
         throw new Error(`Provider API error: ${response.status} ${response.statusText}`);
       }
       
       const data = await response.json();
       console.log(`Request successful: ${JSON.stringify(data)}`);
       
       return {
         success: true,
         searchId: searchId,
         message: "Search request submitted successfully"
       };
     } catch (error) {
       console.error(`Search request failed: ${error.message}`);
       
       return {
         success: false,
         searchId: searchId,
         error: error.message
       };
     }
   }
   ```

2. **Required Request Format**

   All providers require these fields in the request payload:
   
   ```json
   {
     "query": "The search query text (e.g., 'plumbers in Seattle')",
     "callbackUrl": "https://4e42bf38-b4c9-40d3-8c0c-2427f6eb9ef6-00-293iuvng6jglm.kirk.replit.dev/api/webhooks/workflow/unknown/node/webhook_trigger-1745710211752",
     "searchId": "unique_search_identifier"
   }
   ```

3. **Critical Note About the Workflow Webhook URL**

   The most important part is using the correct workflow webhook URL. This is the URL where the provider will send results back to your application.
   
   Current URL:
   ```
   https://4e42bf38-b4c9-40d3-8c0c-2427f6eb9ef6-00-293iuvng6jglm.kirk.replit.dev/api/webhooks/workflow/unknown/node/webhook_trigger-1745710211752
   ```

### 2. Receiving Search Results

The second critical component is properly receiving and processing search results delivered via webhook.

#### Implementation Steps

1. **Create a Webhook Endpoint**

   Add this endpoint to receive results from the provider:

   ```javascript
   // Add to your routes.ts file
   app.post("/api/webhooks/workflow/:param1/:param2/:param3/:param4", async (req, res) => {
     try {
       // Extract the search results from the request body
       const { searchId, results, status, error } = req.body;
       
       // Log the incoming webhook (critical for tracking)
       console.log(`Received webhook for searchId: ${searchId}`);
       console.log(`Status: ${status}`);
       
       if (error) {
         console.error(`Search error: ${error}`);
       }
       
       // Process the results if available
       if (results && results.companies) {
         console.log(`Received ${results.companies.length} companies`);
         
         // Store the companies in your database
         for (const company of results.companies) {
           // Process and store each company
           console.log(`Processing company: ${company.name}`);
           
           // Your company storage logic here
           // db.insert(companies).values(company)...
         }
       }
       
       // Process contacts if available
       if (results && results.contacts) {
         console.log(`Received ${results.contacts.length} contacts`);
         
         // Store the contacts in your database
         for (const contact of results.contacts) {
           // Process and store each contact
           console.log(`Processing contact: ${contact.name}`);
           
           // Your contact storage logic here
           // db.insert(contacts).values(contact)...
         }
       }
       
       // Always return a 200 OK response to acknowledge receipt
       // This is critical - providers may retry if they don't get a 200 response
       return res.status(200).json({
         success: true,
         message: "Webhook received and processed successfully"
       });
     } catch (error) {
       console.error(`Error processing webhook: ${error.message}`);
       
       // Still return 200 OK to prevent retries, but indicate there was a processing error
       return res.status(200).json({
         success: false,
         message: "Error processing webhook",
         error: error.message
       });
     }
   });
   ```

2. **Expected Webhook Response Format**

   The provider will send results in this format:

   ```json
   {
     "searchId": "search_1234567890",
     "status": "completed",
     "results": {
       "companies": [
         {
           "name": "Example Company",
           "website": "https://example.com",
           "industry": "Technology",
           "location": "Seattle, WA",
           "size": "50-100 employees",
           "foundedYear": 2015
         }
       ],
       "contacts": [
         {
           "name": "Jane Smith",
           "title": "CEO",
           "email": "jane@example.com",
           "phone": "+1-555-123-4567",
           "linkedin": "https://linkedin.com/in/janesmith"
         }
       ]
     }
   }
   ```

3. **Keep-Alive Mechanism**

   For long-running searches, implement a keep-alive mechanism to ensure your application stays responsive:

   ```javascript
   // Add to your routes.ts file
   
   // Keep track of active keep-alive timers
   const keepAliveTimers = {};
   
   function startKeepAlive(searchId, minutes = 15) {
     console.log(`Starting keep-alive for search ${searchId} (${minutes} minutes)`);
     
     // Clear any existing timer for this search
     if (keepAliveTimers[searchId]) {
       clearInterval(keepAliveTimers[searchId]);
     }
     
     // Calculate interval and end time
     const intervalMs = 30 * 1000; // 30 seconds
     const endTime = Date.now() + (minutes * 60 * 1000);
     
     // Start the interval
     keepAliveTimers[searchId] = setInterval(() => {
       const remaining = endTime - Date.now();
       
       // If time is up, clear the interval
       if (remaining <= 0) {
         console.log(`Keep-alive for search ${searchId} completed`);
         clearInterval(keepAliveTimers[searchId]);
         delete keepAliveTimers[searchId];
         return;
       }
       
       // Log a keep-alive message
       console.log(`Keep-alive ping for search ${searchId} - ${Math.ceil(remaining / 60000)} minutes remaining`);
       
       // Make a simple request to keep the server awake
       fetch("/api/ping").catch(() => {});
     }, intervalMs);
   }
   ```

### 3. Implementing Webhook Logging

The third critical component is logging all webhook communications for monitoring and troubleshooting.

#### Implementation Steps

1. **Create the Webhook Logs Table**

   ```typescript
   // In your schema.ts file
   export const webhookLogs = pgTable("webhook_logs", {
     id: serial("id").primaryKey(),
     requestId: text("request_id").notNull(),
     searchId: text("search_id"),
     source: text("source").notNull(),  // Format: "provider-operation" (e.g. "rabbit-send", "rabbit-receive")
     method: text("method"),
     url: text("url"),
     headers: jsonb("headers").default({}),
     body: jsonb("body").default({}),
     status: text("status").default("pending"), // pending, success, error
     statusCode: integer("status_code"),
     processingDetails: jsonb("processing_details").default({}),
     createdAt: timestamp("created_at").defaultNow().notNull(),
     updatedAt: timestamp("updated_at").defaultNow().notNull(),
     // Indexes for efficient querying
     requestIdIdx: index("webhook_logs_request_id_idx").on("request_id"),
     searchIdIdx: index("webhook_logs_search_id_idx").on("search_id"),
     sourceIdx: index("webhook_logs_source_idx").on("source"),
   });
   ```

2. **Create Logging Functions**

   ```javascript
   // Add to webhook-logger.js file
   async function logOutgoingRequest(searchId, provider, url, payload) {
     const requestId = `${provider}-send-${Date.now()}`;
     
     try {
       // Simple console logging
       console.log(`[${new Date().toISOString()}] Logging outgoing request:`, {
         requestId,
         searchId,
         provider,
         url,
         payload
       });
       
       // Database logging (if applicable)
       const result = await db.insert(webhookLogs).values({
         requestId,
         searchId,
         source: `${provider}-send`,
         method: 'POST',
         url,
         headers: { 'Content-Type': 'application/json' },
         body: payload,
         status: 'sent',
         createdAt: new Date()
       });
       
       return requestId;
     } catch (error) {
       console.error(`Failed to log outgoing request: ${error.message}`);
       return requestId; // Still return the ID even if logging fails
     }
   }
   
   async function logIncomingWebhook(searchId, provider, payload, headers) {
     const requestId = `${provider}-receive-${Date.now()}`;
     
     try {
       // Simple console logging
       console.log(`[${new Date().toISOString()}] Logging incoming webhook:`, {
         requestId,
         searchId,
         provider,
         payload
       });
       
       // Database logging (if applicable)
       const result = await db.insert(webhookLogs).values({
         requestId,
         searchId,
         source: `${provider}-receive`,
         method: 'POST',
         url: '/api/webhooks/workflow',
         headers,
         body: payload,
         status: 'received',
         createdAt: new Date()
       });
       
       return requestId;
     } catch (error) {
       console.error(`Failed to log incoming webhook: ${error.message}`);
       return requestId; // Still return the ID even if logging fails
     }
   }
   
   async function logHttpStatus(requestId, statusCode, statusText, responseData) {
     try {
       // Simple console logging
       console.log(`[${new Date().toISOString()}] Logging HTTP status for ${requestId}:`, {
         statusCode,
         statusText
       });
       
       // Database logging (if applicable)
       await db.update(webhookLogs)
         .set({
           statusCode,
           processingDetails: {
             httpStatus: statusCode,
             httpStatusText: statusText,
             responseTime: new Date().toISOString(),
             responseData
           },
           updatedAt: new Date()
         })
         .where(eq(webhookLogs.requestId, requestId));
     } catch (error) {
       console.error(`Failed to log HTTP status: ${error.message}`);
     }
   }
   ```

3. **Implement Simple Health Checking**

   ```javascript
   // Add to webhook-monitor.js file
   async function checkProviderHealth(provider) {
     try {
       // Get recent logs for this provider
       const cutoffDate = new Date(Date.now() - (24 * 60 * 60 * 1000)); // Last 24 hours
       
       const logs = await db.select()
         .from(webhookLogs)
         .where(
           and(
             like(webhookLogs.source, `${provider}-%`),
             gte(webhookLogs.createdAt, cutoffDate)
           )
         )
         .orderBy(desc(webhookLogs.createdAt));
       
       // Count requests and responses
       const sendLogs = logs.filter(log => log.source === `${provider}-send`);
       const receiveLogs = logs.filter(log => log.source === `${provider}-receive`);
       
       // Calculate error rate
       const errorLogs = sendLogs.filter(log => 
         log.statusCode >= 400 || log.status === 'error'
       );
       
       const requestCount = sendLogs.length;
       const responseCount = receiveLogs.length;
       const errorRate = requestCount > 0 
         ? (errorLogs.length / requestCount) * 100 
         : 0;
       
       // Determine health status
       let health = 'unknown';
       if (requestCount > 0) {
         if (errorRate >= 50) {
           health = 'error';
         } else if (errorRate >= 10) {
           health = 'degraded';
         } else {
           health = 'healthy';
         }
       }
       
       return {
         provider,
         connected: health !== 'unknown',
         health,
         requestCount,
         responseCount,
         errorRate: Math.round(errorRate),
         lastRequest: sendLogs[0] ? {
           time: sendLogs[0].createdAt,
           status: sendLogs[0].statusCode
         } : null,
         lastResponse: receiveLogs[0] ? {
           time: receiveLogs[0].createdAt
         } : null
       };
     } catch (error) {
       console.error(`Error checking provider health: ${error.message}`);
       return {
         provider,
         connected: false,
         health: 'unknown',
         error: error.message
       };
     }
   }
   ```

## Summary

This implementation guide has covered the three essential components needed to integrate with external lead generation providers:

### 1. Sending Search Requests
- Create a function to send properly formatted search requests
- Use the correct workflow webhook URL as the callback destination
- Include all required fields in the request payload

### 2. Receiving Search Results
- Implement a webhook endpoint to receive results
- Process and store the companies and contacts data
- Use a keep-alive mechanism for long-running searches

### 3. Logging Communications
- Log both outgoing requests and incoming webhooks
- Track HTTP status codes to verify successful communication
- Implement health checking to monitor provider status

## Critical Implementation Checklist

- [ ] Configured the correct workflow webhook URL: `https://4e42bf38-b4c9-40d3-8c0c-2427f6eb9ef6-00-293iuvng6jglm.kirk.replit.dev/api/webhooks/workflow/unknown/node/webhook_trigger-1745710211752`
- [ ] Implemented search request function with proper error handling
- [ ] Created webhook endpoint to receive and process search results
- [ ] Set up basic logging for both outgoing requests and incoming webhooks
- [ ] Implemented keep-alive mechanism for long-running searches
- [ ] Added HTTP status code tracking
- [ ] Created simple health checking for providers