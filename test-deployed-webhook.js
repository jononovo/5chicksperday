/**
 * Test script to simulate a webhook to the deployed production endpoint from Lead-Gen Rabbit with exact expected format
 */
import fetch from 'node-fetch';

async function testDeployedRabbitWebhook() {
  const searchId = `rabbit_search_${Date.now()}`;
  
  // Create payload matching Rabbit's documented format
  const payload = {
    searchId: searchId,
    status: "completed",
    progress: 100,
    results: {
      companies: [
        {
          name: "DEPLOYED TEST - XYZ Plumbing & Heating",
          website: "https://www.xyzplumbing-deployed-test.com",
          industry: "Plumbing",
          location: "Portland, OR",
          description: "A test plumbing company created to verify deployed webhook processing",
          employeeCount: 35,
          foundedYear: 2005,
          revenue: "$5-10 million",
          socialProfiles: {
            linkedin: "https://www.linkedin.com/company/xyz-plumbing-deployed-test",
            facebook: "https://www.facebook.com/xyzplumbingtest"
          },
          technologiesUsed: ["HubSpot", "Salesforce", "Xero"],
          productOfferings: ["Residential Plumbing", "HVAC Services", "Commercial Plumbing"],
          headquarters: "Portland, OR",
          contacts: [
            {
              name: "Robert Williams",
              role: "CEO",
              email: "robert@xyzplumbing-deployed-test.com",
              probability: 98,
              linkedinUrl: "https://www.linkedin.com/in/robertwilliams-test",
              phoneNumber: "503-555-7890",
              department: "Executive",
              nameConfidenceScore: 95
            },
            {
              name: "Jennifer Davis",
              role: "Marketing Director",
              email: "jennifer@xyzplumbing-deployed-test.com",
              probability: 90,
              linkedinUrl: "https://www.linkedin.com/in/jenniferdavis-test",
              phoneNumber: "503-555-4567",
              department: "Marketing",
              nameConfidenceScore: 92
            }
          ]
        }
      ],
      metadata: {
        moduleType: "Company Search",
        completedSearches: ["web_search", "social_media_search"],
        validationScores: {
          companyNameValidation: 97,
          contactValidation: 94
        },
        queryDetails: {
          original: "large plumbers in Portland",
          refined: "large plumbing businesses Portland Oregon"
        }
      }
    }
  };

  console.log(`Sending test webhook to DEPLOYED endpoint with searchId: ${searchId}`);
  
  try {
    // Use the deployed URL 
    const webhookUrl = 'https://Bear-App.replit.app/api/external-workflow/webhook';
    
    // Send the webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Type': 'lead-gen-rabbit',
        'X-LGR-Search-ID': searchId
      },
      body: JSON.stringify(payload)
    });
    
    // Log the response
    const responseStatus = response.status;
    const responseText = await response.text();
    
    console.log(`Response Status: ${responseStatus}`);
    console.log(`Response Body: ${responseText}`);
    
    // Check if the webhook was processed successfully
    if (responseStatus === 200) {
      console.log("Webhook sent successfully to DEPLOYED endpoint!");
      console.log("Check the deployed application for the new companies.");
    } else {
      console.log("Webhook failed to send or process correctly on the deployed endpoint.");
    }
  } catch (error) {
    console.error("Error sending test webhook to deployed endpoint:", error);
  }
}

// Execute the test
testDeployedRabbitWebhook();