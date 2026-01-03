/**
 * Migration: Ajouter colonne thread_archived à mission_progress
 * Exécute la migration SQL pour le suivi d'archivage des threads
 */

const db = require('../utils/database-pg');

async function runMigration() {
  console.log('🔄 Exécution de la migration thread_archived...\n');

  try {
    // Ajouter la colonne thread_archived
    await db.query(`
      ALTER TABLE mission_progress
      ADD COLUMN IF NOT EXISTS thread_archived BOOLEAN DEFAULT FALSE
    `);
    console.log('✅ Colonne thread_archived ajoutée');

    // Créer l'index pour optimiser le nettoyage
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_mission_progress_thread_cleanup
      ON mission_progress (status, thread_id, thread_archived)
      WHERE thread_id IS NOT NULL AND (thread_archived IS NULL OR thread_archived = FALSE)
    `);
    console.log('✅ Index idx_mission_progress_thread_cleanup créé');

    // Marquer les missions déjà terminées comme archivées
    const result = await db.query(`
      UPDATE mission_progress
      SET thread_archived = TRUE
      WHERE status IN ('completed', 'failed')
        AND thread_id IS NOT NULL
        AND (thread_archived IS NULL OR thread_archived = FALSE)
    `);
    console.log(`✅ ${result.rowCount || 0} missions existantes marquées comme archivées`);

    // Vérification
    const check = await db.queryOne(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'mission_progress' AND column_name = 'thread_archived'
    `);

    if (check) {
      console.log('\n📊 Vérification:');
      console.log(`   Colonne: ${check.column_name}`);
      console.log(`   Type: ${check.data_type}`);
      console.log(`   Défaut: ${check.column_default}`);
    }

    console.log('\n✅ Migration terminée avec succès !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
