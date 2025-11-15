const db = require('../../utils/database-pg');

async function addPreferredColorColumn() {
  try {
    console.log('🔄 MIGRATION: Ajout de la colonne preferred_color à la table players\n');
    console.log('='.repeat(80));

    // Ajouter la colonne preferred_color (nullable, NULL par défaut = couleur dynamique)
    await db.query(`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS preferred_color TEXT DEFAULT NULL
    `);

    console.log('✅ Colonne preferred_color ajoutée avec succès');
    console.log('   - Type: TEXT');
    console.log('   - Nullable: YES');
    console.log('   - Défaut: NULL (= couleur dynamique basée sur la progression)');

    // Vérifier que la colonne a été ajoutée
    const result = await db.queryOne(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'players' AND column_name = 'preferred_color'
    `);

    console.log('\n📊 Vérification:');
    console.table([result]);

    console.log('\n✅ Migration terminée avec succès !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

addPreferredColorColumn();
