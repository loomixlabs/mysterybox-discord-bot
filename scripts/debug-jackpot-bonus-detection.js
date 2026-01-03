const db = require('../utils/database-pg');
const superBonusHandler = require('../handlers/superBonusHandler');

/**
 * Debug: Vérifier pourquoi hasMultiplierBonus() ne détecte pas le Jackpot x2
 */

async function debugJackpotDetection() {
  try {
    const GUILD_ID = '297309737135898624';
    const USER_ID = '297307186307006464'; // Vous

    console.log('🔍 DEBUG - Détection Jackpot x2\n');
    console.log('='.repeat(80));
    console.log(`\n👤 User: ${USER_ID}`);
    console.log(`🏰 Guild: ${GUILD_ID}\n`);

    // 1. Vérifier getPlayerActiveBonuses()
    console.log('📋 ÉTAPE 1: getPlayerActiveBonuses()\n');

    const activeBonuses = await superBonusHandler.getPlayerActiveBonuses(GUILD_ID, USER_ID);

    console.log(`Total bonus actifs: ${activeBonuses.length}\n`);

    activeBonuses.forEach((bonus, index) => {
      console.log(`🔹 Bonus ${index + 1}:`);
      console.log(`   ID: ${bonus.id}`);
      console.log(`   Nom: ${bonus.name}`);
      console.log(`   effect_type: ${bonus.effect_type}`);
      console.log(`   is_active: ${bonus.is_active}`);
      console.log(`   remaining_charges: ${bonus.remaining_charges || 'N/A'}`);
      console.log(`   expires_at: ${bonus.expires_at || 'N/A'}`);
      console.log(`   effect_config: ${JSON.stringify(bonus.effect_config)}\n`);
    });

    // 2. Vérifier hasMultiplierBonus()
    console.log('='.repeat(80));
    console.log('\n📋 ÉTAPE 2: hasMultiplierBonus()\n');

    const jackpotBonus = await superBonusHandler.hasMultiplierBonus(GUILD_ID, USER_ID, 'collectible');

    if (jackpotBonus) {
      console.log('✅ Jackpot x2 DÉTECTÉ !\n');
      console.log(`   ID: ${jackpotBonus.id}`);
      console.log(`   Nom: ${jackpotBonus.name}`);
      console.log(`   remaining_charges: ${jackpotBonus.remaining_charges}`);
      console.log(`   effect_config: ${JSON.stringify(jackpotBonus.effect_config)}`);
    } else {
      console.log('❌ Jackpot x2 NON DÉTECTÉ !\n');

      // Diagnostic détaillé
      console.log('🔍 DIAGNOSTIC:\n');

      const jackpots = activeBonuses.filter(b => b.effect_type === 'multiplier');

      if (jackpots.length === 0) {
        console.log('   ❌ Aucun bonus de type "multiplier" trouvé dans activeBonuses');
      } else {
        jackpots.forEach(j => {
          console.log(`   🔹 Bonus "multiplier" trouvé: ${j.name}`);
          console.log(`      is_active: ${j.is_active} ${j.is_active ? '✅' : '❌ PROBLÈME'}`);
          console.log(`      remaining_charges: ${j.remaining_charges} ${j.remaining_charges > 0 ? '✅' : '❌ PROBLÈME'}`);

          const notExpired = !j.expires_at || new Date(j.expires_at) > new Date();
          console.log(`      expires_at: ${j.expires_at || 'N/A'} ${notExpired ? '✅' : '❌ EXPIRÉ'}`);

          const appliesTo = j.effect_config?.applies_to;
          console.log(`      applies_to: "${appliesTo}" ${appliesTo === 'collectible' ? '✅' : '❌ PROBLÈME'}`);

          // Vérifier chaque condition individuellement
          const checks = {
            'effect_type === multiplier': j.effect_type === 'multiplier',
            'is_active === true': j.is_active,
            'remaining_charges > 0': j.remaining_charges > 0,
            'not expired': notExpired,
            'applies_to === collectible': appliesTo === 'collectible'
          };

          console.log(`\n      Conditions:`);
          Object.entries(checks).forEach(([condition, pass]) => {
            console.log(`         ${pass ? '✅' : '❌'} ${condition}`);
          });
        });
      }
    }

    // 3. Requête SQL directe pour comparaison
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 ÉTAPE 3: Requête SQL Directe\n');

    const sqlResult = await db.query(`
      SELECT pab.*, sb.name, sb.effect_type, sb.effect_config
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1
      AND pab.user_id = $2
      AND sb.effect_type = 'multiplier'
    `, [GUILD_ID, USER_ID]);

    console.log(`Total multiplier bonus (SQL direct): ${sqlResult.length}\n`);

    sqlResult.forEach(row => {
      console.log(`🔹 ${row.name}:`);
      console.log(`   Instance ID: ${row.id}`);
      console.log(`   activated_at: ${row.activated_at}`);
      console.log(`   is_active: ${row.is_active}`);
      console.log(`   remaining_charges: ${row.remaining_charges}`);
      console.log(`   effect_config: ${JSON.stringify(row.effect_config)}\n`);
    });

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('🔴 ERREUR:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

debugJackpotDetection();
