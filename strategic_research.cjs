const Database = require("@replit/database");
const db = new Database();

async function deepTechnicalResearch() {
  console.log("=== STRATEGIC DOCUMENT PERSISTENCE RESEARCH ===");
  
  // Target users to investigate
  const targetUsers = [
    { email: "jon@codetribe.com", expectedUserId: 427 },
    { email: "9009@test.com", expectedUserId: 439 },
    { email: "9010@test.com", expectedUserId: null } // This user might not exist yet
  ];
  
  console.log("1. VERIFYING USER RECORDS AND MAPPINGS...");
  
  for (const user of targetUsers) {
    console.log(`\n--- Investigating ${user.email} ---`);
    
    // Check if user exists in database
    let userId = user.expectedUserId;
    if (!userId) {
      // Try to find user by email index
      try {
        const indexResult = await db.get(`index:user:email:${user.email}`);
        if (indexResult?.value) {
          userId = indexResult.value;
        }
      } catch (err) {
        console.log(`  ❌ No user found for ${user.email}`);
        continue;
      }
    }
    
    if (!userId) {
      console.log(`  ❌ No user ID found for ${user.email}`);
      continue;
    }
    
    // Check user record
    try {
      const userRecord = await db.get(`user:${userId}`);
      if (userRecord?.value) {
        console.log(`  ✅ User ${userId}: ${userRecord.value.email} (${userRecord.value.username})`);
        console.log(`     Created: ${userRecord.value.createdAt}`);
      } else {
        console.log(`  ❌ User ${userId}: No database record found`);
        continue;
      }
    } catch (err) {
      console.log(`  ❌ User ${userId}: Error checking record - ${err.message}`);
      continue;
    }
    
    // Check Firebase UID mapping
    try {
      const firebaseKeys = await db.list("firebase_uid:");
      let firebaseMapping = null;
      
      for (const key of firebaseKeys) {
        const mappedUserId = await db.get(key);
        if (mappedUserId?.value === userId) {
          const uid = key.replace("firebase_uid:", "");
          firebaseMapping = uid;
          break;
        }
      }
      
      if (firebaseMapping) {
        console.log(`  ✅ Firebase UID: ${firebaseMapping.substring(0, 8)}...`);
      } else {
        console.log(`  ⚠️  No Firebase UID mapping found`);
      }
    } catch (err) {
      console.log(`  ❌ Error checking Firebase mapping: ${err.message}`);
    }
    
    // Check strategic profiles - try multiple storage formats
    console.log(`\n  📊 STRATEGIC PROFILES FOR USER ${userId}:`);
    
    // Try different possible storage keys
    const possibleKeys = [
      `strategic_profiles:${userId}`,
      `strategic_profiles:user:${userId}`,
      `profiles:user:${userId}`,
      `user:${userId}:strategic_profiles`,
      `products:user:${userId}`,
      `products:${userId}`
    ];
    
    let foundProfiles = false;
    
    for (const key of possibleKeys) {
      try {
        const profilesData = await db.get(key);
        
        if (profilesData?.value) {
          console.log(`  ✅ Found profiles under key: ${key}`);
          foundProfiles = true;
          
          let profiles;
          if (typeof profilesData.value === 'string') {
            profiles = JSON.parse(profilesData.value);
          } else if (Array.isArray(profilesData.value)) {
            profiles = profilesData.value;
          } else {
            console.log(`  ❌ Invalid profiles data format: ${typeof profilesData.value}`);
            continue;
          }
          
          console.log(`  Found ${profiles.length} strategic profiles:`);
          
          // Sort by creation date (newest first)
          profiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          for (let i = 0; i < profiles.length; i++) {
            const profile = profiles[i];
            console.log(`  \n  Profile ${i + 1} (ID: ${profile.id}) - ${profile.name || 'Unnamed'}`);
            console.log(`    Business Type: ${profile.businessType}`);
            console.log(`    Created: ${profile.createdAt}`);
            console.log(`    Status: ${profile.status}`);
            
            // Check for strategic conversation data
            const strategicFields = [
              'productAnalysisSummary',
              'strategyHighLevelBoundary', 
              'exampleSprintPlanningPrompt',
              'dailySearchQueries',
              'reportSalesContextGuidance',
              'reportSalesTargetingGuidance'
            ];
            
            let completedFields = 0;
            console.log(`    Strategic Conversation Data:`);
            
            for (const field of strategicFields) {
              const hasData = profile[field] && profile[field].trim().length > 0;
              if (hasData) {
                completedFields++;
                const preview = profile[field].substring(0, 50) + '...';
                console.log(`      ✅ ${field}: ${preview}`);
              } else {
                console.log(`      ❌ ${field}: Missing or empty`);
              }
            }
            
            const completionPercentage = Math.round((completedFields / strategicFields.length) * 100);
            console.log(`    Completion: ${completedFields}/${strategicFields.length} fields (${completionPercentage}%)`);
            
            // Check if this matches the expected "complete" status
            const shouldBeComplete = completedFields === strategicFields.length;
            const statusMatch = shouldBeComplete ? 'complete' : 'in_progress';
            console.log(`    Expected Status: ${statusMatch}`);
            
            if (profile.status !== statusMatch) {
              console.log(`    ⚠️  Status mismatch! Database shows '${profile.status}' but should be '${statusMatch}'`);
            }
          }
          
          // Highlight the most recent profile
          if (profiles.length > 0) {
            const mostRecent = profiles[0];
            console.log(`\n  🎯 MOST RECENT PROFILE: ${mostRecent.name} (ID: ${mostRecent.id})`);
            console.log(`     This should be receiving new strategic conversation data.`);
          }
          
          break; // Exit loop once we find data
        }
      } catch (err) {
        console.log(`  ❌ Error checking key ${key}: ${err.message}`);
      }
    }
    
    if (!foundProfiles) {
      console.log(`  ❌ No strategic profiles found for user ${userId} under any key format`);
      
      // List all keys that might contain this user's data
      console.log(`  🔍 Searching for any keys containing user ${userId}...`);
      try {
        const allKeys = await db.list("");
        const userKeys = allKeys.filter(key => key.includes(userId.toString()));
        
        if (userKeys.length > 0) {
          console.log(`  Found ${userKeys.length} keys containing user ${userId}:`);
          for (const key of userKeys.slice(0, 10)) { // Show first 10 keys
            const value = await db.get(key);
            console.log(`    - ${key}: ${typeof value?.value} ${Array.isArray(value?.value) ? `(${value.value.length} items)` : ''}`);
          }
        } else {
          console.log(`  No keys found containing user ${userId}`);
        }
      } catch (err) {
        console.log(`  ❌ Error searching for user keys: ${err.message}`);
      }
    }
  }
  
  console.log("\n=== RESEARCH SUMMARY ===");
  console.log("Key Questions Answered:");
  console.log("1. Are strategic documents being saved to the correct profiles?");
  console.log("2. Are the most recent profiles receiving new strategic data?");
  console.log("3. Is the completion status calculation working correctly?");
  console.log("4. Are Firebase authentication and database user records properly synchronized?");
  
  console.log("\n=== FIREBASE vs DATABASE USER ID ANALYSIS ===");
  console.log("Firebase authentication provides:");
  console.log("- User email and display name");
  console.log("- Authentication state and token validation");
  console.log("- Cross-session persistence");
  
  console.log("\nDatabase user ID provides:");
  console.log("- Unique numeric identifier for data relationships");
  console.log("- User-specific data isolation (profiles, companies, contacts)");
  console.log("- Consistent data structure across all storage operations");
  
  console.log("\nConclusion: Both are needed for complete system functionality.");
  console.log("Firebase handles authentication, database ID handles data relationships.");
}

deepTechnicalResearch().catch(console.error);