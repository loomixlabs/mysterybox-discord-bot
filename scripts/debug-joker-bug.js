/**
 * Debug du bug Joker - Investigation complète
 */
const db = require('../utils/database-pg');

const GUILD_ID = '297309737135898624';
const DISCORD_ID = '297307186307006464'; // xmicordix

async function debug() {
  console.log('🔍 DEBUG BUG JOKER - Investigation complète\n');
  console.log('='.repeat(70));

  try {
    // 1. Vérifier les super_bonuses avec effect_type = joker
    console.log('\n📋 1. SUPER BONUS DE TYPE JOKER DANS LA DB');
    const jokerBonuses = await db.queryAll(`
      SELECT id, name, effect_type, bonus_type, duration_type, duration_value,
             is_active, activation_mode
      FROM super_bonuses
      WHERE guild_id = $1 AND effect_type = 'joker'
    `, [GUILD_ID]);
    console.log(`   ${jokerBonuses.length} bonus joker trouvé(s):`);
    jokerBonuses.forEach(b => {
      console.log(`   - ID: ${b.id}, Name: ${b.name}`);
      console.log(`     effect_type: ${b.effect_type}, bonus_type: ${b.bonus_type}`);
      console.log(`     duration_type: ${b.duration_type}, duration_value: ${b.duration_value}`);
      console.log(`     is_active: ${b.is_active}, activation_mode: ${b.activation_mode}`);
    });

    // 2. Vérifier player_active_bonuses pour cet utilisateur
    console.log('\n📋 2. PLAYER_ACTIVE_BONUSES POUR xmicordix');
    const playerBonuses = await db.queryAll(`
      SELECT pab.id, pab.bonus_id, pab.user_id, pab.remaining_charges,
             pab.activated_at, pab.expires_at, pab.is_active,
             sb.name, sb.effect_type, sb.duration_type
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1 AND pab.user_id = $2
      ORDER BY pab.is_active DESC, pab.activated_at DESC
    `, [GUILD_ID, DISCORD_ID]);
    console.log(`   ${playerBonuses.length} bonus assigné(s):`);
    playerBonuses.forEach(b => {
      console.log(`   - PAB ID: ${b.id}, Bonus: ${b.name} (ID: ${b.bonus_id})`);
      console.log(`     effect_type: ${b.effect_type}, duration_type: ${b.duration_type}`);
      console.log(`     remaining_charges: ${b.remaining_charges}`);
      console.log(`     activated_at: ${b.activated_at}`);
      console.log(`     is_active: ${b.is_active}, expires_at: ${b.expires_at}`);
    });

    // 3. Tester getActiveBonusesByPlayer (la fonction utilisée par hasJokerBonus)
    console.log('\n📋 3. TEST getActiveBonusesByPlayer()');
    const activeBonuses = await db.getActiveBonusesByPlayer(GUILD_ID, DISCORD_ID);
    console.log(`   ${activeBonuses.length} bonus ACTIFS retournés:`);
    activeBonuses.forEach(b => {
      console.log(`   - ${b.name} (effect_type: ${b.effect_type})`);
      console.log(`     remaining_charges: ${b.remaining_charges}, is_active: ${b.is_active}`);
    });

    // 4. Simuler hasJokerBonus
    console.log('\n📋 4. SIMULATION hasJokerBonus()');
    const jokerFound = activeBonuses.find(bonus =>
      bonus.effect_type === 'joker' &&
      (bonus.remaining_charges > 0 || bonus.duration_type !== 'charges')
    );
    if (jokerFound) {
      console.log(`   ✅ Joker trouvé: ${jokerFound.name}`);
      console.log(`      remaining_charges: ${jokerFound.remaining_charges}`);
      console.log(`      duration_type: ${jokerFound.duration_type}`);
    } else {
      console.log('   ❌ Aucun joker actif trouvé!');

      // Analyser pourquoi
      const jokerInActive = activeBonuses.find(b => b.effect_type === 'joker');
      if (!jokerInActive) {
        console.log('   → Raison: Aucun bonus avec effect_type="joker" dans les bonus actifs');

        // Vérifier si le joker existe mais n'est pas actif
        const jokerInAll = playerBonuses.find(b => b.effect_type === 'joker');
        if (jokerInAll) {
          console.log(`   → Le joker EXISTE (ID: ${jokerInAll.id}) mais:`);
          console.log(`      is_active: ${jokerInAll.is_active}`);
          console.log(`      activated_at: ${jokerInAll.activated_at}`);
          if (!jokerInAll.is_active) {
            console.log('   💡 FIX: Le bonus n\'est pas marqué comme actif (is_active = FALSE)');
          }
          if (!jokerInAll.activated_at) {
            console.log('   💡 FIX: Le bonus n\'a pas été activé (activated_at = NULL)');
          }
        }
      }
    }

    // 5. Vérifier la requête brute de getActiveBonusesByPlayer
    console.log('\n📋 5. REQUÊTE BRUTE getActiveBonusesByPlayer');
    const rawResult = await db.queryAll(`
      SELECT pab.id, pab.bonus_id, pab.remaining_charges, pab.activated_at,
             pab.expires_at, pab.is_active,
             sb.name, sb.effect_type, sb.duration_type
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1 AND pab.user_id = $2 AND pab.is_active = TRUE
      AND (pab.expires_at IS NULL OR pab.expires_at > NOW())
      ORDER BY pab.activated_at DESC NULLS LAST
    `, [GUILD_ID, DISCORD_ID]);
    console.log(`   Résultat de la requête: ${rawResult.length} entrée(s)`);
    rawResult.forEach(r => {
      console.log(`   - ${r.name}: effect_type=${r.effect_type}, is_active=${r.is_active}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ Debug terminé');
    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

debug();
