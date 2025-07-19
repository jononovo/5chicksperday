#!/bin/bash
# migrate-to-replit-db.sh - One-step migration from PostgreSQL to Replit DB

echo "===== PostgreSQL to Replit Database Migration ====="
echo ""
echo "This script will migrate all data from PostgreSQL to Replit Database."
echo "The application will continue to work with both storage systems,"
echo "but all new data will be stored in Replit Database after the migration."
echo ""
echo "Press ENTER to continue or CTRL+C to cancel..."
read

# 1. Verify dependencies
echo "Checking dependencies..."
if ! npm list @replit/database | grep -q "@replit/database"; then
  echo "Installing @replit/database..."
  npm install @replit/database
fi

# 2. Run migration
echo "Starting data migration..."
npx tsx ./storage-switching/migrate.ts

# If migration failed, exit
if [ $? -ne 0 ]; then
  echo "Migration failed! See error messages above."
  exit 1
fi

# 3. Run verification
echo "Verifying migration..."
npx tsx ./storage-switching/verify.ts

# If verification failed, exit
if [ $? -ne 0 ]; then
  echo "Verification failed! See error messages above."
  exit 1
fi

# 4. Switch to Replit DB storage
echo "Migration complete! Creating storage reference in server..."

# Update server/index.ts to use the storage switcher
if ! grep -q "import { storage } from \"./storage-switching/storage-switcher\";" server/index.ts; then
  # Replace storage import with storage switcher import
  sed -i 's/import { storage } from ".\/storage\/database";/import { storage } from ".\/storage-switching\/storage-switcher";/g' server/index.ts
  sed -i 's/import { storage } from ".\/storage";/import { storage } from ".\/storage-switching\/storage-switcher";/g' server/index.ts
fi

echo ""
echo "Migration completed successfully!"
echo "The application is still using PostgreSQL for storage."
echo "To switch to Replit Database, run: bash ./storage-switching/toggle-storage.sh"
echo ""
echo "Restarting the application..."
echo ""