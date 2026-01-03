/**
 * Script pour attribuer le rôle final aux joueurs qui ont complété la collection
 * mais n'ont pas reçu le rôle
 */

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../utils/database-pg');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = '1248028543389143070';

async function fixMissingRoles() {
  try {
    console.log('🔧 Démarrage du fix des rôles manquants...\n');

    // Attendre que le bot soit prêt
    await new Promise(resolve => client.once('ready', resolve));
    console.log(`✅ Bot connecté: ${client.user.tag}`);

    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) {
      console.error('❌ Guild non trouvée');
      process.exit(1);
    }

    // Récupérer le thème actif et son rôle final
    const theme = await db.queryOne(`
      SELECT id, name, final_role_discord_id, required_items
      FROM themes
      WHERE guild_id = $1 AND is_active = true
    `, [GUILD_ID]);

    if (!theme) {
      console.error('❌ Aucun thème actif trouvé');
      process.exit(1);
    }

    console.log(`📦 Thème actif: ${theme.name}`);
    console.log(`🎯 Rôle final: ${theme.final_role_discord_id}`);
    console.log(`📊 Items requis: ${theme.required_items}\n`);

    // Récupérer les joueurs qui ont complété mais n'ont peut-être pas le rôle
    const completedPlayers = await db.queryAll(`
      SELECT p.discord_id, p.username, pp.collected_count, pp.is_completed
      FROM players p
      JOIN player_progress pp ON p.id = pp.player_id AND p.guild_id = pp.guild_id
      WHERE p.guild_id = $1
        AND pp.theme_id = $2
        AND pp.is_completed = true
    `, [GUILD_ID, theme.id]);

    console.log(`👥 ${completedPlayers.length} joueurs ont complété la collection\n`);

    let rolesAdded = 0;
    let alreadyHaveRole = 0;
    let errors = 0;

    for (const player of completedPlayers) {
      try {
        const member = await guild.members.fetch(player.discord_id);

        if (member.roles.cache.has(theme.final_role_discord_id)) {
          console.log(`✅ ${player.username} - a déjà le rôle`);
          alreadyHaveRole++;
        } else {
          await member.roles.add(theme.final_role_discord_id);
          console.log(`🎉 ${player.username} - RÔLE AJOUTÉ !`);
          rolesAdded++;
        }
      } catch (err) {
        if (err.code === 10007) {
          console.log(`⚠️  ${player.username} - membre non trouvé sur le serveur`);
        } else {
          console.error(`❌ ${player.username} - erreur:`, err.message);
        }
        errors++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSUMÉ:');
    console.log(`   ✅ Rôles ajoutés: ${rolesAdded}`);
    console.log(`   ⚪ Déjà le rôle: ${alreadyHaveRole}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log('='.repeat(50));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

client.login(process.env.DISCORD_TOKEN);
fixMissingRoles();
