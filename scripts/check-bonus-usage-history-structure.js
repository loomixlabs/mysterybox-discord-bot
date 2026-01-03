const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

async function checkStructure() {
  console.log('\n🔍 STRUCTURE bonus_usage_history\n');
  console.log('='.repeat(80));

  try {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bonus_usage_history'
      ORDER BY ordinal_position
    `);

    console.table(cols.rows);

    console.log('\n📊 Total colonnes:', cols.rows.length);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkStructure();
