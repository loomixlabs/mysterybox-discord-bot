const db = require('../utils/database-pg');

async function main() {
  const tables = ['progression_roles', 'theme_builder_sessions', 'theme_reviews', 'theme_views'];

  for (const table of tables) {
    console.log(`\n=== ${table.toUpperCase()} ===`);
    const cols = await db.queryAll(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    if (cols.length === 0) {
      console.log('  (table non trouvée)');
    } else {
      cols.forEach(c => {
        const defaultVal = c.column_default ? ` DEFAULT ${c.column_default}` : '';
        const nullable = c.is_nullable === 'NO' ? ' NOT NULL' : '';
        console.log(`  ${c.column_name}: ${c.data_type}${defaultVal}${nullable}`);
      });
    }
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
