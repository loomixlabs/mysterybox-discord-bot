const db = require('../utils/database-pg');

async function checkCollectiblesColumns() {
  try {
    const columns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'collectibles'
      ORDER BY ordinal_position
    `);

    console.log('Colonnes de la table collectibles:\n');
    console.table(columns);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkCollectiblesColumns();
