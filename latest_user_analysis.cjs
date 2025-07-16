const Database = require("@replit/database");
const db = new Database();

async function analyzeLatestUser() {
  console.log("=== LATEST USER ANALYSIS (ale@codetribe.com) ===");
  
  const userId = 428;
  const expectedProfileId = 16;
  
  console.log(`\n1. USER RECORD CHECK (${userId}):`);
  
  try {
    const userResult = await db.get(`user:${userId}`);
    if (userResult?.value) {
      console.log(`✅ User ${userId} exists:`);
      console.log(`   Email: ${userResult.value.email}`);
      console.log(`   Username: ${userResult.value.username}`);
      console.log(`   Created: ${userResult.value.createdAt}`);
    } else {
      console.log(`❌ User ${userId} not found in database`);
    }
  } catch (err) {
    console.log(`❌ Error checking user record: ${err.message}`);
  }
  
  console.log(`\n2. CREDITS SYSTEM CHECK:`);
  
  try {
    const creditsResult = await db.get(`user_credits:${userId}`);
    if (creditsResult?.value) {
      const credits = JSON.parse(creditsResult.value);
      console.log(`✅ Credits balance: ${credits.currentBalance}`);
      console.log(`   Total used: ${credits.totalUsed}`);
      console.log(`   Has badges: ${credits.badges ? credits.badges.length : 0} badges`);
    } else {
      console.log(`❌ Credits record not found`);
    }
  } catch (err) {
    console.log(`❌ Error checking credits: ${err.message}`);
  }
  
  console.log(`\n3. STRATEGIC PROFILES CHECK:`);
  
  try {
    const profilesResult = await db.get(`strategicProfiles:user:${userId}`);
    if (profilesResult?.value) {
      let profileIds;
      if (Array.isArray(profilesResult.value)) {
        profileIds = profilesResult.value;
      } else {
        profileIds = JSON.parse(profilesResult.value);
      }
      
      console.log(`✅ Found ${profileIds.length} strategic profile(s): ${profileIds.join(', ')}`);
      
      // Check the expected profile (ID 16)
      for (const profileId of profileIds) {
        try {
          const profile = await db.get(`strategicProfile:${profileId}`);
          if (profile?.value) {
            console.log(`\n   Profile ${profileId} (Expected: ${expectedProfileId}):`);
            console.log(`   Name: ${profile.value.name}`);
            console.log(`   Business Type: ${profile.value.businessType}`);
            console.log(`   Product/Service: ${profile.value.productService}`);
            console.log(`   Website: ${profile.value.website}`);
            console.log(`   Customer Feedback: ${profile.value.customerFeedback}`);
            console.log(`   Created: ${profile.value.createdAt}`);
            console.log(`   Status: ${profile.value.status}`);
            
            // Check strategic conversation data
            console.log(`\n   Strategic Documents Check:`);
            const strategicFields = [
              { key: 'productAnalysisSummary', name: 'Product Analysis Summary' },
              { key: 'strategyHighLevelBoundary', name: 'Strategy High Level Boundary' },
              { key: 'exampleSprintPlanningPrompt', name: 'Example Sprint Planning Prompt' },
              { key: 'dailySearchQueries', name: 'Daily Search Queries' },
              { key: 'reportSalesContextGuidance', name: 'Sales Context Guidance' },
              { key: 'reportSalesTargetingGuidance', name: 'Sales Targeting Guidance' }
            ];
            
            let completedFields = 0;
            for (const field of strategicFields) {
              const hasData = profile.value[field.key] && profile.value[field.key].toString().trim().length > 0;
              if (hasData) {
                completedFields++;
                let preview;
                if (typeof profile.value[field.key] === 'object') {
                  preview = JSON.stringify(profile.value[field.key]).substring(0, 100) + '...';
                } else {
                  preview = profile.value[field.key].toString().substring(0, 100) + '...';
                }
                console.log(`   ✅ ${field.name}: ${preview}`);
              } else {
                console.log(`   ❌ ${field.name}: Missing or empty`);
              }
            }
            
            const completionPercentage = Math.round((completedFields / strategicFields.length) * 100);
            console.log(`\n   Completion Status: ${completedFields}/${strategicFields.length} fields (${completionPercentage}%)`);
            
            const shouldBeComplete = completedFields === strategicFields.length;
            const expectedStatus = shouldBeComplete ? 'completed' : 'in_progress';
            console.log(`   Expected Status: ${expectedStatus}`);
            console.log(`   Actual Status: ${profile.value.status}`);
            
            if (profile.value.status !== expectedStatus) {
              console.log(`   ⚠️  Status mismatch! Database shows '${profile.value.status}' but should be '${expectedStatus}'`);
            }
          }
        } catch (err) {
          console.log(`   ❌ Error retrieving profile ${profileId}: ${err.message}`);
        }
      }
    } else {
      console.log(`❌ No strategic profiles found`);
    }
  } catch (err) {
    console.log(`❌ Error checking strategic profiles: ${err.message}`);
  }
  
  console.log(`\n4. FIREBASE MAPPING CHECK:`);
  
  try {
    const firebaseKeys = await db.list("firebase_uid:");
    if (firebaseKeys && firebaseKeys.length > 0) {
      for (const key of firebaseKeys) {
        try {
          const mappedUserId = await db.get(key);
          if (mappedUserId?.value === userId) {
            const uid = key.replace('firebase_uid:', '');
            console.log(`✅ Firebase mapping found: ${uid.substring(0, 12)}... -> ${userId}`);
            break;
          }
        } catch (err) {
          // Continue checking
        }
      }
    } else {
      console.log(`❌ No Firebase mappings found`);
    }
  } catch (err) {
    console.log(`❌ Error checking Firebase mappings: ${err.message}`);
  }
  
  console.log(`\n=== SUMMARY FOR USER ${userId} (ale@codetribe.com) ===`);
  console.log(`Based on server logs, this user:`);
  console.log(`- Successfully logged in via Google auth`);
  console.log(`- Completed onboarding form: watches, durable, casio.com`);
  console.log(`- Created profile ID 16: "Product 1"`);
  console.log(`- Went through full strategy conversation`);
  console.log(`- Should have complete strategic documents saved`);
}

analyzeLatestUser().catch(console.error);