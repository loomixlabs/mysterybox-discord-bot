const db = require('../utils/database-pg');

async function checkThemes() {
  try {
    console.log('🔍 VÉRIFICATION DES THÈMES DANS LA DB\n');
    console.log('='.repeat(80));

    // Vérifier tous les thèmes
    const themes = await db.queryAll(`
      SELECT id, guild_id, theme_id, name, is_active, duration_days, required_items, created_at
      FROM themes
      ORDER BY created_at DESC
      LIMIT 20
    `);

    console.log(`\n📊 ${themes.length} thème(s) trouvé(s):\n`);
    console.table(themes.map(t => ({
      id: t.id,
      guild_id: t.guild_id.substring(0, 15) + '...',
      theme_id: t.theme_id,
      name: t.name,
      is_active: t.is_active,
      duration: t.duration_days,
      items: t.required_items,
      created: t.created_at
    })));

    // Vérifier theme_config
    console.log('\n\n📊 Configurations theme_config:\n');
    const configs = await db.queryAll(`
      SELECT tc.theme_id, tc.probability_collectible, tc.probability_mission, tc.probability_trap, tc.probability_super_bonus,
             t.name as theme_name
      FROM theme_config tc
      LEFT JOIN themes t ON tc.theme_id = t.id AND tc.guild_id = t.guild_id
      ORDER BY tc.theme_id DESC
      LIMIT 20
    `);
    console.table(configs);

    // Chercher le thème "test" spécifiquement
    console.log('\n\n🔍 Recherche du thème "test":\n');
    const testTheme = await db.queryOne(`
      SELECT * FROM themes WHERE theme_id = 'test' OR name ILIKE '%test%'
    `);

    if (testTheme) {
      console.log('✅ Thème test trouvé:');
      console.log(testTheme);
    } else {
      console.log('❌ Aucun thème "test" trouvé');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkThemes();
