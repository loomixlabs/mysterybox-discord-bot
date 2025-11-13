const db = require('./utils/database-pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔧 Exécution de la migration allowed_channels...\n');

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, 'database', 'migrations', 'add-mission-allowed-channels.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Exécuter la migration
    await db.query(sql);
    console.log('✅ Migration exécutée avec succès\n');

    // Vérifier que la colonne existe
    const columnCheck = await db.queryOne(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'missions'
        AND column_name = 'allowed_channels'
    `);

    if (columnCheck) {
      console.log('✅ Colonne allowed_channels créée avec succès');
      console.log(`   Type: ${columnCheck.data_type}\n`);

      // Afficher la structure actuelle de la table missions
      const columns = await db.queryAll(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'missions'
        ORDER BY ordinal_position
      `);

      console.log('📋 Structure de la table missions:\n');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULL)'}`);
      });
    } else {
      console.error('❌ La colonne allowed_channels n\'a pas été créée');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
