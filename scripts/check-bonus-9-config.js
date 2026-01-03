const db = require('../utils/database-pg');

async function checkBonus() {
  console.log('\n🔍 VÉRIFICATION - Configuration Bonus ID 9\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // Configuration du bonus ID 9
    const bonus = await db.queryOne(`
      SELECT *
      FROM super_bonuses
      WHERE id = 9 AND guild_id = $1
    `, [guildId]);

    console.log('\n📋 BONUS ID 9:\n');
    console.table([bonus]);

    console.log(`\n🔍 DÉTAILS:`);
    console.log(`   Nom: ${bonus.name}`);
    console.log(`   Icon: ${bonus.icon}`);
    console.log(`   Rareté: ${bonus.rarity}`);
    console.log(`   Type: ${bonus.effect_type}`);
    console.log(`   Mode d'activation: ${bonus.activation_mode}`);
    console.log(`   Duration type: ${bonus.duration_type}`);
    console.log(`   Duration value: ${bonus.duration_value}`);

    // Vérifier aussi le bonus ID 10
    const bonus10 = await db.queryOne(`
      SELECT *
      FROM super_bonuses
      WHERE id = 10 AND guild_id = $1
    `, [guildId]);

    console.log('\n📋 BONUS ID 10:\n');
    console.table([bonus10]);

    console.log(`\n🔍 DÉTAILS:`);
    console.log(`   Nom: ${bonus10.name}`);
    console.log(`   Icon: ${bonus10.icon}`);
    console.log(`   Rareté: ${bonus10.rarity}`);
    console.log(`   Type: ${bonus10.effect_type}`);
    console.log(`   Mode d'activation: ${bonus10.activation_mode}`);
    console.log(`   Duration type: ${bonus10.duration_type}`);
    console.log(`   Duration value: ${bonus10.duration_value}`);

    console.log('\n' + '='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkBonus();
