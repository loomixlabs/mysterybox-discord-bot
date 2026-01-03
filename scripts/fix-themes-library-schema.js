/**
 * Migration: Ajouter les colonnes manquantes à themes_library
 */
const db = require('../utils/database-pg');

async function main() {
  try {
    console.log('🔧 Mise à jour du schéma themes_library...\n');

    const alterations = [
      { sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS theme_id VARCHAR(100)", col: 'theme_id' },
      { sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS theme_data JSONB", col: 'theme_data' },
      { sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0.0'", col: 'version' },
      { sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS creator_discord_id VARCHAR(30)", col: 'creator_discord_id' },
      { sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS creator_username VARCHAR(100)", col: 'creator_username' },
      { sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE", col: 'is_featured' },
      { sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private'", col: 'visibility' },
      { sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS published_at TIMESTAMP", col: 'published_at' }
    ];

    for (const { sql, col } of alterations) {
      try {
        await db.query(sql);
        console.log(`  ✅ Colonne ${col} ajoutée`);
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`  ℹ️  Colonne ${col} existe déjà`);
        } else {
          console.log(`  ⚠️  ${col}: ${e.message}`);
        }
      }
    }

    console.log('\n📝 Mise à jour des données...');

    // Mettre à jour theme_id depuis id si null
    await db.query("UPDATE themes_library SET theme_id = id::text WHERE theme_id IS NULL");
    console.log('  ✅ theme_id mis à jour depuis id');

    // Mettre à jour visibility depuis is_public
    await db.query("UPDATE themes_library SET visibility = CASE WHEN is_public = TRUE THEN 'public' ELSE 'private' END WHERE visibility IS NULL");
    console.log('  ✅ visibility mis à jour depuis is_public');

    // Mettre à jour is_featured depuis is_official
    await db.query("UPDATE themes_library SET is_featured = COALESCE(is_official, FALSE) WHERE is_featured IS NULL");
    console.log('  ✅ is_featured mis à jour depuis is_official');

    // Mettre à jour creator depuis author
    await db.query("UPDATE themes_library SET creator_discord_id = author_id WHERE creator_discord_id IS NULL");
    await db.query("UPDATE themes_library SET creator_username = author_username WHERE creator_username IS NULL");
    console.log('  ✅ creator_* mis à jour depuis author_*');

    console.log('\n✅ Schéma themes_library mis à jour!');

    // Vérifier
    const cols = await db.queryAll("SELECT column_name FROM information_schema.columns WHERE table_name = 'themes_library' ORDER BY ordinal_position");
    console.log('\n📋 Colonnes:', cols.map(c => c.column_name).join(', '));

    process.exit(0);
  } catch (e) {
    console.error('❌ Erreur:', e);
    process.exit(1);
  }
}

main();
