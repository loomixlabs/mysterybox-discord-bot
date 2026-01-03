const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

async function checkColumns() {
  console.log('🔍 STRUCTURE: super_bonuses\n');

  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'super_bonuses'
      ORDER BY ordinal_position
    `);

    console.table(result.rows);

    // Vérifier aussi les données existantes
    const bonuses = await pool.query(`
      SELECT id, name, effect_type, is_enabled, rarity
      FROM super_bonuses
      ORDER BY id
    `);

    console.log('\n📊 Super Bonuses dans la DB:\n');
    console.table(bonuses.rows);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkColumns();
