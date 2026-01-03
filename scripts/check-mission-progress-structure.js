require('dotenv').config();
const db = require('../utils/database-pg');

async function main() {
  try {
    console.log('🔍 Structure de la table mission_progress:\n');

    const result = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'mission_progress'
      ORDER BY ordinal_position
    `);

    console.table(result);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
