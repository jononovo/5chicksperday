#!/bin/bash
# toggle-storage.sh - Toggle between PostgreSQL and Replit DB storage

# Check current setting
CURRENT_SETTING=$(grep "const USE_REPLIT_DB = " ./storage-switching/storage-switcher.ts | awk '{print $4}' | tr -d ';')

if [ "$CURRENT_SETTING" == "true" ]; then
  # Currently using Replit DB, switch to PostgreSQL
  echo "Switching to PostgreSQL storage..."
  sed -i 's/const USE_REPLIT_DB = true;/const USE_REPLIT_DB = false;/g' ./storage-switching/storage-switcher.ts
  NEW_STORAGE="PostgreSQL"
else
  # Currently using PostgreSQL, switch to Replit DB
  echo "Switching to Replit Database storage..."
  sed -i 's/const USE_REPLIT_DB = false;/const USE_REPLIT_DB = true;/g' ./storage-switching/storage-switcher.ts
  NEW_STORAGE="Replit Database"
fi

echo "Storage switched to $NEW_STORAGE"
echo "Restart the application for changes to take effect."