import Database from '@replit/database';
const db = new Database();

async function deleteUsers() {
  const emails = ['ale@codetribe.com', 'jon@codetribe.com', 'jon@5ducks.ai'];
  
  for (const email of emails) {
    try {
      console.log(`\n=== Deleting user: ${email} ===`);
      
      // First, find the user to get their ID - try common IDs
      let foundUserId = null;
      const userData12 = await db.get('user:12');
      const userData16 = await db.get('user:16');
      const userData17 = await db.get('user:17');
      
      const users = [
        { key: 'user:12', data: userData12, id: 12 },
        { key: 'user:16', data: userData16, id: 16 },
        { key: 'user:17', data: userData17, id: 17 }
      ];
      
      for (const user of users) {
        if (user.data && user.data.email === email) {
          foundUserId = user.id;
          console.log(`Found user ${email} with ID: ${foundUserId}`);
          
          // Delete user record
          await db.delete(user.key);
          console.log(`✓ Deleted user record: ${user.key}`);
          break;
        }
      }
      
      if (foundUserId) {
        // Delete credit record
        try {
          await db.delete(`user_credits:${foundUserId}`);
          console.log(`✓ Deleted credit record: user_credits:${foundUserId}`);
        } catch (err) {
          console.log(`- No credit record found: user_credits:${foundUserId}`);
        }
        
        // Delete user preferences
        try {
          await db.delete(`userPrefs:${foundUserId}`);
          console.log(`✓ Deleted preferences: userPrefs:${foundUserId}`);
        } catch (err) {
          console.log(`- No preferences found: userPrefs:${foundUserId}`);
        }
        
        console.log(`✅ Successfully deleted all records for ${email}`);
      } else {
        console.log(`❌ User ${email} not found in database`);
      }
      
    } catch (error) {
      console.error(`❌ Error deleting ${email}:`, error.message);
    }
  }
  
  console.log('\n=== Deletion complete ===');
}

deleteUsers().catch(console.error);