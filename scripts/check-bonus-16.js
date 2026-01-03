const db = require('../utils/database-pg');

async function checkBonus16() {
  try {
    const guildId = '297309737135898624';

    console.log('🔍 VÉRIFICATION BONUS ID 16\n');
    console.log('='.repeat(80));

    const bonus16 = await db.queryOne(`
      SELECT pab.*, sb.name, sb.duration_type, sb.duration_value
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.id = 16 AND pab.guild_id = $1
    `, [guildId]);

    if (!bonus16) {
      console.log('❌ Bonus ID 16 introuvable\n');
      process.exit(1);
    }

    console.log('📋 BONUS ID 16:');
    console.log('-'.repeat(80));
    Object.keys(bonus16).forEach(key => {
      console.log(`   ${key}: ${bonus16[key]}`);
    });

    console.log('\n\n🔍 ANALYSE:');
    console.log('-'.repeat(80));
    console.log(`   name: ${bonus16.name}`);
    console.log(`   duration_type: ${bonus16.duration_type}`);
    console.log(`   duration_value: ${bonus16.duration_value}`);
    console.log(`   remaining_charges: ${bonus16.remaining_charges} ${bonus16.remaining_charges === null ? '❌ NULL!' : bonus16.remaining_charges > 0 ? '✅' : '❌ = 0'}`);
    console.log(`   activated_at: ${bonus16.activated_at} ${bonus16.activated_at === null ? '❌ NON ACTIVÉ' : '✅ ACTIVÉ'}`);
    console.log(`   is_active: ${bonus16.is_active}`);

    if (bonus16.remaining_charges === null || bonus16.remaining_charges === 0) {
      console.log('\n\n❌ PROBLÈME:');
      console.log(`   remaining_charges est ${bonus16.remaining_charges} au lieu d'un nombre > 0`);
      console.log('   Vision Divine ne pourra PAS se déclencher!\n');

      if (bonus16.duration_type === 'charges' && bonus16.duration_value) {
        console.log('💡 CORRECTION:');
        console.log(`   Mettre remaining_charges à ${bonus16.duration_value}\n`);

        await db.query(`
          UPDATE player_active_bonuses
          SET remaining_charges = $1
          WHERE id = 16 AND guild_id = $2
        `, [bonus16.duration_value, guildId]);

        console.log('✅ Correction appliquée!\n');
      }
    } else {
      console.log('\n✅ remaining_charges correct!\n');
    }

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkBonus16();
