# Song Migration Script

Migrates existing songs to the central `songs` table and creates performance indexes.

## What it does

1. Creates the `songs` table
2. Adds `songRefId` column to `history_songs` and `playlist_songs`
3. Extracts unique songs and populates central table
4. Links existing records via `songRefId`
5. Creates performance indexes

## Production Usage

### Option 1: Using Production DATABASE_URL

```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"

# Run migration
cd server
node scripts/migrateSongs.js
```

### Option 2: Using .env file

1. Backup your `.env` file
2. Temporarily update `DATABASE_URL` in `server/.env` to point to production
3. Run migration:
   ```bash
   cd server
   node scripts/migrateSongs.js
   ```
4. Restore original `.env`

### Option 3: Directly edit the script

Edit `migrateSongs.js` line 15 to hardcode the production connection:

```javascript
require('dotenv').config({ path: path.join(__dirname, '..', '.env.production') });
```

## Safety Notes

- ✅ **Safe to run multiple times** - Uses `findOrCreate` and `IF NOT EXISTS`
- ✅ **Non-destructive** - Adds new columns/tables, doesn't delete anything
- ✅ **Idempotent** - Already-migrated records are skipped
- ⚠️ **Backup first** - Always backup production database before migration

## Expected Output

```
🚀 Starting song migration...
📦 Step 1: Creating songs table...
✅ Songs table ready
📦 Step 2: Updating history_songs and playlist_songs tables...
✅ Tables updated with songRefId column
📊 Found X history songs and Y playlist songs to migrate
🔄 Step 3: Migrating history songs...
  📝 Migrated 100 history songs...
  📝 Migrated 200 history songs...
✅ Migrated X history songs
🔄 Step 4: Migrating playlist songs...
✅ Migrated Y playlist songs
🔍 Step 5: Verifying migration...
📊 Migration Summary:
   Total unique songs in central table: Z
   History songs migrated: X
   Playlist songs migrated: Y
✅ Migration completed successfully!
📊 Step 6: Creating performance indexes...
   ✅ Created: idx_history_songs_user_last_played
   ✅ Created: idx_songs_name
   ...
🎉 All done! Your database is optimized.
```
