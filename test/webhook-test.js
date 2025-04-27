// Webhook Test Script for 5Ducks Platform
// This script simulates a webhook response from the workflow system

import fetch from 'node-fetch';

// Configure the webhook test
const WEBHOOK_URL = 'https://7309249b-35d5-4d49-bf1b-820c1a4e2045-00-28p4ynamkriib.kirk.replit.dev/api/webhooks/workflow';
const USER_ID = 2; // Using our test user ID we created
const SEARCH_ID = `search_${USER_ID}_${Date.now()}`;

// Sample webhook payload with company and contact data
const webhookPayload = {
  searchId: SEARCH_ID,
  status: 'completed',
  results: {
    companies: [
      {
        name: 'Acme Tech Solutions',
        website: 'https://acmetech.example.com',
        size: 120,
        industry: 'Technology',
        location: 'San Francisco, CA',
        services: [
          'Software Development',
          'Cloud Services',
          'Data Analytics'
        ],
        validationPoints: [
          'Established in 2010',
          'Serves enterprise clients',
          'ISO certified'
        ],
        differentiation: [
          'Proprietary cloud technology',
          'Industry-specific expertise',
          'High customer retention rate'
        ],
        totalScore: 85
      },
      {
        name: 'Global Innovate Partners',
        website: 'https://gip.example.com',
        size: 75,
        industry: 'Consulting',
        location: 'Chicago, IL',
        services: [
          'Business Strategy',
          'Digital Transformation',
          'Market Research'
        ],
        validationPoints: [
          'Founded by industry veterans',
          'Rapid growth since 2018',
          'Award-winning consultancy'
        ],
        differentiation: [
          'AI-driven consulting approach',
          'Results-based pricing model',
          'Specialization in emerging markets'
        ],
        totalScore: 78
      }
    ],
    contacts: [
      {
        name: 'Sarah Johnson',
        title: 'Chief Technology Officer',
        role: 'Technical Decision Maker',
        email: 'sjohnson@acmetech.example.com',
        phone: '(555) 123-4567',
        linkedin: 'https://linkedin.com/in/sarahjohnson-example',
        companyName: 'Acme Tech Solutions',
        department: 'Executive Leadership',
        location: 'San Francisco, CA',
        nameConfidenceScore: 95,
        emailConfidenceScore: 90
      },
      {
        name: 'Michael Chen',
        title: 'VP of Engineering',
        role: 'Technical Influencer',
        email: 'mchen@acmetech.example.com',
        linkedin: 'https://linkedin.com/in/michaelchen-example',
        companyName: 'Acme Tech Solutions',
        department: 'Engineering',
        nameConfidenceScore: 92
      },
      {
        name: 'David Wilson',
        title: 'CEO',
        role: 'Economic Decision Maker',
        email: 'dwilson@gip.example.com',
        phone: '(555) 987-6543',
        linkedin: 'https://linkedin.com/in/davidwilson-example',
        companyName: 'Global Innovate Partners',
        department: 'Executive Leadership',
        nameConfidenceScore: 98,
        emailConfidenceScore: 95
      }
    ]
  },
  metadata: {
    processingTime: '45.3s',
    moduleFlow: 'standard_b2b_discovery',
    version: '1.2.3',
    queryOptimization: {
      originalQuery: 'tech companies in San Francisco',
      optimizedQueries: [
        'enterprise software companies San Francisco',
        'B2B SaaS providers Bay Area'
      ]
    }
  }
};

// Function to send the test webhook
async function sendTestWebhook() {
  console.log(`Sending test webhook to ${WEBHOOK_URL}`);
  console.log(`Using search ID: ${SEARCH_ID}`);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'test-script',
        'X-API-Key': 'test_webhook_key'
      },
      body: JSON.stringify(webhookPayload)
    });
    
    const data = await response.json();
    
    console.log(`Response status: ${response.status}`);
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Webhook test completed successfully');
    } else {
      console.log('❌ Webhook test failed');
    }
  } catch (error) {
    console.error('Error sending webhook:', error);
  }
}

// Execute the test
sendTestWebhook();