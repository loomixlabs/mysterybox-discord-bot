const db = require('../utils/database-pg');

async function main() {
  try {
    const tables = await db.queryAll(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 TOUTES LES TABLES LOCALES:\n');

    const themeBuilderTables = [];
    const botTables = [];

    for (const t of tables) {
      const name = t.table_name;
      // Tables Theme Builder (dashboard)
      if (name.includes('theme_builder') || name.includes('themes_library') || name.includes('banned_builder')) {
        themeBuilderTables.push(name);
      } else {
        botTables.push(name);
      }
    }

    console.log('🎨 TABLES THEME BUILDER (à préserver):');
    themeBuilderTables.forEach(t => console.log('   - ' + t));

    console.log('\n🤖 TABLES BOT (à synchroniser depuis VPS):');
    botTables.forEach(t => console.log('   - ' + t));

    console.log('\n📊 Résumé:');
    console.log('   Theme Builder: ' + themeBuilderTables.length + ' tables');
    console.log('   Bot: ' + botTables.length + ' tables');

    process.exit(0);
  } catch (err) {
    console.error('Erreur:', err);
    process.exit(1);
  }
}

main();
