import fetch from 'node-fetch';

async function testWebhookEndpoint() {
  try {
    console.log("Testing webhook endpoint directly...");
    
    // Get our server URL from the environment or use localhost
    const host = process.env.REPLIT_DEPLOYMENT_URL || 'http://localhost:5000';
    const webhookUrl = `${host}/api/external-workflow/webhook`;
    
    console.log("Webhook URL:", webhookUrl);
    
    // Create a test payload similar to what Rabbit would send
    const mockPayload = {
      searchId: `test_direct_call_${Date.now()}`,
      status: "completed",
      results: {
        companies: [
          {
            name: "TestAI Boston",
            website: "https://testaiboston.com",
            industry: "Artificial Intelligence",
            location: "Boston, MA",
            description: "A test company for webhook endpoint debugging",
            employeeCount: 45,
            foundedYear: 2020,
            revenue: "$5M-$10M",
            socialProfiles: {
              linkedin: "https://linkedin.com/company/testaiboston"
            },
            technologiesUsed: ["Python", "TensorFlow", "Machine Learning"],
            productOfferings: ["AI Solutions", "Machine Learning as a Service"],
            headquarters: "Boston, MA",
            contacts: [
              {
                name: "Jane Smith",
                role: "CTO",
                email: "jane@testaiboston.com",
                probability: 85,
                linkedinUrl: "https://linkedin.com/in/janesmith",
                department: "Engineering"
              }
            ]
          }
        ],
        contacts: [],
        metadata: {
          moduleType: "TEST_MODULE",
          completedSearches: ["COMPANY_OVERVIEW", "DECISION_MAKER", "EMAIL_DISCOVERY"],
          validationScores: {
            companyScore: 90,
            contactScore: 85,
            emailScore: 80
          },
          queryDetails: {
            original: "AI startups in Boston",
            refined: "Artificial Intelligence startups in Boston, Massachusetts"
          }
        }
      }
    };
    
    // Send the request to our webhook endpoint
    console.log("Sending test payload:", JSON.stringify(mockPayload, null, 2));
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockPayload)
    });
    
    console.log("Response status:", response.status);
    
    // Get the response text
    const responseText = await response.text();
    console.log("Response body:", responseText);
    
    // Success message
    if (response.ok) {
      console.log("\nTest completed successfully. Check your server logs to verify data processing.");
      console.log("If a test company 'TestAI Boston' appears in your companies list, the webhook endpoint is working correctly.");
    } else {
      console.error("\nError testing webhook endpoint. See response details above.");
    }
    
  } catch (error) {
    console.error("Error during test:", error.message);
  }
}

// Run the test
testWebhookEndpoint();