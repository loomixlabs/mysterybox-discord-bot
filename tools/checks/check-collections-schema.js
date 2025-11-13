const db = require('./utils/database-pg');

async function checkSchemas() {
  console.log('🔍 VÉRIFICATION DES SCHÉMAS\n');
  console.log('='.repeat(80));

  // Check collections table
  console.log('\n📦 Table: collections');
  const collectionsColumns = await db.queryAll(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'collections'
    ORDER BY ordinal_position
  `);
  console.table(collectionsColumns);

  // Check mission_progress table
  console.log('\n📋 Table: mission_progress');
  const missionProgressColumns = await db.queryAll(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'mission_progress'
    ORDER BY ordinal_position
  `);
  console.table(missionProgressColumns);

  process.exit(0);
}

checkSchemas();
