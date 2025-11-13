const db = require('./utils/database-pg');

async function checkThemeSimple() {
  try {
    console.log('🔍 Vérification du thème...\n');

    const themes = await db.queryAll(`
      SELECT *
      FROM themes
      WHERE guild_id = '1248028543389143070'
      ORDER BY id
    `);

    if (themes.length === 0) {
      console.log('❌ Aucun thème trouvé');
      process.exit(1);
    }

    themes.forEach(theme => {
      console.log(`\n📋 Thème:`, JSON.stringify(theme, null, 2));
    });

    console.log('\n✅ Vérification terminée !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkThemeSimple();
