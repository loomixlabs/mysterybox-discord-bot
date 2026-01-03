const db = require('../utils/database-pg');

/**
 * Activer le thème "Blanche-Neige et les 7 Nains" pour les tests
 */
async function activateBlancheNeigeTheme() {
  console.log('\n🎨 ACTIVATION - Thème Blanche-Neige\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // Vérifier état actuel
    console.log('\n📋 AVANT ACTIVATION:\n');

    const themes = await db.queryAll(`
      SELECT id, name, is_active
      FROM themes
      WHERE guild_id = $1
      ORDER BY id
    `, [guildId]);

    console.table(themes);

    // Désactiver tous les thèmes
    await db.query(`
      UPDATE themes
      SET is_active = false
      WHERE guild_id = $1
    `, [guildId]);

    console.log('✅ Tous les thèmes désactivés');

    // Activer Blanche-Neige (ID 1)
    await db.query(`
      UPDATE themes
      SET is_active = true
      WHERE guild_id = $1 AND id = 1
    `, [guildId]);

    console.log('✅ Thème "Blanche-Neige et les 7 Nains" activé\n');

    // Vérifier état après
    console.log('📋 APRÈS ACTIVATION:\n');

    const themesAfter = await db.queryAll(`
      SELECT id, name, is_active
      FROM themes
      WHERE guild_id = $1
      ORDER BY id
    `, [guildId]);

    console.table(themesAfter);

    // Afficher la configuration
    const config = await db.queryOne(`
      SELECT
        tc.probability_collectible,
        tc.probability_mission,
        tc.probability_trap,
        tc.probability_super_bonus
      FROM theme_config tc
      WHERE tc.guild_id = $1 AND tc.theme_id = 1
    `, [guildId]);

    console.log('\n📊 CONFIGURATION DU THÈME ACTIF:\n');
    console.table([{
      'Collectible (%)': config.probability_collectible,
      'Mission (%)': config.probability_mission,
      'Trap (%)': config.probability_trap,
      'Super Bonus (%)': config.probability_super_bonus,
      'TOTAL (%)': config.probability_collectible + config.probability_mission + config.probability_trap + config.probability_super_bonus
    }]);

    console.log('\n✅ Thème activé avec succès !');
    console.log('\n💡 Le bot va maintenant distribuer:');
    console.log(`   - ${config.probability_collectible}% de collectibles`);
    console.log(`   - ${config.probability_mission}% de missions`);
    console.log(`   - ${config.probability_trap}% de pièges`);
    console.log(`   - ${config.probability_super_bonus}% de super bonus`);
    console.log('\n🎯 Vous pouvez maintenant ouvrir des mystery boxes sur Discord pour tester\n');

    console.log('='.repeat(80));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

activateBlancheNeigeTheme();
