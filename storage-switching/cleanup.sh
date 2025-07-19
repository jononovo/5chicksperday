#!/bin/bash
# cleanup.sh - Remove all storage switching files and revert to PostgreSQL
# Run this script to clean up all files related to the Replit DB migration

echo "===== Storage Switching Cleanup ====="
echo ""
echo "This script will remove all storage switching files and revert to PostgreSQL."
echo "Any data in Replit DB will remain but will not be used by the application."
echo ""
echo "Press ENTER to continue or CTRL+C to cancel..."
read

# 1. Make sure we're using PostgreSQL
if grep -q "const USE_REPLIT_DB = true" ./storage-switching/storage-switcher.ts; then
  echo "Switching back to PostgreSQL before cleanup..."
  sed -i 's/const USE_REPLIT_DB = true;/const USE_REPLIT_DB = false;/g' ./storage-switching/storage-switcher.ts
fi

# 2. Restore original imports in server files
echo "Restoring original imports..."
sed -i 's/import { storage } from ".\/storage-switching\/storage-switcher";/import { storage } from ".\/storage\/database";/g' server/index.ts

# 3. Remove storage switching directory
echo "Removing storage switching directory..."
rm -rf ./storage-switching

# 4. Remove root scripts
echo "Removing root scripts..."
if [ -f ./migrate-to-replit-db.sh ]; then
  rm ./migrate-to-replit-db.sh
fi

if [ -f ./toggle-storage.sh ]; then
  rm ./toggle-storage.sh
fi

echo ""
echo "Cleanup completed successfully!"
echo "The application is now using PostgreSQL exclusively."
echo "Restart the application for changes to take effect."
echo ""