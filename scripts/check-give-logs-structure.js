const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

async function checkStructure() {
  console.log('\n🔍 STRUCTURES DES TABLES POUR TEST E2E\n');
  console.log('='.repeat(80));

  try {
    // give_logs
    console.log('\n📋 Colonnes de give_logs:\n');
    const giveLogsCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'give_logs'
      ORDER BY ordinal_position
    `);
    console.table(giveLogsCols.rows);

    // trap_triggered
    console.log('\n📋 Colonnes de trap_triggered:\n');
    const trapCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'trap_triggered'
      ORDER BY ordinal_position
    `);
    console.table(trapCols.rows);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkStructure();
