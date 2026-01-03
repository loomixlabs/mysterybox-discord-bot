/**
 * Script pour appliquer la migration du système de progression_roles
 */
const db = require('../utils/database-pg');

async function runMigration() {
  console.log('🔄 MIGRATION: Système de Progression Roles\n');
  console.log('='.repeat(80));

  try {
    // 1. Ajouter colonne progression_roles à theme_config
    console.log('\n📊 1. Ajout de la colonne progression_roles à theme_config...');
    await db.query(`
      ALTER TABLE theme_config
      ADD COLUMN IF NOT EXISTS progression_roles JSONB DEFAULT '[]'::jsonb
    `);
    console.log('✅ Colonne progression_roles ajoutée');

    // 2. Ajouter colonne achieved_progression_roles à player_progress
    console.log('\n📊 2. Ajout de la colonne achieved_progression_roles à player_progress...');
    await db.query(`
      ALTER TABLE player_progress
      ADD COLUMN IF NOT EXISTS achieved_progression_roles INTEGER[] DEFAULT '{}'
    `);
    console.log('✅ Colonne achieved_progression_roles ajoutée');

    // 3. Ajouter les commentaires
    console.log('\n📊 3. Ajout des commentaires...');
    await db.query(`
      COMMENT ON COLUMN theme_config.progression_roles IS 'Array JSON des rôles de progression: [{name, color, required_items, percentage, discord_role_id, hoist, mentionable}]'
    `);
    await db.query(`
      COMMENT ON COLUMN player_progress.achieved_progression_roles IS 'Array des seuils required_items déjà atteints pour éviter double attribution'
    `);
    console.log('✅ Commentaires ajoutés');

    // 4. Créer l'index GIN pour améliorer les performances
    console.log('\n📊 4. Création de l\'index GIN...');
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_theme_config_progression_roles
      ON theme_config USING GIN (progression_roles)
    `);
    console.log('✅ Index créé');

    // 5. Vérification
    console.log('\n📊 5. Vérification de la migration...');
    const themeConfigCols = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      AND column_name = 'progression_roles'
    `);
    console.log('theme_config.progression_roles:', themeConfigCols);

    const playerProgressCols = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'player_progress'
      AND column_name = 'achieved_progression_roles'
    `);
    console.log('player_progress.achieved_progression_roles:', playerProgressCols);

    console.log('\n✅ Migration terminée avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
