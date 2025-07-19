#!/bin/bash
# direct-switch.sh - Directly switch to Replit DB storage without migration

echo "Directly switching to Replit DB storage..."

# Update index.ts to use our direct storage switch
sed -i 's/import { storage } from ".\/storage";/import { storage } from ".\/direct-storage-switch";/g' ./server/index.ts

echo "✅ Switched to Replit DB with minimal setup!"
echo "The app is now using Replit DB for all storage."
echo "Note: This is a fresh database with no migrated data."
echo 
echo "To switch back to PostgreSQL, run:"
echo "sed -i 's/import { storage } from \".\/direct-storage-switch\";/import { storage } from \".\/storage\";/g' ./server/index.ts"
echo
echo "Please restart your server to apply the changes."