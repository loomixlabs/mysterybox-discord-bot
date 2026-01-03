/**
 * Script pour récompenser les gagnants du mini-jeu Harry Potter
 * - Attribue le Super Bonus Joker à chaque gagnant
 * - Envoie un DM de félicitations
 *
 * Usage: node scripts/reward-minigame-winners.js
 *
 * IMPORTANT: Mettre DRY_RUN = false pour exécuter réellement
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  GUILD_ID: '1182395170273099806',           // Serveur Harry Potter
  JOKER_BONUS_ID: 123,                        // ID du Super Bonus Joker
  MINI_GAME_NAME: 'Vif d\'Or',                // Mini-jeu Harry Potter
  DRY_RUN: false,                             // true = simulation, false = exécution réelle
  REWARD_SOURCE: 'mini_game_reward'           // Source pour traçabilité
};

// ============================================
// DATABASE CONNECTION
// ============================================
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
  port: process.env.DB_PORT || process.env.POSTGRES_PORT || 5432,
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'botdb',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'botuser',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD
});

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// ============================================
// DISCORD CLIENT
// ============================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Crée l'embed de félicitations - Thème Harry Potter
 */
function createCongratulationsEmbed(winner, bonusInfo) {
  return new EmbedBuilder()
    .setTitle('⚡ Tu as attrapé le Vif d\'Or ! ⚡')
    .setDescription(
      `✨ **Félicitations ${winner.username || 'jeune sorcier(ère)'} !** ✨\n\n` +
      `Tu as fait preuve d'une agilité digne des meilleurs Attrapeurs de Poudlard !\n\n` +
      `En récompense de ta victoire au mini-jeu **${CONFIG.MINI_GAME_NAME}**, ` +
      `tu reçois un pouvoir légendaire...\n\n` +
      `🃏 **LE MYSTERYBOX JOKER** 🃏`
    )
    .addFields(
      {
        name: '🃏 Pouvoir du MysteryBox Joker',
        value:
          'Ce bonus **légendaire** te permet de choisir **immédiatement** ' +
          'un collectible de ton choix parmi tous ceux qui te manquent !\n\n' +
          '👑 *Légendaire, Épique, Rare ou Commun... à toi de décider !*\n\n' +
          '⚠️ **Usage unique** - Garde-le précieusement jusqu\'au moment idéal !',
        inline: false
      },
      {
        name: '⚡ Comment l\'utiliser ?',
        value:
          '1️⃣ Rends-toi sur le serveur **Monopoly Go! FR** 🎲\n' +
          '2️⃣ Utilise la commande `/profile`\n' +
          '3️⃣ Va dans l\'onglet **Mes Bonus**\n' +
          '4️⃣ Clique sur **Activer** à côté du Joker\n' +
          '5️⃣ Choisis le collectible de tes rêves !',
        inline: false
      }
    )
    .setColor(0xFFD700) // Or du Vif d'Or
    .setFooter({ text: '⚡ MysteryBox × Monopoly Go! FR 🎲 • Que la magie soit avec toi !' })
    .setTimestamp();
}

/**
 * Vérifie si un gagnant a déjà reçu la récompense
 */
async function hasAlreadyBeenRewarded(discordId) {
  const existing = await queryOne(`
    SELECT id FROM player_active_bonuses
    WHERE guild_id = $1
    AND user_id = $2
    AND bonus_id = $3
    AND obtained_from = $4
  `, [CONFIG.GUILD_ID, discordId, CONFIG.JOKER_BONUS_ID, CONFIG.REWARD_SOURCE]);

  return !!existing;
}

/**
 * Attribue le bonus Joker à un gagnant
 */
async function giveJokerBonus(discordId) {
  await query(`
    INSERT INTO player_active_bonuses
    (guild_id, user_id, bonus_id, is_active, remaining_charges, obtained_from)
    VALUES ($1, $2, $3, true, 1, $4)
  `, [CONFIG.GUILD_ID, discordId, CONFIG.JOKER_BONUS_ID, CONFIG.REWARD_SOURCE]);
}

/**
 * Envoie le DM de félicitations
 */
async function sendCongratulationsDM(discordId) {
  try {
    const user = await client.users.fetch(discordId);
    if (!user) {
      return { success: false, error: 'Utilisateur introuvable' };
    }

    const embed = createCongratulationsEmbed({ username: user.username }, null);
    await user.send({ embeds: [embed] });

    return { success: true };
  } catch (error) {
    if (error.code === 50007) {
      return { success: false, error: 'DMs fermés' };
    }
    return { success: false, error: error.message };
  }
}

// ============================================
// SCRIPT PRINCIPAL
// ============================================
async function main() {
  console.log('='.repeat(60));
  console.log('🎁 RÉCOMPENSE DES GAGNANTS DU MINI-JEU');
  console.log('='.repeat(60));
  console.log(`\n📍 Configuration:`);
  console.log(`   Serveur: ${CONFIG.GUILD_ID}`);
  console.log(`   Mini-jeu: ${CONFIG.MINI_GAME_NAME}`);
  console.log(`   Bonus ID: ${CONFIG.JOKER_BONUS_ID}`);
  console.log(`   Mode: ${CONFIG.DRY_RUN ? '🔵 SIMULATION (DRY_RUN)' : '🟢 EXÉCUTION RÉELLE'}`);

  // Récupérer les gagnants depuis la table apple_game_winners
  // Note: La table utilise user_id (pas discord_id) et n'a pas de colonne username
  console.log('\n📋 Récupération des gagnants...');
  const winners = await query(`
    SELECT id, user_id, won_at
    FROM apple_game_winners
    WHERE guild_id = $1
    ORDER BY won_at ASC
  `, [CONFIG.GUILD_ID]);

  console.log(`   ${winners.length} gagnant(s) trouvé(s)\n`);

  if (winners.length === 0) {
    console.log('⚠️  Aucun gagnant à récompenser.');
    return;
  }

  // Récupérer les pseudos via Discord API
  console.log('🔍 Récupération des pseudos Discord...\n');
  const winnersWithUsernames = [];
  for (const winner of winners) {
    try {
      const user = await client.users.fetch(winner.user_id);
      winnersWithUsernames.push({
        ...winner,
        discordId: winner.user_id,
        username: user.username
      });
      console.log(`   ✅ ${user.username} (${winner.user_id})`);
    } catch (error) {
      winnersWithUsernames.push({
        ...winner,
        discordId: winner.user_id,
        username: 'Utilisateur inconnu'
      });
      console.log(`   ⚠️ ID ${winner.user_id} - Impossible de récupérer le pseudo`);
    }
  }

  // Traiter chaque gagnant
  const results = {
    success: [],
    alreadyRewarded: [],
    dmFailed: [],
    errors: []
  };

  console.log('\n🎁 Attribution des récompenses...\n');

  for (const winner of winnersWithUsernames) {
    const discordId = winner.discordId;
    const username = winner.username;

    process.stdout.write(`   ${username} (${discordId}): `);

    // Vérifier si déjà récompensé
    const alreadyRewarded = await hasAlreadyBeenRewarded(discordId);
    if (alreadyRewarded) {
      console.log('⏭️  Déjà récompensé');
      results.alreadyRewarded.push({ discordId, username });
      continue;
    }

    if (CONFIG.DRY_RUN) {
      console.log('🔵 [DRY_RUN] Serait récompensé');
      results.success.push({ discordId, username, dryRun: true });
      continue;
    }

    try {
      // Attribuer le bonus
      await giveJokerBonus(discordId);

      // Envoyer le DM
      const dmResult = await sendCongratulationsDM(discordId);

      if (dmResult.success) {
        console.log('✅ Bonus attribué + DM envoyé');
        results.success.push({ discordId, username, dmSent: true });
      } else {
        console.log(`✅ Bonus attribué, ⚠️ DM échoué (${dmResult.error})`);
        results.success.push({ discordId, username, dmSent: false, dmError: dmResult.error });
        results.dmFailed.push({ discordId, username, error: dmResult.error });
      }
    } catch (error) {
      console.log(`❌ Erreur: ${error.message}`);
      results.errors.push({ discordId, username, error: error.message });
    }
  }

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(60));
  console.log(`   ✅ Récompensés: ${results.success.length}`);
  console.log(`   ⏭️  Déjà récompensés: ${results.alreadyRewarded.length}`);
  console.log(`   ⚠️  DM échoués: ${results.dmFailed.length}`);
  console.log(`   ❌ Erreurs: ${results.errors.length}`);

  if (CONFIG.DRY_RUN) {
    console.log('\n🔵 MODE SIMULATION - Aucune modification effectuée');
    console.log('   Pour exécuter réellement, mettre DRY_RUN = false');
  }

  // Détails des DM échoués
  if (results.dmFailed.length > 0) {
    console.log('\n⚠️  Joueurs avec DM échoués (bonus attribué quand même):');
    results.dmFailed.forEach(f => {
      console.log(`   - ${f.username}: ${f.error}`);
    });
  }

  // Détails des erreurs
  if (results.errors.length > 0) {
    console.log('\n❌ Erreurs lors du traitement:');
    results.errors.forEach(e => {
      console.log(`   - ${e.username}: ${e.error}`);
    });
  }
}

// ============================================
// EXÉCUTION
// ============================================
client.once('ready', async () => {
  console.log(`\n🤖 Bot connecté: ${client.user.tag}\n`);

  try {
    await main();
  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
  } finally {
    await pool.end();
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
