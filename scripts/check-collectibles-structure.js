const db = require('../utils/database-pg');

async function checkCollectiblesStructure() {
  try {
    console.log('🔍 VÉRIFICATION - Structure table collectibles\n');
    console.log('='.repeat(80));

    // Récupérer la structure de la table
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'collectibles'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Colonnes de la table collectibles:\n');
    console.table(columns);

    // Récupérer un exemple de collectible
    const sample = await db.query(`
      SELECT *
      FROM collectibles
      LIMIT 1
    `);

    console.log('\n📋 Exemple de collectible:\n');
    if (sample.length > 0) {
      console.log(JSON.stringify(sample[0], null, 2));
    }

    console.log('\n' + '='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkCollectiblesStructure();
