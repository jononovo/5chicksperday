// Script to seed test data for outreach system
import { db } from './db';
import { companies, contacts } from '@shared/schema';

async function seedTestData() {
  console.log('Seeding test data for outreach system...\n');

  try {
    const userId = 1; // Demo user
    
    // Create test companies
    console.log('Creating test companies...');
    const testCompanies = [
      {
        userId,
        name: 'TechCorp Solutions',
        website: 'https://techcorp.example.com',
        description: 'A leading provider of enterprise software solutions',
        industry: 'Software',
        companySize: '100-500',
        location: 'San Francisco, CA',
        companyStatus: 'uncontacted' as const
      },
      {
        userId,
        name: 'Digital Innovations Inc',
        website: 'https://digitalinnovations.example.com',
        description: 'Innovative digital transformation services',
        industry: 'Consulting',
        companySize: '50-100',
        location: 'New York, NY',
        companyStatus: 'uncontacted' as const
      },
      {
        userId,
        name: 'CloudFirst Systems',
        website: 'https://cloudfirst.example.com',
        description: 'Cloud infrastructure and DevOps solutions',
        industry: 'Cloud Services',
        companySize: '200-500',
        location: 'Seattle, WA',
        companyStatus: 'uncontacted' as const
      },
      {
        userId,
        name: 'DataDriven Analytics',
        website: 'https://datadriven.example.com',
        description: 'Business intelligence and data analytics platform',
        industry: 'Analytics',
        companySize: '20-50',
        location: 'Austin, TX',
        companyStatus: 'uncontacted' as const
      },
      {
        userId,
        name: 'SecureNet Technologies',
        website: 'https://securenet.example.com',
        description: 'Cybersecurity solutions for modern businesses',
        industry: 'Security',
        companySize: '100-200',
        location: 'Boston, MA',
        companyStatus: 'uncontacted' as const
      }
    ];

    const insertedCompanies = await db.insert(companies)
      .values(testCompanies)
      .returning();
    
    console.log(`✓ Created ${insertedCompanies.length} test companies`);

    // Create test contacts for each company
    console.log('\nCreating test contacts...');
    const testContacts = [];
    
    for (const company of insertedCompanies) {
      testContacts.push(
        {
          userId,
          companyId: company.id,
          name: `John Smith`,
          email: `john.smith@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
          role: 'VP of Sales',
          phone: '555-0100',
          contactStatus: 'uncontacted' as const,
          emailCount: 0
        },
        {
          userId,
          companyId: company.id,
          name: `Sarah Johnson`,
          email: `sarah.johnson@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
          role: 'Director of Operations',
          phone: '555-0101',
          contactStatus: 'uncontacted' as const,
          emailCount: 0
        },
        {
          userId,
          companyId: company.id,
          name: `Michael Davis`,
          email: `michael.davis@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
          role: 'CEO',
          phone: '555-0102',
          contactStatus: 'uncontacted' as const,
          emailCount: 0
        }
      );
    }

    const insertedContacts = await db.insert(contacts)
      .values(testContacts)
      .returning();
    
    console.log(`✓ Created ${insertedContacts.length} test contacts`);
    
    // Display summary
    console.log('\n📊 Test Data Summary:');
    console.log(`  - ${insertedCompanies.length} companies created`);
    console.log(`  - ${insertedContacts.length} contacts created (3 per company)`);
    console.log('\nSample contacts created:');
    insertedContacts.slice(0, 5).forEach(contact => {
      const company = insertedCompanies.find(c => c.id === contact.companyId);
      console.log(`  - ${contact.name} (${contact.role}) at ${company?.name}`);
      console.log(`    Email: ${contact.email}`);
    });
    
    console.log('\n✅ Test data seeded successfully!');
    console.log('You can now test the outreach system with these contacts.');
    
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
  }
  
  process.exit(0);
}

// Run the seeding
seedTestData();