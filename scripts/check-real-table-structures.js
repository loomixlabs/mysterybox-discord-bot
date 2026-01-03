const db = require('../utils/database-pg');

async function checkRealStructures() {
  console.log('🔍 VÉRIFICATION STRUCTURES RÉELLES\n');
  console.log('='.repeat(80));

  try {
    // Tables critiques à vérifier
    const tables = [
      'super_bonuses',
      'badges',
      'missions',
      'players',
      'themes',
      'collectibles',
      'guild_config'
    ];

    for (const table of tables) {
      console.log(`\n📋 Table: ${table}\n`);

      const columns = await db.queryAll(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      console.table(columns);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkRealStructures();
