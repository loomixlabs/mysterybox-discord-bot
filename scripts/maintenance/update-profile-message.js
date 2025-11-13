const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./utils/database-pg');
require('dotenv').config();

async function updateProfileMessage() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  try {
    console.log('🤖 Connexion au bot Discord...\n');
    await client.login(process.env.DISCORD_TOKEN);

    const guildId = '1248028543389143070';
    const messageId = '1438267586495119380';

    console.log('✅ Bot connecté !\n');
    console.log(`🔍 Récupération du message ${messageId}...\n`);

    const guild = await client.guilds.fetch(guildId);

    // Chercher le message dans tous les canaux
    let foundMessage = null;
    let foundChannel = null;

    const channels = await guild.channels.fetch();

    for (const [channelId, channel] of channels) {
      if (channel.isTextBased()) {
        try {
          const message = await channel.messages.fetch(messageId);
          if (message) {
            foundMessage = message;
            foundChannel = channel;
            break;
          }
        } catch (error) {
          // Message pas dans ce canal, continuer
        }
      }
    }

    if (!foundMessage) {
      console.log('❌ Message introuvable');
      console.log('💡 Vérifiez que l\'ID du message est correct');
      await client.destroy();
      process.exit(1);
    }

    console.log(`✅ Message trouvé dans #${foundChannel.name}`);
    console.log(`   Auteur: ${foundMessage.author.tag}`);
    console.log(`   Contenu: ${foundMessage.content.substring(0, 100)}...\n`);

    // Trouver le joueur dans la base de données
    const player = await db.queryOne(`
      SELECT id, username, discord_id FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, foundMessage.author.id]);

    if (!player) {
      console.log('❌ Joueur introuvable dans la base de données');
      await client.destroy();
      process.exit(1);
    }

    console.log(`👤 Joueur: ${player.username} (ID: ${player.id})\n`);

    // Récupérer la progression mise à jour
    const progress = await db.queryOne(`
      SELECT pp.collected_count, t.required_items, t.name as theme_name
      FROM player_progress pp
      JOIN themes t ON pp.theme_id = t.id
      WHERE pp.guild_id = $1 AND pp.player_id = $2
    `, [guildId, player.id]);

    // Récupérer les collectibles
    const collectibles = await db.queryAll(`
      SELECT col.name, col.rarity, c.source
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
      ORDER BY col.rarity DESC, col.name
    `, [guildId, player.id]);

    console.log(`📊 Progression: ${progress.collected_count}/${progress.required_items} (${progress.theme_name})`);
    console.log(`📦 Collectibles: ${collectibles.length}\n`);

    collectibles.forEach((c, i) => {
      const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
      console.log(`   ${i + 1}. ${emoji} ${c.name} (${c.rarity}) - ${c.source}`);
    });

    console.log('\n💡 Informations du joueur mises à jour:');
    console.log(`   - Progression: ${progress.collected_count}/${progress.required_items}`);
    console.log(`   - Collection: ${collectibles.length} collectibles`);

    if (progress.collected_count >= progress.required_items) {
      console.log(`   - 🎉 Thème complété ! Le joueur peut obtenir son rôle final`);
    }

    console.log('\n✅ Profil mis à jour avec succès !');

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await client.destroy();
    process.exit(1);
  }
}

updateProfileMessage();
