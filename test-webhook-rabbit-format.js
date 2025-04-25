/**
 * Test script to simulate a webhook from Lead-Gen Rabbit with exact expected format
 */
import fetch from 'node-fetch';

async function testRabbitWebhook() {
  const searchId = `rabbit_search_${Date.now()}`;
  
  // Create payload matching Rabbit's documented format
  const payload = {
    searchId: searchId,
    status: "completed",
    progress: 100,
    results: {
      companies: [
        {
          name: "ABC Plumbing Test Company",
          website: "https://www.abcplumbing-test.com",
          industry: "Plumbing",
          location: "Seattle, WA",
          description: "A test plumbing company created to verify webhook processing",
          employeeCount: 25,
          foundedYear: 2010,
          revenue: "$1-5 million",
          socialProfiles: {
            linkedin: "https://www.linkedin.com/company/abc-plumbing-test",
            facebook: "https://www.facebook.com/abcplumbingtest"
          },
          technologiesUsed: ["Wordpress", "Mailchimp", "QuickBooks"],
          productOfferings: ["Residential Plumbing", "Commercial Plumbing", "Emergency Services"],
          headquarters: "Seattle, WA",
          contacts: [
            {
              name: "John Smith",
              role: "Owner",
              email: "john@abcplumbing-test.com",
              probability: 95,
              linkedinUrl: "https://www.linkedin.com/in/johnsmith-test",
              phoneNumber: "206-555-1234",
              department: "Management",
              nameConfidenceScore: 90
            },
            {
              name: "Sarah Johnson",
              role: "Office Manager",
              email: "sarah@abcplumbing-test.com",
              probability: 85,
              linkedinUrl: "https://www.linkedin.com/in/sarahjohnson-test",
              phoneNumber: "206-555-5678",
              department: "Administration",
              nameConfidenceScore: 88
            }
          ]
        },
        {
          name: "XYZ Plumbing Services Test",
          website: "https://www.xyzplumbing-test.com",
          industry: "Plumbing",
          location: "Bellevue, WA",
          description: "Another test plumbing company for webhook validation",
          employeeCount: 15,
          foundedYear: 2015,
          revenue: "$500k-1 million",
          socialProfiles: {
            linkedin: "https://www.linkedin.com/company/xyz-plumbing-test"
          },
          technologiesUsed: ["Google Workspace", "Asana"],
          productOfferings: ["Residential Plumbing", "Drain Cleaning"],
          headquarters: "Bellevue, WA",
          contacts: [
            {
              name: "Michael Brown",
              role: "Owner",
              email: "michael@xyzplumbing-test.com",
              probability: 92,
              linkedinUrl: "https://www.linkedin.com/in/michaelbrown-test",
              phoneNumber: "425-555-4321",
              department: "Management",
              nameConfidenceScore: 95
            }
          ]
        }
      ],
      metadata: {
        moduleType: "Company Search",
        completedSearches: ["web_search", "business_directory"],
        validationScores: {
          companyNameValidation: 95,
          contactValidation: 90
        },
        queryDetails: {
          original: "mid-sized plumbers in Seattle",
          refined: "medium plumbing businesses Seattle Washington"
        }
      }
    }
  };

  console.log(`Sending test webhook with searchId: ${searchId}`);
  
  try {
    // Use localhost for local testing, but you can change this to your actual deployed URL
    const webhookUrl = 'http://localhost:5000/api/external-workflow/webhook';
    
    // Send the webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Type': 'lead-gen-rabbit'
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
      console.log("Webhook sent successfully! Check server logs for processing details.");
      console.log("Wait a few seconds for async processing to complete...");
      
      // Wait a few seconds for async processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Now check if the companies were saved
      console.log("Checking if companies were saved to database...");
      
      const checkResponse = await fetch('http://localhost:5000/api/companies/recent');
      const companies = await checkResponse.json();
      
      // Look for our test companies
      const testCompanies = companies.filter(c => 
        c.name.includes("Test Company") || c.name.includes("Plumbing Test")
      );
      
      if (testCompanies.length > 0) {
        console.log("SUCCESS! Test companies were saved to the database:");
        testCompanies.forEach(company => {
          console.log(`- ${company.name} (ID: ${company.id})`);
        });
      } else {
        console.log("ERROR: Test companies were not found in the database.");
        console.log("Check server logs for errors in the webhook processing.");
      }
    } else {
      console.log("Webhook failed to send or process correctly.");
    }
  } catch (error) {
    console.error("Error sending test webhook:", error);
  }
}

// Execute the test
testRabbitWebhook();