const db = require('../utils/database-pg');

async function checkThemeStatus() {
  console.log('\n🔍 VÉRIFICATION - État des Thèmes\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // Tous les thèmes
    const themes = await db.queryAll(`
      SELECT id, name, is_active
      FROM themes
      WHERE guild_id = $1
      ORDER BY is_active DESC, id
    `, [guildId]);

    console.log(`\n📋 Thèmes trouvés: ${themes.length}\n`);
    console.table(themes);

    // Configuration des thèmes
    const configs = await db.queryAll(`
      SELECT
        tc.theme_id,
        t.name,
        tc.probability_collectible,
        tc.probability_mission,
        tc.probability_trap,
        tc.probability_super_bonus
      FROM theme_config tc
      JOIN themes t ON tc.theme_id = t.id
      WHERE tc.guild_id = $1
    `, [guildId]);

    console.log(`\n📊 Configurations trouvées: ${configs.length}\n`);
    console.table(configs);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkThemeStatus();
