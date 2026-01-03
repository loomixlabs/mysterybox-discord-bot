const db = require('../utils/database-pg');

/**
 * Corriger l'activation_mode de l'Aimant à Légendaires pour qu'il soit manuel
 */

async function fixAimantActivationMode() {
  try {
    console.log('🔧 CORRECTIF - Aimant à Légendaires activation manuelle\n');
    console.log('='.repeat(80));

    // Récupérer tous les Aimants à Légendaires
    const aimants = await db.query(`
      SELECT id, guild_id, name, activation_mode
      FROM super_bonuses
      WHERE effect_type = 'rarity_boost'
      AND effect_config->>'target_rarity' = 'legendary'
    `);

    console.log(`\n📊 ${aimants.length} Aimant à Légendaires trouvé(s)\n`);

    for (const aimant of aimants) {
      console.log(`\n🔹 Guild ${aimant.guild_id} - ID ${aimant.id}:`);
      console.log(`   Nom: ${aimant.name}`);
      console.log(`   activation_mode actuel: ${aimant.activation_mode || 'NULL'}`);

      if (aimant.activation_mode !== 'manual') {
        console.log(`   ⚠️  INCORRECT - Mise à jour vers 'manual'...`);

        await db.query(`
          UPDATE super_bonuses
          SET activation_mode = 'manual'
          WHERE id = $1 AND guild_id = $2
        `, [aimant.id, aimant.guild_id]);

        console.log(`   ✅ Mis à jour!`);
      } else {
        console.log(`   ✅ Déjà correct`);
      }
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('📋 NOTE IMPORTANTE:\n');
    console.log(`Les instances DÉJÀ ACTIVÉES restent actives (c'est normal).`);
    console.log(`Cette modification affecte uniquement les NOUVEAUX Aimants à Légendaires reçus.`);
    console.log(`Les nouveaux Aimants nécessiteront une activation manuelle via /my-bonuses.`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Correctif terminé!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 ERREUR:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

fixAimantActivationMode();
