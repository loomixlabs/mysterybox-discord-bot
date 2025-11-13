const db = require('./utils/database-pg');

async function listAllTables() {
  try {
    console.log('📋 Liste de toutes les tables de la base de données:\n');

    const tables = await db.queryAll(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log(`✅ ${tables.length} table(s) trouvée(s):\n`);
    tables.forEach(t => console.log(`   - ${t.tablename}`));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

listAllTables();
