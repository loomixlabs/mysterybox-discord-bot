const db = require('./utils/database-pg');

async function checkPlayerProgressSchema() {
  console.log('🔍 SCHÉMA DES TABLES DE PROGRESSION\n');
  console.log('='.repeat(80));

  try {
    // player_progress
    console.log('\n📋 Table: player_progress\n');
    const progressSchema = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_progress'
      ORDER BY ordinal_position
    `);
    console.table(progressSchema);

    // Exemple
    const sampleProgress = await db.queryOne(`SELECT * FROM player_progress LIMIT 1`);
    if (sampleProgress) {
      console.log('\n📝 Exemple:\n');
      console.table(sampleProgress);
    }

    // collections
    console.log('\n📋 Table: collections\n');
    const collectionsSchema = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'collections'
      ORDER BY ordinal_position
    `);
    console.table(collectionsSchema);

    // player_malus_points
    console.log('\n📋 Table: player_malus_points\n');
    const malusSchema = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'player_malus_points'
      ORDER BY ordinal_position
    `);
    console.table(malusSchema);

    // player_active_bonuses
    console.log('\n📋 Table: player_active_bonuses\n');
    const bonusSchema = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      ORDER BY ordinal_position
    `);
    console.table(bonusSchema);

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkPlayerProgressSchema();
