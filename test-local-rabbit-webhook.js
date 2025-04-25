/**
 * Test script to simulate a webhook from Lead-Gen Rabbit to our local endpoint
 * This will help us verify that the webhook logging system works properly
 */
import fetch from 'node-fetch';

async function testLocalRabbitWebhook() {
  try {
    console.log("=== SENDING TEST RABBIT WEBHOOK TO LOCAL SERVER ===");
    
    // Create a sample searchId that includes rabbit to be easily identifiable
    const searchId = `rabbit-search-${Date.now()}`;
    console.log(`Using test searchId: ${searchId}`);
    
    // Create a realistic-looking payload similar to what Rabbit would send
    const payload = {
      searchId: searchId,
      status: 'completed',
      timestamp: new Date().toISOString(),
      results: {
        companies: [
          {
            name: "Test Rabbit Company",
            website: "https://example.com",
            industry: "Software Testing",
            location: "Testville, USA",
            description: "A test company created to verify webhook logging",
            employeeCount: 42,
            foundedYear: 2023,
            socialProfiles: {
              linkedin: "https://linkedin.com/company/test-rabbit"
            }
          }
        ],
        contacts: [
          {
            name: "Test Person",
            role: "Chief Testing Officer",
            email: "test@example.com",
            phoneNumber: "555-TEST",
            linkedinUrl: "https://linkedin.com/in/test-person"
          }
        ],
        metadata: {
          moduleType: "company_search",
          completedSearches: ["local_sources", "web_search"],
          validationScores: {
            company: 0.95,
            contact: 0.85
          },
          queryDetails: {
            original: "Software testing companies in Testville",
            refined: "Software QA and testing providers in Testville, USA"
          }
        }
      }
    };
    
    // Send the webhook to our local endpoint
    console.log("Sending webhook to http://localhost:5000/api/external-workflow/webhook...");
    
    const response = await fetch("http://localhost:5000/api/external-workflow/webhook", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LGR-Search-ID': searchId, // Add a custom header like Rabbit might use
        'User-Agent': 'Lead-Gen-Rabbit/1.0 (Test)',
        'X-Webhook-Type': 'lead-gen-rabbit' // This header helps our system identify the source
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    const responseText = await response.text();
    console.log("Response body:", responseText);
    
    // Check the webhook logs to verify they were stored
    console.log("\nChecking webhook logs...");
    const logsResponse = await fetch("http://localhost:5000/api/monitor/webhook-logs?limit=5");
    const logsData = await logsResponse.json();
    
    if (logsData.logs && logsData.logs.length > 0) {
      console.log(`Found ${logsData.logs.length} webhook logs. Most recent:`);
      logsData.logs.forEach((log, i) => {
        console.log(`${i+1}. ${log.requestId} (${log.timestamp})`);
      });
    } else {
      console.log("No webhook logs found. Something might be wrong.");
    }
    
    // Check webhook stats
    console.log("\nChecking webhook stats...");
    const statsResponse = await fetch("http://localhost:5000/api/monitor/webhook-stats");
    const statsData = await statsResponse.json();
    
    console.log(`Total logs: ${statsData.totalFileLogs || 'unknown'} (filesystem), ${statsData.totalDbLogs || 'unknown'} (database)`);
    console.log(`Recent logs in last 24h: ${statsData.recentLogs24h || 'unknown'}`);
    
    console.log("\n=== TEST COMPLETE ===");
    
  } catch (error) {
    console.error("Error testing webhook:", error);
  }
}

// Run the test
testLocalRabbitWebhook();