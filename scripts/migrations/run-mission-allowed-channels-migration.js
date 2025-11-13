const db = require('./utils/database-pg');

async function runMigration() {
  try {
    console.log('🔄 Exécution de la migration add-mission-allowed-channels...\n');

    // Vérifier si la colonne existe déjà
    const columns = await db.queryAll(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'missions'
        AND column_name = 'allowed_channels'
    `);

    if (columns.length > 0) {
      console.log('✅ La colonne allowed_channels existe déjà.');
    } else {
      console.log('⚙️ Ajout de la colonne allowed_channels...');

      await db.query(`
        ALTER TABLE missions
        ADD COLUMN IF NOT EXISTS allowed_channels TEXT[]
      `);

      console.log('✅ Colonne allowed_channels ajoutée avec succès!');
    }

    // Vérifier le résultat
    const result = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'missions'
        AND column_name = 'allowed_channels'
    `);

    console.log('\n📋 Résultat:');
    result.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

runMigration();
