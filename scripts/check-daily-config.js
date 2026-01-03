require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
  console.log('🔍 Vérification daily_rewards_config\n');

  const guildId = '297309737135898624';
  const theme = await db.getActiveTheme(guildId);
  console.log('Theme actif:', theme?.name, '(ID:', theme?.id, ')');

  // Vérifier les récompenses configurées
  const rewards = await db.queryAll(`
    SELECT day_number, reward_type, reward_rarity, display_name, is_milestone
    FROM daily_rewards_config
    WHERE guild_id = $1 AND theme_id = $2
    ORDER BY day_number
    LIMIT 10
  `, [guildId, theme.id]);

  console.log('\n📋 Récompenses configurées:', rewards.length, 'entrées');
  if (rewards.length > 0) {
    console.table(rewards);
  } else {
    console.log('⚠️  AUCUNE récompense configurée pour ce thème!');
  }

  // Vérifier la structure de la table
  const structure = await db.queryAll(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'daily_rewards_config'
    ORDER BY ordinal_position
  `);

  console.log('\n📊 Structure de daily_rewards_config:');
  console.table(structure);

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
