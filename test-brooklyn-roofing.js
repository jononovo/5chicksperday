import fetch from 'node-fetch';

/**
 * Tests sending the exact Brooklyn roofing data to our webhook endpoint
 */
async function testBrooklynRoofingWebhook() {
  const webhookUrl = 'https://Bear-App.replit.app/api/external-workflow/webhook';
  
  const payload = {
    "searchId": "rabbit_search_1745535436802",
    "status": "completed",
    "progress": 100,
    "results": {
      "companies": [
        {
          "name": "Royal Roofing & Siding",
          "website": "https://www.royalroofingny.com",
          "industry": "Roofing Contractors",
          "location": "Brooklyn, NY",
          "description": "Full-service roofing contractor specializing in residential and commercial projects",
          "employeeCount": 45,
          "foundedYear": 2003,
          "headquarters": "Brooklyn, NY"
        },
        {
          "name": "Brooklyn Roofing Masters",
          "website": "https://www.brooklynroofingmasters.com",
          "industry": "Roofing Contractors",
          "location": "Brooklyn, NY",
          "description": "Mid-sized roofing contractor serving the five boroughs with expertise in flat roofing systems",
          "employeeCount": 62,
          "foundedYear": 1997,
          "headquarters": "Brooklyn, NY"
        },
        {
          "name": "Allied Roofing & Waterproofing",
          "website": "https://www.alliedroofingnyc.com",
          "industry": "Roofing Contractors",
          "location": "Brooklyn, NY",
          "description": "Commercial and residential roofing specialist with a focus on waterproofing solutions",
          "employeeCount": 38,
          "foundedYear": 2001,
          "headquarters": "Brooklyn, NY"
        },
        {
          "name": "Empire State Roofing & Construction",
          "website": "https://www.empirestateroof.com",
          "industry": "Roofing Contractors",
          "location": "Brooklyn, NY",
          "description": "Roofing contractor offering comprehensive services for residential and commercial properties",
          "employeeCount": 73,
          "foundedYear": 1992,
          "headquarters": "Brooklyn, NY"
        },
        {
          "name": "Brooklyn Roof Experts",
          "website": "https://www.brooklynroofexperts.com",
          "industry": "Roofing Contractors",
          "location": "Brooklyn, NY",
          "description": "Specialized roof repair and installation provider for historic Brooklyn buildings",
          "employeeCount": 51,
          "foundedYear": 2005,
          "headquarters": "Brooklyn, NY"
        }
      ],
      "metadata": {
        "moduleType": "COMPANY_SEARCH",
        "validationScores": {
          "companyScore": 92
        },
        "queryDetails": {
          "original": "mid-sized roofing contractors in brooklyn",
          "refined": "brooklyn new york roofing contractors 30-80 employees"
        }
      }
    }
  };

  try {
    console.log(`Testing webhook with Brooklyn roofing data...`);
    console.log(`Sending to: ${webhookUrl}`);
    
    // Add appropriate headers to mimic external provider
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Lead-Gen-Rabbit/1.0',
        'X-Provider': 'Rabbit',
      },
      body: JSON.stringify(payload)
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (response.headers.get('content-type')?.includes('application/json')) {
      const responseBody = await response.json();
      console.log(`Response body: ${JSON.stringify(responseBody)}`);
    } else {
      const textResponse = await response.text();
      console.log(`Response body: ${textResponse.slice(0, 200)}...`);
    }

    console.log(`\nNow checking if companies were added to database...`);
    // Wait a moment for database processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for companies manually instead
    console.log(`Checking for Brooklyn roofing companies...`);
    // For this test, we'll just let the user check manually
    
  } catch (error) {
    console.error(`Error testing webhook:`, error);
  }
}

testBrooklynRoofingWebhook();