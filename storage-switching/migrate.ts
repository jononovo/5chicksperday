/**
 * Utility script to migrate data from PostgreSQL to Replit DB
 */
import { storage as pgStorage } from '../server/storage';
import { storage as replitStorage } from './simplified-storage-replit';

async function migrateToReplitDb() {
  console.log('Starting simplified migration from PostgreSQL to Replit DB...');
  
  try {
    // Simplified minimal migration approach
    console.log('Step 1: Fetching minimal required data from PostgreSQL...');
    
    // Get user with ID 1 (default development user)
    const user = await pgStorage.getUserByEmail("user@example.com");
    if (!user) {
      console.log('Main user not found, using default data');
      const defaultUser = {
        id: 1,
        email: "user@example.com",
        username: "user",
        password: "hashed_password_placeholder",
        createdAt: new Date()
      };
      
      // Migrate with minimal default data
      await replitStorage.migrateFromPostgres({
        users: [defaultUser],
        lists: [],
        companies: [],
        contacts: [],
        campaigns: [],
        campaignLists: [],
        emailTemplates: [],
        searchApproaches: [],
        userPreferences: [],
        searchTestResults: []
      });
      
      console.log('\nMigration completed with default data!');
      return;
    }
    
    console.log(`Found user: ${user.email}`);
    
    // Get minimal data for this user
    const lists = await pgStorage.listLists(user.id);
    console.log(`Found ${lists.length} lists`);
    
    const companies = await pgStorage.listCompanies(user.id);
    console.log(`Found ${companies.length} companies`);
    
    // Get contacts with a limit per company to avoid delays
    let contacts: any[] = [];
    for (const company of companies) {
      try {
        const companyContacts = await pgStorage.listContactsByCompany(company.id, user.id);
        contacts = [...contacts, ...companyContacts];
      } catch (e) {
        console.log(`Error fetching contacts for company ${company.id}: ${e}`);
      }
    }
    console.log(`Found ${contacts.length} contacts`);
    
    // Get email templates
    let emailTemplates: any[] = [];
    try {
      emailTemplates = await pgStorage.listEmailTemplates(user.id);
    } catch (e) {
      console.log(`Error fetching email templates: ${e}`);
    }
    console.log(`Found ${emailTemplates.length} email templates`);
    
    // Skip the rest of the data for simplicity and speed
    console.log(`Skipping other data types for simplified migration`);
    
    // Migrate the minimal data we've collected
    console.log('\nStep 2: Migrating minimal data to Replit DB...');
    await replitStorage.migrateFromPostgres({
      users: [user],
      lists,
      companies,
      contacts,
      campaigns: [],
      campaignLists: [],
      emailTemplates,
      searchApproaches: [],
      userPreferences: [],
      searchTestResults: []
    });
    
    console.log('\nSimplified migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    console.log('Error details:', error instanceof Error ? error.stack : String(error));
    process.exit(1);
  }
}

// Run the migration
migrateToReplitDb();