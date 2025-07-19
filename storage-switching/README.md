# Storage Switching Utility

This folder contains utilities to migrate from PostgreSQL to Replit Database.

## Files

- `simplified-storage-replit.ts` - Implementation of Replit DB storage adapter
- `storage-switcher.ts` - Switch between PostgreSQL and Replit DB
- `migrate.ts` - Data migration script
- `verify.ts` - Migration verification script
- `migrate-to-replit-db.sh` - One-step migration utility
- `toggle-storage.sh` - Toggle between storage backends
- `direct-switch.sh` - Directly switch to Replit DB (recommended)
- `cleanup.sh` - Remove all storage switching files

## How to Use

### Option 1: Direct Switch (Recommended)

For a fresh start with Replit DB without data migration:

```bash
bash storage-switching/direct-switch.sh
```

This will:
- Switch the app to use Replit Database immediately
- Create a default user on first startup
- Start with a clean database

This is the simplest and most reliable approach.

### Option 2: Full Migration Process

If you need to migrate existing data (may be unreliable for large datasets):

1. **Migrate data**:
   ```
   bash storage-switching/migrate-to-replit-db.sh
   ```

2. **Switch storage backend**:
   ```
   bash storage-switching/toggle-storage.sh
   ```

### Cleanup

When you're done:

```bash
bash storage-switching/cleanup.sh
```

## Switching Back to PostgreSQL

For direct switch method:
```bash
sed -i 's/import { storage } from ".\/direct-storage-switch";/import { storage } from ".\/storage";/g' ./server/index.ts
```

For toggle method:
```bash
bash storage-switching/toggle-storage.sh
```

## Key Structure in Replit DB

- Primary records: `{entityType}:{id}` (e.g., `user:42`)
- Indexes: `index:{indexType}:{value}` (e.g., `index:user:email:user@example.com`)
- Relationships: `{entityType}:{id}:{relatedType}` (e.g., `companies:list:5`)
- Counters: `counter:{entityType}` (e.g., `counter:user`)