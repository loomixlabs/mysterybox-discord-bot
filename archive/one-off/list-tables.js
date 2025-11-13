const db = require('./utils/database-pg');

async function listTables() {
  try {
    console.log('\n📋 TABLES EXISTANTES DANS LA BASE DE DONNÉES:\n');

    const tables = await db.queryAll(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    if (tables.length === 0) {
      console.log('❌ Aucune table trouvée!');
    } else {
      console.log(`✅ ${tables.length} table(s) trouvée(s):\n`);
      tables.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.tablename}`);
      });
    }

    // Vérifier spécifiquement les tables Give Unique
    console.log('\n\n🔍 VÉRIFICATION DES TABLES GIVE UNIQUE:\n');

    const requiredTables = ['themes', 'theme_items', 'channels', 'players', 'inventories'];

    for (const tableName of requiredTables) {
      const exists = await db.queryOne(`
        SELECT EXISTS (
          SELECT FROM pg_tables
          WHERE schemaname = 'public'
          AND tablename = $1
        )
      `, [tableName]);

      const status = exists.exists ? '✅' : '❌';
      console.log(`   ${status} ${tableName}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

listTables();
