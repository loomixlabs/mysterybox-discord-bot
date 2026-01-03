const db = require('../utils/database-pg');

async function checkJackpot() {
  console.log('\n🔍 VÉRIFICATION - Jackpot x2 (ID 8)\n');
  console.log('='.repeat(80));

  try {
    const guildId = process.env.GUILD_ID || '1248028543389143070';

    // Configuration du bonus ID 8
    const bonus = await db.queryOne(`
      SELECT *
      FROM super_bonuses
      WHERE id = 8 AND guild_id = $1
    `, [guildId]);

    console.log('\n📋 BONUS ID 8 (Jackpot x2):\n');
    console.table([bonus]);

    console.log(`\n🔍 DÉTAILS:`);
    console.log(`   Nom: ${bonus.name}`);
    console.log(`   Icon: ${bonus.icon}`);
    console.log(`   Rareté: ${bonus.rarity}`);
    console.log(`   Type: ${bonus.effect_type}`);
    console.log(`   Mode d'activation: ${bonus.activation_mode}`);
    console.log(`   Duration type: ${bonus.duration_type}`);
    console.log(`   Duration value: ${bonus.duration_value}`);

    // Vérifier les bonus actifs pour le joueur
    console.log('\n💼 BONUS ACTIFS POUR VOUS:\n');
    const activeBonuses = await db.queryAll(`
      SELECT
        pab.id,
        sb.name,
        sb.activation_mode,
        pab.activated_at,
        pab.expires_at,
        pab.remaining_charges,
        pab.is_active
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.bonus_id = sb.id
      WHERE pab.guild_id = $1
      AND pab.user_id = '297307186307006464'
      AND pab.is_active = true
      ORDER BY pab.id DESC
    `, [guildId]);

    if (activeBonuses.length > 0) {
      console.table(activeBonuses);

      const jackpotBonus = activeBonuses.find(b => b.name === 'Jackpot x2');
      if (jackpotBonus) {
        console.log('\n✅ Jackpot x2 est déjà actif !');
        console.log(`   Mode: ${jackpotBonus.activation_mode}`);
        console.log(`   Activé: ${jackpotBonus.activated_at ? 'OUI' : 'NON (en attente)'}`);
        console.log(`   Charges restantes: ${jackpotBonus.remaining_charges || 'N/A'}`);
      }
    } else {
      console.log('⚠️  Aucun bonus actif');
    }

    console.log('\n💡 NOTE SUR LE CUMUL:');
    console.log('   • Les bonus NE SONT PAS cumulables');
    console.log('   • Vous ne pouvez avoir qu\'UNE SEULE instance de chaque bonus actif');
    console.log('   • Cela s\'applique aux bonus automatiques ET manuels');
    console.log('   • Si vous avez déjà "Jackpot x2", vous devez l\'utiliser ou attendre qu\'il expire');

    console.log('\n' + '='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkJackpot();
