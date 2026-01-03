const db = require('../utils/database-pg');

/**
 * Corriger l'activation_mode de Jackpot x2 pour qu'il soit automatique
 */

async function fixJackpotActivationMode() {
  try {
    console.log('🔧 CORRECTIF - Jackpot x2 activation automatique\n');
    console.log('='.repeat(80));

    // Récupérer tous les Jackpot x2
    const jackpots = await db.query(`
      SELECT id, guild_id, name, activation_mode
      FROM super_bonuses
      WHERE (name ILIKE '%jackpot%' OR effect_type = 'multiplier')
      AND effect_config->>'applies_to' = 'collectible'
    `);

    console.log(`\n📊 ${jackpots.length} Jackpot x2 trouvé(s)\n`);

    for (const jackpot of jackpots) {
      console.log(`\n🔹 Guild ${jackpot.guild_id} - ID ${jackpot.id}:`);
      console.log(`   Nom: ${jackpot.name}`);
      console.log(`   activation_mode actuel: ${jackpot.activation_mode || 'NULL'}`);

      if (jackpot.activation_mode !== 'automatic') {
        console.log(`   ⚠️  INCORRECT - Mise à jour vers 'automatic'...`);

        await db.query(`
          UPDATE super_bonuses
          SET activation_mode = 'automatic'
          WHERE id = $1 AND guild_id = $2
        `, [jackpot.id, jackpot.guild_id]);

        console.log(`   ✅ Mis à jour!`);
      } else {
        console.log(`   ✅ Déjà correct`);
      }
    }

    // Aussi activer automatiquement les Jackpot x2 déjà reçus mais non activés
    console.log('\n\n' + '='.repeat(80));
    console.log('🔧 ACTIVATION DES JACKPOT X2 EXISTANTS NON ACTIVÉS\n');

    const inactiveBonuses = await db.query(`
      SELECT pab.id, pab.user_id, pab.guild_id, sb.name, sb.duration_value
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE sb.effect_type = 'multiplier'
      AND sb.effect_config->>'applies_to' = 'collectible'
      AND pab.activated_at IS NULL
    `);

    console.log(`📊 ${inactiveBonuses.length} Jackpot x2 non activé(s) trouvé(s)\n`);

    for (const bonus of inactiveBonuses) {
      console.log(`\n🔹 Player ${bonus.user_id} - Guild ${bonus.guild_id}:`);
      console.log(`   Bonus: ${bonus.name}`);
      console.log(`   Charges: ${bonus.duration_value}`);
      console.log(`   ⚠️  Non activé - Activation automatique...`);

      await db.query(`
        UPDATE player_active_bonuses
        SET activated_at = NOW(),
            remaining_charges = $1
        WHERE id = $2 AND guild_id = $3
      `, [bonus.duration_value, bonus.id, bonus.guild_id]);

      console.log(`   ✅ Activé avec ${bonus.duration_value} charge(s)!`);
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ Correctif terminé!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 ERREUR:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

fixJackpotActivationMode();
