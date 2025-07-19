const Database = require('@replit/database');
const db = new Database();

async function investigateDatabase() {
  console.log('🔍 REPLIT KV DATABASE INVESTIGATION');
  console.log('='.repeat(50));

  try {
    // Get all keys

     db.set('user_credits:60', JSON.stringify({ "currentBalance": 15060, "lastTopUp": 1752785243403, "totalUsed": 240, "isBlocked": false, "transactions": [{ "type": "credit", "amount": 180, "description": "Welcome bonus - 180 free credits", "timestamp": 1752785243403 }, { "type": "debit", "amount": 240, "description": "company contacts_emails search", "timestamp": 1752785390555, "searchType": "company_contacts_emails", "success": true }], "monthlyAllowance": 5000, "createdAt": 1752785243403, "updatedAt": 1752787144613, "badges": [1], "notifications": [null, null, null, 1, 1], "stripeCustomerId": "cus_ShNy4kWffQhCwH" }))
    console.log('\n1. ALL DATABASE KEYS:');
    const keysOk = await db.list();
    if (keysOk.error) {
      console.log(`keys error`, keysOk.error)
      return;
    }
    let keys = keysOk.value;
    console.log(`Total keys: ${keys ? keys.length : 0}`);
    console.log('Keys type:', typeof keys);
    console.log('Keys value:', keys);

    if (false) {

      if (keys && typeof keys === 'object') {
        // If keys is an object, convert to array
        const keyArray = Object.keys(keys);
        console.log('Converted to array:', keyArray);
        keyArray.forEach((key, index) => {
          console.log(`${index + 1}. ${key}`);
        });
      } else if (Array.isArray(keys)) {
        keys.forEach((key, index) => {
          console.log(`${index + 1}. ${key}`);
        });
      } else {
        console.log('Keys is not an array or object');
      }
    }
    if (false) {
      // Look for strategic profile keys
      console.log('\n2. STRATEGIC PROFILE KEYS:');
      const strategicKeys = keys.filter(key => key.includes('strategic_profile'));
      console.log(`Strategic profile keys: ${strategicKeys.length}`);
      strategicKeys.forEach(key => console.log(`  - ${key}`));
    }
    // Look for user keys
    console.log('\n3. USER KEYS:');
    const userKeys = keys.filter(key => key.includes('user_'));
    console.log(`User keys: ${userKeys.length}`);
    for (let k of userKeys) {
      const user = await db.get(k);
      console.log(`  - ${k} :`, user);
    }
    // userKeys.forEach(key => console.log(`  - ${key}`));
    console.log(`company counter`, await db.get('counter:company'))
    // Investigate specific strategic profiles
    console.log('\n4. STRATEGIC PROFILE DETAILS:');
    if (false) {
      for (const key of strategicKeys) {
        try {
          const profile = await db.get(key);
          const parsedProfile = typeof profile === 'string' ? JSON.parse(profile) : profile;
          console.log(`\n--- ${key} ---`);
          console.log(`Name: ${parsedProfile.name || 'N/A'}`);
          console.log(`Business Type: ${parsedProfile.businessType || 'N/A'}`);
          console.log(`Product/Service: ${parsedProfile.productService || 'N/A'}`);
          console.log(`Status: ${parsedProfile.status || 'N/A'}`);
          console.log(`Created: ${parsedProfile.createdAt || 'N/A'}`);

          // Check strategic conversation fields
          const strategicFields = [
            'productAnalysisSummary',
            'strategyHighLevelBoundary',
            'exampleSprintPlanningPrompt',
            'dailySearchQueries',
            'reportSalesContextGuidance',
            'reportSalesTargetingGuidance'
          ];

          console.log('\nStrategic Fields Status:');
          strategicFields.forEach(field => {
            const hasData = parsedProfile[field] && parsedProfile[field].trim() !== '';
            console.log(`  ${field}: ${hasData ? '✓ Present' : '✗ Missing'}`);
            if (hasData && parsedProfile[field].length > 100) {
              console.log(`    Preview: ${parsedProfile[field].substring(0, 100)}...`);
            } else if (hasData) {
              console.log(`    Content: ${parsedProfile[field]}`);
            }
          });

          // Calculate completion status
          const completedFields = strategicFields.filter(field =>
            parsedProfile[field] && parsedProfile[field].trim() !== ''
          );
          const completionPercentage = (completedFields.length / strategicFields.length) * 100;
          console.log(`\nCompletion: ${completedFields.length}/${strategicFields.length} (${completionPercentage.toFixed(1)}%)`);

        } catch (error) {
          console.log(`Error parsing ${key}:`, error.message);
        }
      }

      // Check user strategic profiles lists
      console.log('\n5. USER STRATEGIC PROFILES LISTS:');
      for (const key of userKeys) {
        if (key.includes('strategic_profiles')) {
          try {
            const profilesList = await db.get(key);
            const parsedList = typeof profilesList === 'string' ? JSON.parse(profilesList) : profilesList;
            console.log(`\n--- ${key} ---`);
            console.log(`Profile IDs: ${JSON.stringify(parsedList)}`);
            console.log(`Count: ${Array.isArray(parsedList) ? parsedList.length : 'Not an array'}`);
          } catch (error) {
            console.log(`Error parsing ${key}:`, error.message);
          }
        }
      }

      // Look for any key containing 'product'
      console.log('\n6. PRODUCT-RELATED KEYS:');
      const productKeys = keys.filter(key => key.toLowerCase().includes('product'));
      productKeys.forEach(key => console.log(`  - ${key}`));

      // Check raw database responses
      console.log('\n7. RAW DATABASE RESPONSES (first 3 strategic profiles):');
      const firstThreeStrategic = strategicKeys.slice(0, 3);
      for (const key of firstThreeStrategic) {
        try {
          const rawResponse = await db.get(key);
          console.log(`\n--- RAW ${key} ---`);
          console.log(`Type: ${typeof rawResponse}`);
          console.log(`Structure: ${JSON.stringify(rawResponse, null, 2)}`);
        } catch (error) {
          console.log(`Error getting raw ${key}:`, error.message);
        }
      }
    }

  } catch (error) {
    console.error('Database investigation failed:', error);
  }
}

investigateDatabase().then(() => {
  console.log('\n🎯 Investigation complete!');
  process.exit(0);
}).catch(error => {
  console.error('Investigation error:', error);
  process.exit(1);
});