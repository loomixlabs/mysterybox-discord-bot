require('dotenv').config();
const db = require('../utils/database-pg');

async function test() {
  console.log('🔍 Test getDailyRewardForDay - TOUS LES SERVEURS\n');

  // Test sur le serveur de production
  const guildProd = '1248028543389143070';
  const themeProd = await db.getActiveTheme(guildProd);
  console.log('=== SERVEUR PRODUCTION (Monopoly) ===');
  console.log('Theme:', themeProd?.name, '(ID:', themeProd?.id, ')');

  if (themeProd) {
    const reward = await db.getDailyRewardForDay(guildProd, themeProd.id, 1);
    console.log('Récompense jour 1:', reward?.reward_type || 'NON CONFIGURÉ');
    if (reward) {
      console.log('  display_name:', reward.display_name);
    }
  }

  // Test sur le serveur de test
  const guildTest = '297309737135898624';
  const themeTest = await db.getActiveTheme(guildTest);
  console.log('\n=== SERVEUR TEST (testv4) ===');
  console.log('Theme:', themeTest?.name, '(ID:', themeTest?.id, ')');

  if (themeTest) {
    const reward = await db.getDailyRewardForDay(guildTest, themeTest.id, 1);
    console.log('Récompense jour 1:', reward?.reward_type || 'NON CONFIGURÉ');
    if (reward) {
      console.log('  display_name:', reward.display_name);
    }
  }

  // Vérifier tous les serveurs avec récompenses configurées
  console.log('\n=== TOUS LES DAILY_REWARDS_CONFIG ===');
  const allConfigs = await db.queryAll(`
    SELECT DISTINCT guild_id, theme_id,
           (SELECT name FROM themes WHERE id = theme_id) as theme_name,
           COUNT(*) as nb_jours
    FROM daily_rewards_config
    GROUP BY guild_id, theme_id
    ORDER BY guild_id
  `);
  console.table(allConfigs);

  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
