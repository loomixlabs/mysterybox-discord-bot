require('dotenv').config();
const db = require('../utils/database-pg');

async function checkActivityLogsTable() {
  console.log('🔍 VÉRIFICATION DE LA TABLE activity_logs\n');

  try {
    // Vérifier si la table existe
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'activity_logs'
      );
    `);

    console.log('Résultat de la vérification:', tableExists[0]);

    if (tableExists[0].exists) {
      console.log('✅ La table activity_logs EXISTE\n');

      // Afficher la structure
      const structure = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'activity_logs'
        ORDER BY ordinal_position
      `);

      console.log('Structure de la table:');
      structure.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });

    } else {
      console.log('❌ La table activity_logs N\'EXISTE PAS\n');
      console.log('Il faut la créer pour logger les activités (pièges, missions, etc.)');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await db.close();
  }
}

checkActivityLogsTable();
