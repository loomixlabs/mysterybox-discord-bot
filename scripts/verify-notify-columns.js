const db = require('../utils/database-pg');

async function verify() {
  try {
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'guild_config' AND column_name LIKE 'notify_%'
      ORDER BY column_name
    `);
    console.table(columns);
    console.log(`\n✅ ${columns.length}/6 colonnes créées`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verify();
