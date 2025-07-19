const Database = require("@replit/database");

async function debugDatabaseAccess() {
  console.log("=== DATABASE ACCESS DEBUG ===");
  
  const db = new Database();
  
  // Test basic database connectivity
  console.log("\n1. TESTING DATABASE CONNECTIVITY:");
  
  try {
    // Test setting and getting a simple value
    await db.set("test_key", "test_value");
    const testValue = await db.get("test_key");
    console.log(`✅ Basic DB access works: ${testValue}`);
    
    // Clean up
    await db.delete("test_key");
  } catch (err) {
    console.log(`❌ Basic DB access failed: ${err.message}`);
    return;
  }
  
  // Test the exact same calls the server makes
  console.log("\n2. TESTING USER 440 ACCESS (mirroring server calls):");
  
  const userId = 440;
  
  // Check user record (server logs show this works)
  try {
    console.log(`Checking key: user:${userId}`);
    const userResult = await db.get(`user:${userId}`);
    console.log(`Raw result for user:${userId}:`, userResult);
    
    if (userResult) {
      console.log(`✅ User record exists, type: ${typeof userResult}`);
      if (userResult.value) {
        console.log(`✅ User data: ${userResult.value.email}`);
      }
    } else {
      console.log(`❌ User record not found`);
    }
  } catch (err) {
    console.log(`❌ Error checking user record: ${err.message}`);
  }
  
  // Check credits (server logs show this works)
  try {
    console.log(`Checking key: user_credits:${userId}`);
    const creditsResult = await db.get(`user_credits:${userId}`);
    console.log(`Raw result for user_credits:${userId}:`, creditsResult);
    
    if (creditsResult) {
      console.log(`✅ Credits record exists, type: ${typeof creditsResult}`);
      if (creditsResult.value) {
        const credits = JSON.parse(creditsResult.value);
        console.log(`✅ Credits balance: ${credits.currentBalance}`);
      }
    } else {
      console.log(`❌ Credits record not found`);
    }
  } catch (err) {
    console.log(`❌ Error checking credits: ${err.message}`);
  }
  
  // Check strategic profiles (server logs show this works)
  try {
    console.log(`Checking key: strategicProfiles:user:${userId}`);
    const profilesResult = await db.get(`strategicProfiles:user:${userId}`);
    console.log(`Raw result for strategicProfiles:user:${userId}:`, profilesResult);
    
    if (profilesResult) {
      console.log(`✅ Profiles record exists, type: ${typeof profilesResult}`);
      if (profilesResult.value) {
        const profileIds = JSON.parse(profilesResult.value);
        console.log(`✅ Profile IDs: ${profileIds.join(', ')}`);
      }
    } else {
      console.log(`❌ Profiles record not found`);
    }
  } catch (err) {
    console.log(`❌ Error checking profiles: ${err.message}`);
  }
  
  // Test database listing capability
  console.log("\n3. TESTING DATABASE LISTING:");
  
  try {
    console.log("Attempting to list keys with prefix 'user:'");
    const userKeys = await db.list("user:");
    console.log(`Found ${userKeys ? userKeys.length : 0} user keys`);
    
    if (userKeys && userKeys.length > 0) {
      console.log("Sample user keys:", userKeys.slice(0, 5));
    }
  } catch (err) {
    console.log(`❌ Error listing user keys: ${err.message}`);
  }
  
  // Test Firebase UID mapping
  console.log("\n4. TESTING FIREBASE UID MAPPING:");
  
  try {
    console.log("Attempting to list Firebase UID keys");
    const firebaseKeys = await db.list("firebase_uid:");
    console.log(`Found ${firebaseKeys ? firebaseKeys.length : 0} Firebase UID keys`);
    
    if (firebaseKeys && firebaseKeys.length > 0) {
      console.log("Sample Firebase keys:", firebaseKeys.slice(0, 3));
      
      // Check if user 440 has a mapping
      for (const key of firebaseKeys) {
        try {
          const mappedUserId = await db.get(key);
          if (mappedUserId && mappedUserId.value === userId) {
            console.log(`✅ Found Firebase mapping for user ${userId}: ${key}`);
            break;
          }
        } catch (err) {
          console.log(`Error checking Firebase key ${key}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.log(`❌ Error listing Firebase keys: ${err.message}`);
  }
  
  console.log("\n=== COMPARISON WITH SERVER LOGS ===");
  console.log("Server logs show user 440 is working properly:");
  console.log("- User lookup: found: true, userId: 440");
  console.log("- Credits: currentBalance: 180");
  console.log("- Products API: returns data");
  console.log("- Firebase auth: working");
  
  console.log("\nThis debug will help identify if there's:");
  console.log("1. A permission issue with direct database access");
  console.log("2. A difference in database connection methods");
  console.log("3. A timing issue with database writes");
  console.log("4. A different database environment/namespace");
}

debugDatabaseAccess().catch(console.error);