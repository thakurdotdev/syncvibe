#!/usr/bin/env node
/**
 * Migration Script: Consolidate songs into central Song table
 *
 * This script:
 * 1. Creates the songs table if not exists
 * 2. Extracts unique songs from history_songs and playlist_songs
 * 3. Populates the new songs table
 * 4. Updates songRefId in history_songs and playlist_songs
 *
 * Run: node server/scripts/migrateSongs.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sequelize = require('../utils/sequelize');
const Song = require('../models/music/Song');
const HistorySong = require('../models/music/HistorySong');
const PlaylistSong = require('../models/music/playlistSong');

// Initialize associations
require('../models/music/index');

const BATCH_SIZE = 100;

async function migrate() {
  console.log('🚀 Starting song migration...\n');

  try {
    // Step 1: Sync Song model (create table if not exists)
    console.log('📦 Step 1: Creating songs table...');
    await Song.sync({ alter: true });
    console.log('✅ Songs table ready\n');

    // Step 2: Sync updated HistorySong and PlaylistSong models
    console.log('📦 Step 2: Updating history_songs and playlist_songs tables...');
    await HistorySong.sync({ alter: true });
    await PlaylistSong.sync({ alter: true });
    console.log('✅ Tables updated with songRefId column\n');

    // Step 3: Get counts
    const historyCount = await HistorySong.count({ where: { songRefId: null } });
    const playlistCount = await PlaylistSong.count({ where: { songRefId: null } });
    console.log(
      `📊 Found ${historyCount} history songs and ${playlistCount} playlist songs to migrate\n`
    );

    if (historyCount === 0 && playlistCount === 0) {
      console.log('✅ All songs already migrated! Nothing to do.\n');
      return;
    }

    // Step 4: Migrate history songs
    console.log('🔄 Step 3: Migrating history songs...');
    let migratedHistory = 0;
    let offset = 0;

    while (true) {
      const historySongs = await HistorySong.findAll({
        where: { songRefId: null },
        limit: BATCH_SIZE,
        offset: 0, // Always 0 since we update records
        raw: true,
      });

      if (historySongs.length === 0) break;

      for (const hs of historySongs) {
        try {
          const songData = typeof hs.songData === 'string' ? JSON.parse(hs.songData) : hs.songData;

          if (!songData?.id) {
            console.warn(`  ⚠️ Skipping history song ${hs.id}: no songData.id`);
            continue;
          }

          const song = await Song.getOrCreate(songData);

          await HistorySong.update({ songRefId: song.id }, { where: { id: hs.id } });

          migratedHistory++;
        } catch (err) {
          console.error(`  ❌ Error migrating history song ${hs.id}:`, err.message);
        }
      }

      console.log(`  📝 Migrated ${migratedHistory} history songs...`);
    }
    console.log(`✅ Migrated ${migratedHistory} history songs\n`);

    // Step 5: Migrate playlist songs
    console.log('🔄 Step 4: Migrating playlist songs...');
    let migratedPlaylist = 0;

    while (true) {
      const playlistSongs = await PlaylistSong.findAll({
        where: { songRefId: null },
        limit: BATCH_SIZE,
        offset: 0,
        raw: true,
      });

      if (playlistSongs.length === 0) break;

      for (const ps of playlistSongs) {
        try {
          const songData = typeof ps.songData === 'string' ? JSON.parse(ps.songData) : ps.songData;

          if (!songData?.id) {
            console.warn(`  ⚠️ Skipping playlist song ${ps.id}: no songData.id`);
            continue;
          }

          const song = await Song.getOrCreate(songData);

          await PlaylistSong.update({ songRefId: song.id }, { where: { id: ps.id } });

          migratedPlaylist++;
        } catch (err) {
          console.error(`  ❌ Error migrating playlist song ${ps.id}:`, err.message);
        }
      }

      console.log(`  📝 Migrated ${migratedPlaylist} playlist songs...`);
    }
    console.log(`✅ Migrated ${migratedPlaylist} playlist songs\n`);

    // Step 6: Verify
    console.log('🔍 Step 5: Verifying migration...');
    const totalSongs = await Song.count();
    const remainingHistory = await HistorySong.count({ where: { songRefId: null } });
    const remainingPlaylist = await PlaylistSong.count({ where: { songRefId: null } });

    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total unique songs in central table: ${totalSongs}`);
    console.log(`   History songs migrated: ${migratedHistory}`);
    console.log(`   Playlist songs migrated: ${migratedPlaylist}`);
    console.log(`   Remaining unmigrated history songs: ${remainingHistory}`);
    console.log(`   Remaining unmigrated playlist songs: ${remainingPlaylist}`);

    if (remainingHistory === 0 && remainingPlaylist === 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️ Some songs could not be migrated. Check logs above.');
    }

    // Step 6: Create performance indexes
    console.log('\n📊 Step 6: Creating performance indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_history_songs_user_last_played ON history_songs ("userId", "lastPlayedAt" DESC)',
      'CREATE INDEX IF NOT EXISTS idx_history_songs_user_ai_score ON history_songs ("userId", "aiRecommendationScore" DESC NULLS LAST)',
      'CREATE INDEX IF NOT EXISTS idx_history_songs_user_like ON history_songs ("userId", "likeStatus")',
      'CREATE INDEX IF NOT EXISTS idx_history_songs_user_played_count ON history_songs ("userId", "playedCount")',
      'CREATE INDEX IF NOT EXISTS idx_history_songs_song_ref ON history_songs ("songRefId")',
      'CREATE INDEX IF NOT EXISTS idx_songs_name ON songs (name)',
      'CREATE INDEX IF NOT EXISTS idx_songs_artist_names ON songs ("artistNames")',
      'CREATE INDEX IF NOT EXISTS idx_songs_language ON songs (language)',
      'CREATE INDEX IF NOT EXISTS idx_playlist_songs_song_ref ON playlist_songs ("songRefId")',
    ];

    for (const sql of indexes) {
      try {
        await sequelize.query(sql);
        console.log('   ✅ Created: ' + sql.match(/idx_\w+/)?.[0]);
      } catch (e) {
        console.log('   ⚠️ Skipped (exists): ' + sql.match(/idx_\w+/)?.[0]);
      }
    }
    console.log('✅ Indexes created!\n');
    console.log('🎉 All done! Your database is optimized.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run migration
migrate();
