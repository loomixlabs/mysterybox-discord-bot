const db = require('../utils/database-pg');

/**
 * Vérification finale de l'état des bonus Aimant et Jackpot
 */

async function verifyBonusesFinalState() {
  try {
    console.log('🔍 VÉRIFICATION FINALE - État des Bonus\n');
    console.log('='.repeat(80));

    // 1. Vérifier les configurations dans super_bonuses
    console.log('\n📋 SUPER_BONUSES - Configuration:\n');

    const bonuses = await db.query(`
      SELECT id, guild_id, name, activation_mode, effect_type,
             effect_config, duration_type, duration_value, rarity
      FROM super_bonuses
      WHERE effect_type IN ('rarity_boost', 'multiplier')
      ORDER BY guild_id, effect_type
    `);

    bonuses.forEach(b => {
      const isCorrect =
        (b.effect_type === 'rarity_boost' && b.activation_mode === 'manual') ||
        (b.effect_type === 'multiplier' && b.activation_mode === 'automatic');

      console.log(`${isCorrect ? '✅' : '❌'} Guild ${b.guild_id} - ${b.name}:`);
      console.log(`   ID: ${b.id}`);
      console.log(`   Type: ${b.effect_type}`);
      console.log(`   activation_mode: ${b.activation_mode} ${isCorrect ? '✅' : '❌ INCORRECT'}`);
      console.log(`   duration_type: ${b.duration_type}`);
      console.log(`   duration_value: ${b.duration_value}`);
      console.log(`   effect_config: ${JSON.stringify(b.effect_config)}\n`);
    });

    // 2. Vérifier les instances actives dans player_active_bonuses
    console.log('='.repeat(80));
    console.log('\n📋 PLAYER_ACTIVE_BONUSES - Instances:\n');

    const instances = await db.query(`
      SELECT pab.id, pab.user_id, pab.guild_id, pab.activated_at,
             pab.remaining_charges, pab.expires_at, pab.is_active,
             sb.name, sb.activation_mode, sb.effect_type
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE sb.effect_type IN ('rarity_boost', 'multiplier')
      ORDER BY pab.guild_id, sb.effect_type, pab.user_id
    `);

    if (instances.length > 0) {
      instances.forEach(i => {
        const shouldBeActivated = i.activation_mode === 'automatic';
        const isActivated = i.activated_at !== null;
        const stateCorrect = shouldBeActivated === isActivated;

        console.log(`${stateCorrect ? '✅' : '❌'} ${i.name} - User ${i.user_id} (Guild ${i.guild_id}):`);
        console.log(`   Instance ID: ${i.id}`);
        console.log(`   activation_mode: ${i.activation_mode}`);
        console.log(`   activated_at: ${i.activated_at || 'NULL'} ${isActivated ? '✅ ACTIF' : '⏸️  EN ATTENTE'}`);
        console.log(`   remaining_charges: ${i.remaining_charges || 'N/A'}`);
        console.log(`   expires_at: ${i.expires_at || 'N/A'}`);
        console.log(`   is_active: ${i.is_active}`);

        if (!stateCorrect) {
          console.log(`   ⚠️  PROBLÈME: ${shouldBeActivated ? 'Devrait être activé' : 'Ne devrait pas être activé'}`);
        }
        console.log();
      });
    } else {
      console.log('Aucune instance active trouvée\n');
    }

    // 3. Résumé
    console.log('='.repeat(80));
    console.log('\n📊 RÉSUMÉ:\n');

    const aimants = bonuses.filter(b => b.effect_type === 'rarity_boost');
    const jackpots = bonuses.filter(b => b.effect_type === 'multiplier');

    console.log(`🧲 Aimant à Légendaires:`);
    console.log(`   Total: ${aimants.length}`);
    console.log(`   Config correcte (manual): ${aimants.filter(a => a.activation_mode === 'manual').length}/${aimants.length}`);

    console.log(`\n💰 Jackpot x2:`);
    console.log(`   Total: ${jackpots.length}`);
    console.log(`   Config correcte (automatic): ${jackpots.filter(j => j.activation_mode === 'automatic').length}/${jackpots.length}`);

    console.log(`\n📦 Instances actives:`);
    console.log(`   Total: ${instances.length}`);
    const activeInstances = instances.filter(i => i.activated_at !== null);
    console.log(`   Activées: ${activeInstances.length}/${instances.length}`);
    console.log(`   Correctement configurées: ${instances.filter(i =>
      (i.activation_mode === 'automatic' && i.activated_at !== null) ||
      (i.activation_mode === 'manual' && i.activated_at === null)
    ).length}/${instances.length}`);

    console.log('\n' + '='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('🔴 ERREUR:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

verifyBonusesFinalState();
