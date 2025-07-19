/**
 * Utility script to verify data migration
 */
import { storage as pgStorage } from '../server/storage/database';
import { storage as replitStorage } from './simplified-storage-replit';
import Database from '@replit/database';

// Helper function to list keys with a prefix
async function listKeys(prefix: string): Promise<string[]> {
  const db = new Database();
  try {
    // @ts-ignore: Typing issue with Replit DB
    return await db.list(prefix);
  } catch (e) {
    console.error(`Error listing keys with prefix ${prefix}:`, e);
    return [];
  }
}

async function verifyMigration() {
  console.log('Verifying migration from PostgreSQL to Replit DB...');
  
  try {
    // 1. Get key counts from Replit DB to verify data was migrated
    const userKeys = await listKeys('user:');
    const listKeys = await listKeys('list:');
    const companyKeys = await listKeys('company:');
    const contactKeys = await listKeys('contact:');
    const campaignKeys = await listKeys('campaign:');
    const emailTemplateKeys = await listKeys('emailTemplate:');
    const searchApproachKeys = await listKeys('searchApproach:');
    
    console.log('\nReplit DB key counts:');
    console.log('Users:', userKeys.length);
    console.log('Lists:', listKeys.length);
    console.log('Companies:', companyKeys.length);
    console.log('Contacts:', contactKeys.length);
    console.log('Campaigns:', campaignKeys.length);
    console.log('Email Templates:', emailTemplateKeys.length);
    console.log('Search Approaches:', searchApproachKeys.length);
    
    // 2. Compare with PostgreSQL counts for verification
    console.log('\nPostgreSQL counts:');
    
    // Users
    const pgUsers = await pgStorage.listUsers();
    console.log('Users:', pgUsers.length);
    
    // Lists
    let pgListCount = 0;
    for (const user of pgUsers) {
      const lists = await pgStorage.listLists(user.id);
      pgListCount += lists.length;
    }
    console.log('Lists:', pgListCount);
    
    // Companies
    const pgCompanies = await pgStorage.listCompanies();
    console.log('Companies:', pgCompanies.length);
    
    // Contacts
    let pgContactCount = 0;
    for (const company of pgCompanies) {
      const contacts = await pgStorage.listContactsByCompany(company.id);
      pgContactCount += contacts.length;
    }
    console.log('Contacts:', pgContactCount);
    
    // Campaigns
    let pgCampaignCount = 0;
    for (const user of pgUsers) {
      const campaigns = await pgStorage.listCampaigns(user.id);
      pgCampaignCount += campaigns.length;
    }
    console.log('Campaigns:', pgCampaignCount);
    
    // Email Templates
    let pgEmailTemplateCount = 0;
    for (const user of pgUsers) {
      const templates = await pgStorage.listEmailTemplates(user.id);
      pgEmailTemplateCount += templates.length;
    }
    console.log('Email Templates:', pgEmailTemplateCount);
    
    // Search Approaches
    const pgSearchApproaches = await pgStorage.listSearchApproaches();
    console.log('Search Approaches:', pgSearchApproaches.length);
    
    // 3. Check for discrepancies
    console.log('\nVerification results:');
    
    const results = [
      { entity: 'Users', pg: pgUsers.length, replit: userKeys.length },
      { entity: 'Lists', pg: pgListCount, replit: listKeys.length },
      { entity: 'Companies', pg: pgCompanies.length, replit: companyKeys.length },
      { entity: 'Contacts', pg: pgContactCount, replit: contactKeys.length },
      { entity: 'Campaigns', pg: pgCampaignCount, replit: campaignKeys.length },
      { entity: 'Email Templates', pg: pgEmailTemplateCount, replit: emailTemplateKeys.length },
      { entity: 'Search Approaches', pg: pgSearchApproaches.length, replit: searchApproachKeys.length }
    ];
    
    let allPassed = true;
    
    for (const result of results) {
      if (result.pg === result.replit) {
        console.log(`✅ ${result.entity}: Matched (${result.pg})`);
      } else {
        console.log(`❌ ${result.entity}: Mismatch (PostgreSQL: ${result.pg}, Replit DB: ${result.replit})`);
        allPassed = false;
      }
    }
    
    if (allPassed) {
      console.log('\n🎉 Verification successful! All entity counts match.');
      console.log('You can now switch to using Replit DB by setting USE_REPLIT_DB = true in storage-switcher.ts');
    } else {
      console.log('\n⚠️ Verification failed! Some entity counts do not match.');
      console.log('Please check the discrepancies and run the migration again if necessary.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

// Run the verification
verifyMigration();