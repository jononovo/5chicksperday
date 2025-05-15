// Script to initialize all required search modules and strategies
import { db } from '../server/db.js';
import { searchApproaches } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Define core modules with proper configuration
const CORE_MODULES = [
  {
    name: "Company Overview",
    prompt: "General company analysis and overview information",
    technicalPrompt: "Analyze the company structure, services, products, and key business metrics. Focus on company size, industry vertical, and customer base.",
    responseStructure: `{
      "companyName": "Full legal name of the company",
      "description": "Brief company description",
      "industry": "Primary industry vertical",
      "size": "Approximate number of employees or size category",
      "founded": "Year founded if available",
      "headquarters": "Location of headquarters",
      "website": "Company website URL",
      "services": ["List of primary services or products"],
      "keyMetrics": {
        "revenue": "Estimated annual revenue if available",
        "customerCount": "Approximate number of customers",
        "marketShare": "Estimated market position"
      },
      "validationPoints": ["List of data points that verify company information"]
    }`,
    order: 1,
    active: true,
    moduleType: "company_overview",
    isStrategy: false
  },
  {
    name: "Decision Maker",
    prompt: "Identifies key decision makers and stakeholders within an organization with role-based prioritization.",
    technicalPrompt: "Analyze company structure to identify key decision makers with title and role information.",
    responseStructure: `{
      "decisionMakers": [
        {
          "name": "Full name of the decision maker",
          "role": "Their job title or role in the company",
          "department": "Department they belong to (if known)",
          "email": "Their email address (if available)",
          "influence": "Their level of influence (High/Medium/Low)"
        }
      ]
    }`,
    order: 2,
    active: true,
    moduleType: "decision_maker",
    isStrategy: false
  },
  {
    name: "Email Discovery",
    prompt: "Discovers and validates contact email information",
    technicalPrompt: "Analyze company communication patterns to identify email formats and discover contact email addresses. Verify format validity and domain accuracy.",
    responseStructure: `{
      "emailDomain": "Primary email domain for the company",
      "emailPattern": "Common email pattern used (firstname.lastname, etc)",
      "contactEmails": [
        {
          "name": "Contact name",
          "email": "Email address",
          "role": "Role or position if known",
          "confidence": "Confidence score (1-100)"
        }
      ],
      "alternativeDomains": ["List of alternative email domains used"]
    }`,
    order: 3,
    active: true,
    moduleType: "email_discovery",
    isStrategy: false
  }
];

// Define add-on modules
const ADDON_MODULES = [
  {
    name: "Email Enrichment",
    prompt: "Enriches contact data with additional email confidence scoring",
    technicalPrompt: "Evaluate contact email patterns and domains for validity. Generate confidence scores based on pattern consistency and domain reputation.",
    responseStructure: `{
      "enrichment": [
        {
          "email": "Email address",
          "validityScore": "Score from 0-100",
          "formatAnalysis": "Analysis of email format",
          "domainConfidence": "Confidence in domain validity",
          "suggestedCorrections": "Any suggested corrections if needed"
        }
      ]
    }`,
    order: 4,
    active: true,
    moduleType: "email_enrichment",
    isStrategy: false
  },
  {
    name: "Email Deepdive",
    prompt: "In-depth analysis of email patterns and verification",
    technicalPrompt: "Perform deep analysis of company email structures and verification. Cross-reference with known contact points and validate against domain reputation data.",
    responseStructure: `{
      "analysis": {
        "patternConsistency": "Assessment of pattern consistency across company",
        "domainVerification": "Domain verification status",
        "securityMeasures": "Email security measures detected"
      },
      "enhancedContacts": [
        {
          "email": "Email address",
          "verificationLevel": "Verification level achieved",
          "lastVerified": "When this was last verified if known",
          "alternativeContactPoints": ["List of alternative contact methods"]
        }
      ]
    }`,
    order: 5,
    active: true,
    moduleType: "email_deepdive",
    isStrategy: false
  }
];

// Define strategies
const STRATEGIES = [
  {
    name: "Advanced Key Contact Discovery",
    prompt: "Enhanced discovery of decision makers with leadership role prioritization",
    technicalPrompt: "Implement multi-phase search strategy focusing on company structure, leadership identification, and verified contact methods.",
    responseStructure: `{
      "strategyResults": {
        "companyAnalysis": "Analysis of company structure and size",
        "leadershipIdentification": "Process used to identify leadership",
        "contactVerification": "Verification methodology"
      },
      "recommendations": ["Strategic recommendations for contact approach"]
    }`,
    order: 0,
    active: true,
    moduleType: "company_overview",
    isStrategy: true,
    sequence: JSON.stringify({
      modules: ['company_overview', 'decision_maker', 'email_discovery', 'email_deepdive'],
      moduleConfigs: {
        company_overview: {
          subsearches: { 
            'small-business-validation': true,
            'company-size-analysis': true 
          },
          searchOptions: { 
            ignoreFranchises: true,
            locallyHeadquartered: true,
            focusOnLeadership: true
          }
        },
        decision_maker: {
          subsearches: { 
            'owner-identification': true,
            'leadership-role-validation': true,
            'enhanced-name-validation': true
          },
          searchOptions: { 
            requireRole: true,
            roleMinimumScore: 85,
            minimumNameScore: 80,
            preferFullNames: true
          }
        }
      }
    })
  },
  {
    name: "Default Search",
    prompt: "Basic contact discovery using company overview and basic decision maker analysis",
    technicalPrompt: "Conduct straightforward search focusing on company overview and identifying primary contacts.",
    responseStructure: null,
    order: 6,
    active: true,
    moduleType: "company_overview",
    isStrategy: true,
    sequence: JSON.stringify({
      modules: ['company_overview', 'decision_maker'],
      moduleConfigs: {
        company_overview: {
          searchOptions: { 
            standard: true
          }
        },
        decision_maker: {
          searchOptions: { 
            standard: true
          }
        }
      }
    })
  }
];

async function initializeSearchModules() {
  console.log('Starting initialization of search modules and strategies...');
  
  try {
    // Insert core modules
    for (const module of CORE_MODULES) {
      // Check if module already exists
      const [existing] = await db
        .select()
        .from(searchApproaches)
        .where(eq(searchApproaches.name, module.name));
      
      if (!existing) {
        console.log(`Creating core module: ${module.name}`);
        await db.insert(searchApproaches).values(module);
      } else {
        console.log(`Updating core module: ${module.name}`);
        await db.update(searchApproaches)
          .set(module)
          .where(eq(searchApproaches.id, existing.id));
      }
    }
    
    // Insert addon modules
    for (const module of ADDON_MODULES) {
      // Check if module already exists
      const [existing] = await db
        .select()
        .from(searchApproaches)
        .where(eq(searchApproaches.name, module.name));
      
      if (!existing) {
        console.log(`Creating addon module: ${module.name}`);
        await db.insert(searchApproaches).values(module);
      } else {
        console.log(`Updating addon module: ${module.name}`);
        await db.update(searchApproaches)
          .set(module)
          .where(eq(searchApproaches.id, existing.id));
      }
    }
    
    // Insert strategies
    for (const strategy of STRATEGIES) {
      // Check if strategy already exists
      const [existing] = await db
        .select()
        .from(searchApproaches)
        .where(eq(searchApproaches.name, strategy.name));
      
      if (!existing) {
        console.log(`Creating strategy: ${strategy.name}`);
        await db.insert(searchApproaches).values(strategy);
      } else {
        console.log(`Updating strategy: ${strategy.name}`);
        await db.update(searchApproaches)
          .set(strategy)
          .where(eq(searchApproaches.id, existing.id));
      }
    }
    
    console.log('Initialization complete!');
  } catch (error) {
    console.error('Error initializing search modules:', error);
  }
}

// Run the initialization
initializeSearchModules().then(() => {
  console.log('Script execution complete');
  process.exit(0);
}).catch(err => {
  console.error('Script execution failed:', err);
  process.exit(1);
});