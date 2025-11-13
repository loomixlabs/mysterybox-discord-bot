const db = require('./utils/database-pg');
require('dotenv').config();

async function listTables() {
  try {
    const tables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE '%history%' OR table_name LIKE '%log%')
      ORDER BY table_name
    `);

    console.log('📊 Tables history/log trouvées:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

listTables();
