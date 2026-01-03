const db = require('../utils/database-pg');

/**
 * Augmenter temporairement probability_super_bonus à 50% pour les tests
 */
async function setSuperBonusProbability50() {
  console.log('\n⚙️  CONFIGURATION - Super Bonus Probability = 50%\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // État avant
    console.log('\n📋 AVANT MODIFICATION:\n');

    const configBefore = await db.queryOne(`
      SELECT
        tc.probability_collectible,
        tc.probability_mission,
        tc.probability_trap,
        tc.probability_super_bonus
      FROM theme_config tc
      JOIN themes t ON tc.theme_id = t.id
      WHERE tc.guild_id = $1 AND t.is_active = true
    `, [guildId]);

    console.table([{
      'Collectible (%)': configBefore.probability_collectible,
      'Mission (%)': configBefore.probability_mission,
      'Trap (%)': configBefore.probability_trap,
      'Super Bonus (%)': configBefore.probability_super_bonus,
      'TOTAL (%)': configBefore.probability_collectible + configBefore.probability_mission + configBefore.probability_trap + configBefore.probability_super_bonus
    }]);

    // Modifier pour 50% super bonus
    // Nouvelle répartition: 25% collectible, 25% mission, 0% trap, 50% super bonus
    await db.query(`
      UPDATE theme_config
      SET
        probability_collectible = 25,
        probability_mission = 25,
        probability_trap = 0,
        probability_super_bonus = 50
      WHERE guild_id = $1 AND theme_id = (
        SELECT id FROM themes WHERE guild_id = $1 AND is_active = true
      )
    `, [guildId]);

    console.log('\n✅ Probabilités modifiées\n');

    // État après
    console.log('📋 APRÈS MODIFICATION:\n');

    const configAfter = await db.queryOne(`
      SELECT
        tc.probability_collectible,
        tc.probability_mission,
        tc.probability_trap,
        tc.probability_super_bonus
      FROM theme_config tc
      JOIN themes t ON tc.theme_id = t.id
      WHERE tc.guild_id = $1 AND t.is_active = true
    `, [guildId]);

    console.table([{
      'Collectible (%)': configAfter.probability_collectible,
      'Mission (%)': configAfter.probability_mission,
      'Trap (%)': configAfter.probability_trap,
      'Super Bonus (%)': configAfter.probability_super_bonus,
      'TOTAL (%)': configAfter.probability_collectible + configAfter.probability_mission + configAfter.probability_trap + configAfter.probability_super_bonus
    }]);

    console.log('\n✅ Configuration mise à jour avec succès !');
    console.log('\n🎯 TESTS RECOMMANDÉS:');
    console.log('   1. Ouvrir 20-30 mystery boxes sur Discord');
    console.log('   2. Environ 50% devraient être des super bonus');
    console.log('   3. Vérifier les bonus automatiques (activés immédiatement)');
    console.log('   4. Vérifier les bonus manuels (en attente d\'activation)');
    console.log('\n⚠️  IMPORTANT: Remettre à 10% après les tests !\n');

    console.log('='.repeat(80));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

setSuperBonusProbability50();
