const db = require('./utils/database-pg');

async function checkBonusesTable() {
  console.log('🔍 Structure de player_active_bonuses:\n');

  const columns = await db.queryAll(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'player_active_bonuses'
    ORDER BY ordinal_position
  `);

  console.table(columns);

  process.exit(0);
}

checkBonusesTable();
