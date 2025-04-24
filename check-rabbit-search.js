// Script to check if we've received any webhooks from Lead-Gen Rabbit
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/pg-server';
import * as schema from './shared/schema.js';

// Use actual pool configuration
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function checkWebhookResults(searchId) {
  try {
    console.log("Checking for webhook results for search ID:", searchId);
    
    // Query the database for companies that were created from this search
    // This assumes the companies have a field that identifies which search they came from
    // If not, we can look at the most recently created companies
    const companies = await db.query.companies.findMany({
      orderBy: [{ id: 'desc' }],
      limit: 10
    });
    
    console.log(`Found ${companies.length} recent companies:`);
    
    for (const company of companies) {
      console.log(`- ${company.name} (ID: ${company.id})`);
      
      // Get contacts for this company
      const contacts = await db.query.contacts.findMany({
        where: { companyId: company.id }
      });
      
      console.log(`  ${contacts.length} contacts:`);
      for (const contact of contacts) {
        console.log(`  - ${contact.name}, ${contact.role || 'No role'}, Email: ${contact.email || 'No email'}`);
      }
    }
    
  } catch (error) {
    console.error("Error checking webhook results:", error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Get the search ID from command line arguments or use the default
const searchId = process.argv[2] || "rabbit_search_1745527473922"; // Use the search ID from our last test
checkWebhookResults(searchId);