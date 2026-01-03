const db = require('../utils/database-pg');

async function main() {
  try {
    const result = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'missions'
      ORDER BY ordinal_position
    `);
    console.log('📋 Structure de la table missions:\n');
    console.table(result);
    process.exit(0);
  } catch (err) {
    console.error('Erreur:', err);
    process.exit(1);
  }
}
main();
