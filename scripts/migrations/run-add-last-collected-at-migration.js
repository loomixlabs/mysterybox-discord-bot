const db = require('./utils/database-pg');

async function runMigration() {
  try {
    console.log('🔄 Ajout de la colonne last_collected_at à player_progress...\n');

    // Ajouter la colonne
    await db.query(`
      ALTER TABLE player_progress
      ADD COLUMN IF NOT EXISTS last_collected_at TIMESTAMP
    `);

    console.log('✅ Colonne last_collected_at ajoutée avec succès!');

    // Vérifier le résultat
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_progress'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Colonnes de player_progress:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

runMigration();
