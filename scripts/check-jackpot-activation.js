const db = require('../utils/database-pg');

async function checkJackpotActivation() {
  try {
    console.log('🔍 VÉRIFICATION - Jackpot x2 activation_mode\n');
    console.log('='.repeat(80));

    // 1. Vérifier les Jackpot x2 dans super_bonuses
    console.log('\n📋 SUPER_BONUSES - Jackpot x2:\n');

    const jackpots = await db.query(`
      SELECT id, guild_id, name, activation_mode, effect_type, effect_config
      FROM super_bonuses
      WHERE effect_type = 'multiplier'
      AND effect_config->>'applies_to' = 'collectible'
      ORDER BY guild_id, id
    `);

    console.log(`Total: ${jackpots.length} Jackpot x2 dans super_bonuses\n`);

    jackpots.forEach(j => {
      console.log(`🔹 Guild ${j.guild_id} - ID ${j.id}:`);
      console.log(`   Nom: ${j.name}`);
      console.log(`   activation_mode: ${j.activation_mode || 'NULL'} ${j.activation_mode === 'automatic' ? '✅' : '❌'}`);
      console.log(`   effect_config: ${JSON.stringify(j.effect_config)}\n`);
    });

    // 2. Vérifier les instances dans player_active_bonuses
    console.log('\n' + '='.repeat(80));
    console.log('📋 PLAYER_ACTIVE_BONUSES - Instances de Jackpot x2:\n');

    const instances = await db.query(`
      SELECT pab.id, pab.user_id, pab.guild_id, pab.activated_at,
             pab.remaining_charges, pab.is_active, sb.name, sb.activation_mode
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE sb.effect_type = 'multiplier'
      AND sb.effect_config->>'applies_to' = 'collectible'
      ORDER BY pab.guild_id, pab.user_id
    `);

    console.log(`Total: ${instances.length} instance(s) de Jackpot x2\n`);

    if (instances.length > 0) {
      instances.forEach(i => {
        console.log(`🔹 Guild ${i.guild_id} - User ${i.user_id}:`);
        console.log(`   Nom: ${i.name}`);
        console.log(`   activation_mode: ${i.activation_mode || 'NULL'}`);
        console.log(`   activated_at: ${i.activated_at || 'NULL'} ${i.activated_at ? '✅ ACTIF' : '❌ NON ACTIVÉ'}`);
        console.log(`   remaining_charges: ${i.remaining_charges || 'NULL'}`);
        console.log(`   is_active: ${i.is_active}\n`);
      });
    } else {
      console.log('Aucune instance trouvée\n');
    }

    // 3. Vérifier aussi l'Aimant à Légendaires pour comparaison
    console.log('\n' + '='.repeat(80));
    console.log('📋 COMPARAISON - Aimant à Légendaires:\n');

    const aimants = await db.query(`
      SELECT id, guild_id, name, activation_mode, effect_type
      FROM super_bonuses
      WHERE effect_type = 'rarity_boost'
      ORDER BY guild_id, id
    `);

    aimants.forEach(a => {
      console.log(`🔹 Guild ${a.guild_id} - ID ${a.id}:`);
      console.log(`   Nom: ${a.name}`);
      console.log(`   activation_mode: ${a.activation_mode || 'NULL'} ${a.activation_mode === 'manual' ? '✅' : '❓'}`);
      console.log(`   (Devrait être "manual" car Aimant s'active manuellement)\n`);
    });

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkJackpotActivation();
