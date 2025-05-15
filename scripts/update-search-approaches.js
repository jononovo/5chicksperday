// Script to update search approaches in the database to use the new isStrategy field
import { db } from '../server/db.js';
import { searchApproaches } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Define which approaches are strategies vs modules
const STRATEGIES = [
  "Advanced Key Contact Discovery",
  "Small Business Contacts",
  "Enhanced Contact Discovery", 
  "Legacy Search (v1)",
  "Comprehensive Search",
  "Lion",
  "Donkey",
  "Rabbit"
];

// Define which approaches are core modules
const CORE_MODULES = [
  "Company Overview",
  "Decision Maker",
  "Email Discovery"
];

// Define which approaches are add-on modules
const ADDON_MODULES = [
  "Email Enrichment",
  "Email Deepdive"
];

async function updateSearchApproaches() {
  console.log('Starting update of search approaches...');
  
  try {
    // Get all approaches
    const approaches = await db.select().from(searchApproaches);
    console.log(`Found ${approaches.length} search approaches`);
    
    for (const approach of approaches) {
      let isStrategy = STRATEGIES.includes(approach.name);
      
      // Update the approach with isStrategy value
      await db.update(searchApproaches)
        .set({ isStrategy })
        .where(eq(searchApproaches.id, approach.id));
        
      console.log(`Updated approach "${approach.name}" - isStrategy: ${isStrategy}`);
    }
    
    console.log('Update complete!');
  } catch (error) {
    console.error('Error updating search approaches:', error);
  }
}

// Run the update
updateSearchApproaches().then(() => {
  console.log('Script execution complete');
  process.exit(0);
}).catch(err => {
  console.error('Script execution failed:', err);
  process.exit(1);
});