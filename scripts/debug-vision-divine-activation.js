const db = require('../utils/database-pg');

async function debugVisionDivineActivation() {
  try {
    const guildId = '297309737135898624'; // BON serveur de test
    const userId = '297307186307006464'; // xmicordix

    console.log('🔍 DEBUG VISION DIVINE - ACTIVATION\\n');
    console.log(`   Guild ID: ${guildId}`);
    console.log(`   User ID: ${userId}\\n`);
    console.log('='.repeat(80));

    // 1. Récupérer le player
    const player = await db.queryOne(
      `SELECT id, username FROM players WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, userId]
    );

    if (!player) {
      console.log('❌ Joueur introuvable\\n');
      process.exit(1);
    }

    console.log(`✅ Player: ${player.username} (ID: ${player.id})\\n`);

    // 2. Vérifier le super bonus Vision Divine
    console.log('📋 SUPER BONUS "Vision Divine":');
    console.log('-'.repeat(80));
    const visionDivineBonus = await db.queryOne(`
      SELECT * FROM super_bonuses
      WHERE guild_id = $1 AND name = 'Vision Divine'
    `, [guildId]);

    if (!visionDivineBonus) {
      console.log('❌ Super bonus "Vision Divine" introuvable!\\n');
      process.exit(1);
    }

    console.log(`   ID: ${visionDivineBonus.id}`);
    console.log(`   Name: ${visionDivineBonus.name}`);
    console.log(`   Type: ${visionDivineBonus.bonus_type}`);
    console.log(`   Uses charges: ${visionDivineBonus.uses_charges}`);
    console.log(`   Max charges: ${visionDivineBonus.max_charges}\\n`);

    // 3. Vérifier les bonus actifs pour ce joueur
    console.log('📊 BONUS ACTIFS POUR CE JOUEUR:');
    console.log('-'.repeat(80));
    const activeBonus = await db.query(`
      SELECT pab.*, sb.name, sb.bonus_type, sb.uses_charges, sb.max_charges
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.super_bonus_id = sb.id
      WHERE pab.guild_id = $1 AND pab.player_id = $2
      ORDER BY pab.activated_at DESC
    `, [guildId, player.id]);

    console.log(`   Total: ${activeBonus.length} bonus actif(s)\\n`);

    if (activeBonus.length === 0) {
      console.log('   ❌ Aucun bonus actif trouvé!\\n');
    } else {
      const now = new Date();
      activeBonus.forEach((bonus, i) => {
        console.log(`\\n   ${i + 1}. ${bonus.name} (ID: ${bonus.id})`);
        console.log(`      Super Bonus ID: ${bonus.super_bonus_id}`);
        console.log(`      Type: ${bonus.bonus_type}`);
        console.log(`      Uses charges: ${bonus.uses_charges}`);
        console.log(`      Max charges: ${bonus.max_charges}`);
        console.log(`      Charges restantes: ${bonus.charges_remaining}`);
        console.log(`      Activé: ${new Date(bonus.activated_at).toLocaleString('fr-FR')}`);

        if (bonus.expires_at) {
          const expiresAt = new Date(bonus.expires_at);
          const isExpired = expiresAt <= now;
          console.log(`      Expire: ${expiresAt.toLocaleString('fr-FR')}`);
          console.log(`      Statut: ${isExpired ? '❌ EXPIRÉ' : '✅ ACTIF'}`);
        } else {
          console.log(`      Expire: Jamais (bonus permanent jusqu'à épuisement des charges)`);
          console.log(`      Statut: ${bonus.charges_remaining > 0 ? '✅ ACTIF' : '❌ CHARGES ÉPUISÉES'}`);
        }
      });
    }

    // 4. Vérifier la logique de checkAndRevealVisionDivine
    console.log('\\n\\n🔍 SIMULATION DE checkAndRevealVisionDivine:');
    console.log('-'.repeat(80));

    // Simuler la requête exacte utilisée dans le handler
    const revealBonus = await db.queryOne(`
      SELECT pab.*, sb.name, sb.bonus_type, sb.effect_type
      FROM player_active_bonuses pab
      JOIN super_bonuses sb ON pab.super_bonus_id = sb.id
      WHERE pab.player_id = (SELECT id FROM players WHERE discord_id = $1 AND guild_id = $2)
      AND pab.guild_id = $2
      AND sb.bonus_type = 'reveal'
      AND (pab.expires_at IS NULL OR pab.expires_at > NOW())
      AND pab.charges_remaining > 0
      LIMIT 1
    `, [userId, guildId]);

    if (!revealBonus) {
      console.log('   ❌ Aucun bonus de révélation actif trouvé!\\n');
      console.log('   Raisons possibles:');
      console.log('   - bonus_type n\'est pas "reveal"');
      console.log('   - charges_remaining est à 0');
      console.log('   - expires_at est dans le passé');
      console.log('   - player_id ne correspond pas\\n');
    } else {
      console.log('   ✅ Bonus de révélation trouvé!');
      console.log(`   ID: ${revealBonus.id}`);
      console.log(`   Name: ${revealBonus.name}`);
      console.log(`   Charges restantes: ${revealBonus.charges_remaining}\\n`);
    }

    // 5. Logs des bonus usage récents
    console.log('\\n📋 LOGS D\'UTILISATION RÉCENTS (5 derniers):');
    console.log('-'.repeat(80));
    const usageLogs = await db.query(`
      SELECT sbu.*, sb.name, sb.bonus_type
      FROM super_bonus_usage sbu
      JOIN super_bonuses sb ON sbu.super_bonus_id = sb.id
      WHERE sbu.guild_id = $1 AND sbu.player_id = $2
      ORDER BY sbu.used_at DESC
      LIMIT 5
    `, [guildId, player.id]);

    console.log(`   Total: ${usageLogs.length} utilisation(s)\\n`);

    usageLogs.forEach((log, i) => {
      console.log(`   ${i + 1}. ${log.name} (${log.bonus_type})`);
      console.log(`      Utilisé: ${new Date(log.used_at).toLocaleString('fr-FR')}`);
      console.log(`      Action: ${log.action_type || 'N/A'}\\n`);
    });

    console.log('\\n' + '='.repeat(80));
    console.log('✅ Debug terminé\\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

debugVisionDivineActivation();
