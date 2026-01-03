require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('../utils/database-pg');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = '1248028543389143070';
const ROLE_ID = '1437539197987852388';
const THEME_ID = 23;

async function fixAllRoles() {
  try {
    await client.login(process.env.DISCORD_TOKEN);

    console.log('🔧 ATTRIBUTION DES RÔLES POUR TOUS LES JOUEURS AYANT COMPLÉTÉ LA COLLECTION\n');
    console.log('='.repeat(80));

    // Récupérer tous les joueurs avec collection complétée
    const completedPlayers = await db.queryAll(`
      SELECT pp.*, p.username, p.discord_id
      FROM player_progress pp
      JOIN players p ON pp.player_id = p.id
      WHERE pp.guild_id = $1
        AND pp.theme_id = $2
        AND pp.is_completed = TRUE
      ORDER BY pp.completed_at DESC
    `, [GUILD_ID, THEME_ID]);

    console.log(`📋 ${completedPlayers.length} joueur(s) avec collection complétée\n`);

    const guild = await client.guilds.fetch(GUILD_ID);
    const role = guild.roles.cache.get(ROLE_ID);

    if (!role) {
      console.log('❌ Rôle introuvable !');
      await client.destroy();
      return process.exit(1);
    }

    console.log(`✅ Rôle: ${role.name} (${role.id})\n`);
    console.log('='.repeat(80));

    let fixed = 0;
    let alreadyHas = 0;
    let errors = 0;

    for (const player of completedPlayers) {
      console.log(`\n👤 ${player.username} (${player.discord_id})`);
      console.log(`   Complété le: ${new Date(player.completed_at).toLocaleString('fr-FR')}`);

      try {
        const member = await guild.members.fetch(player.discord_id);
        const hasRole = member.roles.cache.has(ROLE_ID);

        if (hasRole) {
          console.log('   ✅ Possède déjà le rôle');
          alreadyHas++;
        } else {
          await member.roles.add(role);
          console.log('   🔧 Rôle attribué !');
          fixed++;
        }
      } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ:\n');
    console.table({
      'Total joueurs': completedPlayers.length,
      'Possédaient déjà': alreadyHas,
      'Rôles attribués': fixed,
      'Erreurs': errors
    });

    console.log('\n✅ Traitement terminé !');

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await client.destroy();
    process.exit(1);
  }
}

fixAllRoles();
