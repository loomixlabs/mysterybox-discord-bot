/**
 * Migration des récompenses de 'points' vers 'currency' (Loomix)
 */
require('dotenv').config();
const db = require('../utils/database-pg');

async function migrate() {
  console.log('🔄 Migration des récompenses points → currency\n');
  console.log('='.repeat(80));

  try {
    // 0. Modifier la contrainte CHECK pour ajouter 'currency'
    console.log('📋 Modification de la contrainte CHECK...');

    await db.queryAll(`
      ALTER TABLE daily_rewards_config
      DROP CONSTRAINT IF EXISTS daily_rewards_config_reward_type_check
    `);

    await db.queryAll(`
      ALTER TABLE daily_rewards_config
      ADD CONSTRAINT daily_rewards_config_reward_type_check
      CHECK (reward_type = ANY (ARRAY['mystery_box', 'points', 'currency', 'collectible', 'super_bonus', 'random_collectible', 'choice']))
    `);

    console.log('✅ Contrainte modifiée');

    // 1. Compter les récompenses à migrer
    const before = await db.queryAll(`
      SELECT COUNT(*) as count FROM daily_rewards_config WHERE reward_type = 'points'
    `);
    console.log('📊 Récompenses à migrer:', before[0].count);

    // 2. Mettre à jour reward_type de 'points' vers 'currency'
    const updateResult = await db.queryAll(`
      UPDATE daily_rewards_config
      SET reward_type = 'currency',
          display_name = reward_amount || ' Loomix',
          updated_at = NOW()
      WHERE reward_type = 'points'
      RETURNING id, guild_id, theme_id, day_number, reward_amount, display_name
    `);

    console.log('✅ Récompenses mises à jour:', updateResult.length);

    if (updateResult.length > 0) {
      console.log('\nExemples de mises à jour:');
      console.table(updateResult.slice(0, 10));
    }

    // 3. Vérifier le résultat
    const after = await db.queryAll(`
      SELECT COUNT(*) as count FROM daily_rewards_config WHERE reward_type = 'points'
    `);
    console.log('\n📊 Récompenses restantes avec points:', after[0].count);

    // 4. Vérifier les récompenses du thème test
    const testRewards = await db.queryAll(`
      SELECT day_number, reward_type, reward_amount, display_name
      FROM daily_rewards_config
      WHERE guild_id = '297309737135898624' AND theme_id = 140
      ORDER BY day_number
      LIMIT 15
    `);

    console.log('\n📋 Récompenses thème 140 (testv4):');
    console.table(testRewards);

    console.log('\n✅ Migration terminée avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

migrate();
