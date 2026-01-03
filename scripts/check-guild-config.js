const db = require('../utils/database-pg');

async function check() {
  try {
    // Check guild_branding structure
    const cols = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'guild_branding'
      ORDER BY ordinal_position
    `);
    console.log('📋 Structure guild_branding:');
    console.table(cols);

    // Check sample data
    const sample = await db.queryOne('SELECT * FROM guild_branding LIMIT 1');
    console.log('\n📊 Sample data:');
    console.log(sample);

    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

check();
