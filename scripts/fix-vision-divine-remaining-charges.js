const db = require('../utils/database-pg');

async function fixVisionDivineRemainingCharges() {
  try {
    const guildId = '297309737135898624';
    const userId = '297307186307006464';

    console.log('🔧 CORRECTION remaining_charges - Vision Divine\n');
    console.log('='.repeat(80));

    // 1. Trouver le player_id
    const player = await db.queryOne(`
      SELECT id FROM players WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, userId]);

    if (!player) {
      console.log('❌ Player introuvable\n');
      process.exit(1);
    }

    // 2. Trouver toutes les Vision Divine actives avec remaining_charges NULL
    console.log('\n📋 VISION DIVINE avec remaining_charges NULL:');
    console.log('-'.repeat(80));

    const brokenVisionDivines = await db.query(`
      SELECT pab.*, sb.name, sb.duration_value
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1
        AND pab.user_id = $2
        AND sb.name = 'Vision Divine'
        AND pab.is_active = TRUE
        AND pab.remaining_charges IS NULL
        AND sb.duration_type = 'charges'
    `, [guildId, userId]);

    console.log(`   Trouvé: ${brokenVisionDivines.length} entrée(s)\n`);

    if (brokenVisionDivines.length === 0) {
      console.log('   ✅ Aucune Vision Divine cassée trouvée\n');
      process.exit(0);
    }

    brokenVisionDivines.forEach((vd, i) => {
      console.log(`   ${i + 1}. Vision Divine (pab.id: ${vd.id})`);
      console.log(`      bonus_id: ${vd.bonus_id}`);
      console.log(`      remaining_charges: ${vd.remaining_charges} ❌`);
      console.log(`      duration_value: ${vd.duration_value}`);
      console.log(`      is_active: ${vd.is_active}\n`);
    });

    // 3. Corriger remaining_charges pour chaque Vision Divine
    console.log('\n🔧 CORRECTION:');
    console.log('-'.repeat(80));

    for (const vd of brokenVisionDivines) {
      console.log(`   Correction Vision Divine (pab.id: ${vd.id})...`);

      await db.query(`
        UPDATE player_active_bonuses
        SET remaining_charges = $1
        WHERE guild_id = $2 AND id = $3
      `, [vd.duration_value, guildId, vd.id]);

      console.log(`   ✅ remaining_charges mis à jour: NULL → ${vd.duration_value}\n`);
    }

    // 4. Vérifier le résultat
    console.log('\n📊 VÉRIFICATION FINALE:');
    console.log('-'.repeat(80));

    const fixedVisionDivines = await db.query(`
      SELECT pab.*, sb.name
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1
        AND pab.user_id = $2
        AND sb.name = 'Vision Divine'
        AND pab.is_active = TRUE
    `, [guildId, userId]);

    fixedVisionDivines.forEach((vd, i) => {
      console.log(`   ${i + 1}. Vision Divine (pab.id: ${vd.id})`);
      console.log(`      remaining_charges: ${vd.remaining_charges} ${vd.remaining_charges > 0 ? '✅' : '❌'}`);
      console.log(`      is_active: ${vd.is_active}\n`);
    });

    console.log('='.repeat(80));
    console.log('✅ Correction terminée!\n');
    console.log('📝 Vous pouvez maintenant ouvrir une mystery box et Vision Divine devrait se déclencher.\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

fixVisionDivineRemainingCharges();
