/**
 * Migration: Ajouter theme_id aux announcement_templates
 *
 * Cette migration:
 * 1. Ajoute la colonne theme_id (nullable) pour lier les templates aux thèmes
 * 2. Crée les index nécessaires pour la performance
 * 3. Met à jour la contrainte unique pour supporter les templates par thème
 */
const db = require('../utils/database-pg');

async function migrate() {
  try {
    console.log('🔧 MIGRATION: Ajout theme_id aux announcement_templates\n');
    console.log('='.repeat(80));

    // 1. Vérifier si la colonne existe déjà
    console.log('\n📋 1. Vérification de la colonne theme_id...\n');
    const columnExists = await db.queryOne(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'announcement_templates' AND column_name = 'theme_id'
    `);

    if (columnExists) {
      console.log('   ⏭️  Colonne theme_id déjà existante');
    } else {
      console.log('   Ajout de la colonne theme_id...');
      await db.query(`
        ALTER TABLE announcement_templates
        ADD COLUMN theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE
      `);
      console.log('   ✅ Colonne theme_id ajoutée');
    }

    // 2. Créer l'index sur theme_id
    console.log('\n📋 2. Création des index...\n');

    // Index simple
    const indexExists1 = await db.queryOne(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'announcement_templates'
      AND indexname = 'idx_announcement_templates_theme_id'
    `);

    if (!indexExists1) {
      await db.query(`
        CREATE INDEX idx_announcement_templates_theme_id
        ON announcement_templates(theme_id)
      `);
      console.log('   ✅ Index idx_announcement_templates_theme_id créé');
    } else {
      console.log('   ⏭️  Index idx_announcement_templates_theme_id existe déjà');
    }

    // Index composé
    const indexExists2 = await db.queryOne(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'announcement_templates'
      AND indexname = 'idx_announcement_templates_guild_type_theme'
    `);

    if (!indexExists2) {
      await db.query(`
        CREATE INDEX idx_announcement_templates_guild_type_theme
        ON announcement_templates(guild_id, type, theme_id)
      `);
      console.log('   ✅ Index idx_announcement_templates_guild_type_theme créé');
    } else {
      console.log('   ⏭️  Index idx_announcement_templates_guild_type_theme existe déjà');
    }

    // 3. Mettre à jour la contrainte unique
    console.log('\n📋 3. Mise à jour de la contrainte unique...\n');

    // Vérifier si l'ancienne contrainte existe
    const oldConstraint = await db.queryOne(`
      SELECT conname FROM pg_constraint
      WHERE conname = 'announcement_templates_guild_id_type_key'
    `);

    if (oldConstraint) {
      console.log('   Suppression de l\'ancienne contrainte...');
      await db.query(`
        ALTER TABLE announcement_templates
        DROP CONSTRAINT announcement_templates_guild_id_type_key
      `);
      console.log('   ✅ Ancienne contrainte supprimée');
    } else {
      console.log('   ⏭️  Ancienne contrainte n\'existe pas');
    }

    // Vérifier si la nouvelle contrainte existe déjà
    const newConstraint = await db.queryOne(`
      SELECT conname FROM pg_constraint
      WHERE conname = 'announcement_templates_guild_type_theme_unique'
    `);

    if (!newConstraint) {
      console.log('   Création de la nouvelle contrainte unique...');
      await db.query(`
        ALTER TABLE announcement_templates
        ADD CONSTRAINT announcement_templates_guild_type_theme_unique
        UNIQUE (guild_id, type, theme_id)
      `);
      console.log('   ✅ Nouvelle contrainte créée (guild_id, type, theme_id)');
    } else {
      console.log('   ⏭️  Nouvelle contrainte existe déjà');
    }

    // 4. Vérification finale
    console.log('\n📋 4. Vérification finale...\n');

    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'announcement_templates'
      ORDER BY ordinal_position
    `);

    console.log('   Colonnes de la table announcement_templates:');
    columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(required)';
      console.log(`   - ${col.column_name}: ${col.data_type} ${nullable}`);
    });

    const constraints = await db.queryAll(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'announcement_templates'::regclass
      AND contype IN ('u', 'f')
    `);

    console.log('\n   Contraintes actives:');
    constraints.forEach(c => {
      console.log(`   - ${c.conname}`);
      console.log(`     ${c.definition}`);
    });

    // 5. Statistiques
    console.log('\n📋 5. Statistiques...\n');

    const stats = await db.queryOne(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN theme_id IS NULL THEN 1 END) as global_templates,
        COUNT(CASE WHEN theme_id IS NOT NULL THEN 1 END) as theme_templates
      FROM announcement_templates
    `);

    console.log(`   Total templates: ${stats.total}`);
    console.log(`   Templates globaux (theme_id NULL): ${stats.global_templates}`);
    console.log(`   Templates liés à un thème: ${stats.theme_templates}`);

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ MIGRATION TERMINÉE AVEC SUCCÈS');
    console.log('\n📌 Note: Les templates existants ont theme_id = NULL (globaux)');
    console.log('   Ils seront utilisés comme fallback si pas de template spécifique au thème actif.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

migrate();
