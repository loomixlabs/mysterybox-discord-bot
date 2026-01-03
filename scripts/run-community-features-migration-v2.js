/**
 * Script pour exécuter la migration des fonctionnalités communautaires
 * Tables: themes_library (nouvelles colonnes), theme_reviews, theme_views
 */
const db = require('../utils/database-pg');

async function runMigration() {
  console.log('🚀 Migration: Fonctionnalités communautaires themes_library\n');
  console.log('='.repeat(80));

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // 1. ADD MISSING COLUMNS TO themes_library
    // ══════════════════════════════════════════════════════════════════════════

    console.log('\n📌 Étape 1: Ajout colonnes themes_library...\n');

    const columnsToAdd = [
      { name: 'share_slug', sql: 'ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS share_slug VARCHAR(50) UNIQUE' },
      { name: 'short_code', sql: 'ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS short_code VARCHAR(10) UNIQUE' },
      { name: 'fork_count', sql: 'ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS fork_count INTEGER DEFAULT 0' },
      { name: 'view_count', sql: 'ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0' },
      { name: 'rating_count', sql: 'ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0' },
      { name: 'weekly_downloads', sql: 'ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS weekly_downloads INTEGER DEFAULT 0' },
      { name: 'last_downloaded_at', sql: 'ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMP' },
      { name: 'embed_color', sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS embed_color VARCHAR(7) DEFAULT '#6366F1'" },
      { name: 'embed_image_url', sql: 'ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS embed_image_url TEXT' },
      { name: 'thumbnail_url', sql: 'ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS thumbnail_url TEXT' },
      { name: 'banner_url', sql: 'ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS banner_url TEXT' },
      { name: 'tags', sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'" },
      { name: 'category', sql: 'ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS category VARCHAR(50)' },
      { name: 'difficulty', sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'medium'" },
      { name: 'icon', sql: "ALTER TABLE themes_library ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '🎨'" }
    ];

    for (const col of columnsToAdd) {
      try {
        await db.query(col.sql);
        console.log(`  ✅ Colonne ${col.name} ajoutée`);
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('existe déjà')) {
          console.log(`  ⏭️  Colonne ${col.name} existe déjà`);
        } else {
          console.log(`  ❌ Erreur ${col.name}: ${e.message}`);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 2. CREATE theme_reviews TABLE
    // ══════════════════════════════════════════════════════════════════════════

    console.log('\n📌 Étape 2: Création table theme_reviews...\n');

    await db.query(`
      CREATE TABLE IF NOT EXISTS theme_reviews (
        id SERIAL PRIMARY KEY,
        theme_id INTEGER NOT NULL REFERENCES themes_library(id) ON DELETE CASCADE,
        reviewer_discord_id VARCHAR(50) NOT NULL,
        reviewer_username VARCHAR(100) NOT NULL,
        reviewer_avatar VARCHAR(255),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_text TEXT,
        is_helpful_count INTEGER DEFAULT 0,
        is_reported BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(theme_id, reviewer_discord_id)
      )
    `);
    console.log('  ✅ Table theme_reviews créée/vérifiée');

    // ══════════════════════════════════════════════════════════════════════════
    // 3. CREATE theme_views TABLE
    // ══════════════════════════════════════════════════════════════════════════

    console.log('\n📌 Étape 3: Création table theme_views...\n');

    await db.query(`
      CREATE TABLE IF NOT EXISTS theme_views (
        id SERIAL PRIMARY KEY,
        theme_id INTEGER NOT NULL REFERENCES themes_library(id) ON DELETE CASCADE,
        viewer_discord_id VARCHAR(50),
        viewer_ip VARCHAR(45),
        viewed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✅ Table theme_views créée/vérifiée');

    // ══════════════════════════════════════════════════════════════════════════
    // 4. CREATE INDEXES
    // ══════════════════════════════════════════════════════════════════════════

    console.log('\n📌 Étape 4: Création des index...\n');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_theme_reviews_theme_id ON theme_reviews(theme_id)',
      'CREATE INDEX IF NOT EXISTS idx_theme_reviews_rating ON theme_reviews(rating)',
      'CREATE INDEX IF NOT EXISTS idx_theme_views_theme_id ON theme_views(theme_id)',
      'CREATE INDEX IF NOT EXISTS idx_theme_views_viewed_at ON theme_views(viewed_at)',
      'CREATE INDEX IF NOT EXISTS idx_themes_library_share_slug ON themes_library(share_slug)',
      'CREATE INDEX IF NOT EXISTS idx_themes_library_short_code ON themes_library(short_code)',
      'CREATE INDEX IF NOT EXISTS idx_themes_library_download_count ON themes_library(download_count DESC)',
      'CREATE INDEX IF NOT EXISTS idx_themes_library_rating ON themes_library(rating DESC)',
      'CREATE INDEX IF NOT EXISTS idx_themes_library_weekly_downloads ON themes_library(weekly_downloads DESC)',
      'CREATE INDEX IF NOT EXISTS idx_themes_library_visibility ON themes_library(visibility)',
      'CREATE INDEX IF NOT EXISTS idx_themes_library_is_featured ON themes_library(is_featured)',
      'CREATE INDEX IF NOT EXISTS idx_themes_library_category ON themes_library(category)',
      'CREATE INDEX IF NOT EXISTS idx_themes_library_tags ON themes_library USING GIN(tags)'
    ];

    for (const idx of indexes) {
      try {
        await db.query(idx);
        const match = idx.match(/idx_\w+/);
        console.log(`  ✅ Index ${match ? match[0] : 'créé'}`);
      } catch (e) {
        console.log(`  ⏭️  Index existe déjà ou erreur: ${e.message.substring(0, 50)}`);
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 5. CREATE TRIGGER FOR RATING UPDATE
    // ══════════════════════════════════════════════════════════════════════════

    console.log('\n📌 Étape 5: Création trigger update_theme_rating...\n');

    await db.query(`
      CREATE OR REPLACE FUNCTION update_theme_rating()
      RETURNS TRIGGER AS $func$
      BEGIN
        UPDATE themes_library
        SET
          rating = (SELECT COALESCE(AVG(rating), 0) FROM theme_reviews WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id)),
          rating_count = (SELECT COUNT(*) FROM theme_reviews WHERE theme_id = COALESCE(NEW.theme_id, OLD.theme_id)),
          updated_at = NOW()
        WHERE id = COALESCE(NEW.theme_id, OLD.theme_id);
        RETURN NEW;
      END;
      $func$ LANGUAGE plpgsql
    `);
    console.log('  ✅ Fonction update_theme_rating créée');

    await db.query('DROP TRIGGER IF EXISTS trigger_update_theme_rating ON theme_reviews');
    await db.query(`
      CREATE TRIGGER trigger_update_theme_rating
      AFTER INSERT OR UPDATE OR DELETE ON theme_reviews
      FOR EACH ROW
      EXECUTE FUNCTION update_theme_rating()
    `);
    console.log('  ✅ Trigger trigger_update_theme_rating créé');

    // ══════════════════════════════════════════════════════════════════════════
    // 6. CREATE FUNCTION generate_share_slug
    // ══════════════════════════════════════════════════════════════════════════

    console.log('\n📌 Étape 6: Création fonction generate_share_slug...\n');

    await db.query(`
      CREATE OR REPLACE FUNCTION generate_share_slug(theme_name VARCHAR)
      RETURNS VARCHAR AS $func$
      DECLARE
        base_slug VARCHAR;
        final_slug VARCHAR;
        counter INTEGER := 0;
      BEGIN
        base_slug := lower(regexp_replace(
          regexp_replace(theme_name, '[^a-zA-Z0-9\\s-]', '', 'g'),
          '\\s+', '-', 'g'
        ));
        base_slug := substring(base_slug, 1, 30);
        final_slug := base_slug;

        WHILE EXISTS (SELECT 1 FROM themes_library WHERE share_slug = final_slug) LOOP
          counter := counter + 1;
          final_slug := base_slug || '-' || counter;
        END LOOP;

        RETURN final_slug;
      END;
      $func$ LANGUAGE plpgsql
    `);
    console.log('  ✅ Fonction generate_share_slug créée');

    // ══════════════════════════════════════════════════════════════════════════
    // 7. CREATE FUNCTION generate_short_code
    // ══════════════════════════════════════════════════════════════════════════

    console.log('\n📌 Étape 7: Création fonction generate_short_code...\n');

    await db.query(`
      CREATE OR REPLACE FUNCTION generate_short_code()
      RETURNS VARCHAR AS $func$
      DECLARE
        chars VARCHAR := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        result VARCHAR := '';
        i INTEGER;
      BEGIN
        FOR i IN 1..8 LOOP
          result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;

        WHILE EXISTS (SELECT 1 FROM themes_library WHERE short_code = result) LOOP
          result := '';
          FOR i IN 1..8 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
          END LOOP;
        END LOOP;

        RETURN result;
      END;
      $func$ LANGUAGE plpgsql
    `);
    console.log('  ✅ Fonction generate_short_code créée');

    // ══════════════════════════════════════════════════════════════════════════
    // VERIFICATION FINALE
    // ══════════════════════════════════════════════════════════════════════════

    console.log('\n' + '='.repeat(80));
    console.log('🔍 Vérification finale...\n');

    // Vérifier les nouvelles colonnes
    const newColumns = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'themes_library'
      AND column_name IN ('share_slug', 'short_code', 'fork_count', 'view_count',
                          'rating_count', 'weekly_downloads', 'embed_color',
                          'tags', 'category', 'difficulty', 'icon', 'thumbnail_url', 'banner_url')
      ORDER BY column_name
    `);

    console.log('✅ Nouvelles colonnes dans themes_library:');
    console.table(newColumns);

    // Vérifier les tables
    const newTables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('theme_reviews', 'theme_views')
      AND table_schema = 'public'
    `);

    console.log('✅ Nouvelles tables:');
    console.table(newTables);

    // Vérifier les fonctions
    const functions = await db.queryAll(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_name IN ('generate_share_slug', 'generate_short_code', 'update_theme_rating')
      AND routine_schema = 'public'
    `);

    console.log('✅ Fonctions créées:');
    console.table(functions);

    console.log('\n✅ Migration terminée avec succès!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  }
}

runMigration();
