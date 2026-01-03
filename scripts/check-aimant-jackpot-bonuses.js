const db = require('../utils/database-pg');

async function checkAimantJackpotBonuses() {
  try {
    const guildId = '297309737135898624';

    console.log('🔍 VÉRIFICATION - Aimant à Légendaires & Jackpot x2\n');
    console.log('='.repeat(80));

    // Vérifier Aimant à Légendaires
    console.log('\n📊 AIMANT À LÉGENDAIRES:');
    console.log('-'.repeat(80));
    const aimant = await db.queryOne(`
      SELECT * FROM super_bonuses
      WHERE guild_id = $1 AND (name ILIKE '%aimant%' OR name ILIKE '%légendaire%')
    `, [guildId]);

    if (aimant) {
      console.log('✅ Trouvé!');
      console.log(`   ID: ${aimant.id}`);
      console.log(`   Name: ${aimant.name}`);
      console.log(`   bonus_type: ${aimant.bonus_type}`);
      console.log(`   effect_type: ${aimant.effect_type}`);
      console.log(`   effect_config: ${JSON.stringify(aimant.effect_config, null, 2)}`);
    } else {
      console.log('❌ Non trouvé - Doit être créé');
    }

    // Vérifier Jackpot x2
    console.log('\n\n📊 JACKPOT X2:');
    console.log('-'.repeat(80));
    const jackpot = await db.queryOne(`
      SELECT * FROM super_bonuses
      WHERE guild_id = $1 AND name ILIKE '%jackpot%'
    `, [guildId]);

    if (jackpot) {
      console.log('✅ Trouvé!');
      console.log(`   ID: ${jackpot.id}`);
      console.log(`   Name: ${jackpot.name}`);
      console.log(`   bonus_type: ${jackpot.bonus_type}`);
      console.log(`   effect_type: ${jackpot.effect_type}`);
      console.log(`   effect_config: ${JSON.stringify(jackpot.effect_config, null, 2)}`);
    } else {
      console.log('❌ Non trouvé - Doit être créé');
    }

    // Lister tous les super_bonuses pour voir ce qui existe
    console.log('\n\n📋 TOUS LES SUPER BONUSES:');
    console.log('-'.repeat(80));
    const allBonuses = await db.query(`
      SELECT id, name, bonus_type, effect_type
      FROM super_bonuses
      WHERE guild_id = $1
      ORDER BY id
    `, [guildId]);

    console.log(`   Total: ${allBonuses.length} bonus\n`);
    allBonuses.forEach((bonus, i) => {
      console.log(`   ${i + 1}. [ID ${bonus.id}] ${bonus.name}`);
      console.log(`      bonus_type: ${bonus.bonus_type}, effect_type: ${bonus.effect_type}`);
    });

    console.log('\n' + '='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkAimantJackpotBonuses();
