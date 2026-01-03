const db = require('../utils/database-pg');

async function listSuperBonuses() {
  try {
    const guildId = '1248028543389143070'; // Serveur de test

    console.log('📋 LISTE DES SUPER BONUSES DISPONIBLES\n');
    console.log('='.repeat(80));

    const bonuses = await db.query(
      `SELECT id, bonus_id, name, icon, effect_type, duration_type, duration_value, activation_mode, rarity
       FROM super_bonuses
       WHERE guild_id = $1
       ORDER BY id`,
      [guildId]
    );

    if (bonuses.length === 0) {
      console.log('❌ Aucun super bonus configuré sur ce serveur\n');
      process.exit(1);
    }

    console.log(`✅ ${bonuses.length} super bonus disponibles:\n`);

    bonuses.forEach((bonus, index) => {
      console.log(`${index + 1}. ID: ${bonus.id} | Bonus ID: ${bonus.bonus_id || 'N/A'}`);
      console.log(`   ${bonus.icon || '✨'} ${bonus.name}`);
      console.log(`   Rareté: ${bonus.rarity || 'N/A'}`);
      console.log(`   Type d'effet: ${bonus.effect_type}`);
      console.log(`   Mode: ${bonus.activation_mode || 'manual'}`);
      console.log(`   Durée: ${bonus.duration_type} (${bonus.duration_value})`);
      console.log('');
    });

    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

listSuperBonuses();
